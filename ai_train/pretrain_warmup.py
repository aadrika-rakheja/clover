#!/usr/bin/env python3
"""
Pre-Training Warmup for Online Continual-Learning Spatio-Temporal Model
Pre-trains LiveAdaptiveNeuralForecaster on historical coupled dataset so that
the model starts with high accuracy and domain knowledge before adapting online.
"""

import os
import sys
import torch
import numpy as np
import pandas as pd
from torch.utils.data import TensorDataset, DataLoader

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from live_preprocessor import LiveStreamPreprocessor
from live_adaptive_model import LiveAdaptiveNeuralForecaster, quantile_loss

def pretrain_base_model():
    print("=== Pre-Training Live Adaptive Neural Forecaster on Historical Data ===")
    dataset_path = "ai/data/training_dataset.csv"
    if not os.path.exists(dataset_path):
        print(f"Error: {dataset_path} not found.")
        return

    df = pd.read_csv(dataset_path)
    print(f"Loaded {len(df)} historical timestamps.")

    preprocessor = LiveStreamPreprocessor(buffer_hours=96)
    
    # Process historical rows
    print("Extracting spatio-temporal sliding features...")
    records = df.to_dict("records")
    X_list = []
    y_list = []
    
    horizons = [1, 3, 6, 12, 24, 72]
    max_h = max(horizons)
    
    # Ingest and gather
    for i, r in enumerate(records):
        # Fill advection gradients if not in original csv
        ws = r.get("wind_speed", 2.5)
        wd = r.get("wind_direction", 315.0)
        rad = np.radians(wd)
        r["wind_u"] = -ws * np.sin(rad)
        r["wind_v"] = -ws * np.cos(rad)
        r["dC_dx"] = -0.5 * (r.get("pm25", 50.0) / 200.0)
        r["dC_dy"] = 0.1 * (r.get("pm25", 50.0) / 200.0)
        r["advection_flux"] = -(r["wind_u"] * r["dC_dx"] + r["wind_v"] * r["dC_dy"])
        
        preprocessor.ingest_packet(r)
        
        if i >= 48 and i < len(records) - max_h:
            vec, _ = preprocessor.extract_feature_vector()
            # Targets: future PM2.5 at 1h, 3h, 6h, 12h, 24h, 72h
            y_h = [records[i + h]["pm25"] for h in horizons]
            X_list.append(vec)
            y_list.append(y_h)

    X_arr = np.array(X_list, dtype=np.float32)
    y_arr = np.array(y_list, dtype=np.float32)
    print(f"Prepared {len(X_arr)} training samples with {X_arr.shape[1]} features.")

    model = LiveAdaptiveNeuralForecaster(input_dim=X_arr.shape[1])
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    loader = DataLoader(TensorDataset(torch.tensor(X_arr), torch.tensor(y_arr)), batch_size=64, shuffle=True)

    model.train()
    epochs = 8
    print(f"Training for {epochs} fast epochs...")
    for ep in range(epochs):
        total_loss = 0.0
        for bx, by in loader:
            optimizer.zero_grad()
            pred_q, pred_imp, pred_anom = model(bx)
            loss = quantile_loss(pred_q, by)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            total_loss += loss.item() * len(bx)
            
        mean_ep_loss = total_loss / len(X_arr)
        print(f"Epoch [{ep+1:02d}/{epochs:02d}] - Quantile Pinball Loss: {mean_ep_loss:.4f}")

    os.makedirs("ai_train/saved_live_model", exist_ok=True)
    weights_path = "ai_train/saved_live_model/live_model_weights.pt"
    torch.save(model.state_dict(), weights_path)
    print(f"Successfully saved warmed-up base weights to {weights_path}!")

if __name__ == "__main__":
    pretrain_base_model()

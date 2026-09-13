#!/usr/bin/env python3
"""
Full AI Model Training & Cross-Validation Pipeline
Trains:
1. Multi-Horizon Quantile HistGradientBoosting Regressors (1h, 3h, 6h, 12h, 24h, 72h) with P10, P50, P90 intervals
2. Bidirectional Weather-AQI Feedback Models (solar attenuation, temp depression, PBLH suppression, visibility)
3. Isolation Forest Pollution Anomaly Detector
4. PyTorch Deep Temporal GRU Sequence Forecaster
Evaluates MAE, RMSE, R2, and 80% Prediction Interval Coverage Probability (PICP).
Saves serialized model artifacts in ai/saved_models/.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

# Ensure root import visibility
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.stream_processor import StreamPreprocessor
from models.model_architectures import (
    MultiHorizonQuantileForecaster,
    WeatherFeedbackModel,
    PollutionAnomalyDetector,
    PyTorchTemporalGRU
)

def create_sequence_data(X_arr, y_72h_arr, seq_len=24):
    """Creates sliding windows of length seq_len for PyTorch GRU."""
    X_seq, y_seq = [], []
    for i in range(len(X_arr) - seq_len):
        X_seq.append(X_arr[i:i + seq_len])
        y_seq.append(y_72h_arr[i + seq_len])
    return np.array(X_seq, dtype=np.float32), np.array(y_seq, dtype=np.float32)

def main():
    print("================================================================")
    print("      AI COUPLED WEATHER-AQI 72-HOUR TRAINING PIPELINE         ")
    print("================================================================")
    
    dataset_path = "ai/data/training_dataset.csv"
    if not os.path.exists(dataset_path):
        print(f"Dataset {dataset_path} not found. Running fetch_dataset.py first...")
        from data.fetch_dataset import main as fetch_main
        fetch_main()
        
    print(f"\n1. Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)
    print(f"Loaded {len(df)} hourly timestamps.")
    
    # Run streaming pre-processor batch transformation
    print("\n2. Executing continuous streaming feature engineering...")
    processor = StreamPreprocessor(buffer_size_hours=96)
    X_features_df = processor.batch_transform(df)
    feature_names = processor.get_feature_names()
    print(f"Generated {len(feature_names)} engineered features per timestamp.")
    
    # Horizons to forecast
    horizons = [1, 3, 6, 12, 24, 72]
    
    # Prepare forward targets
    print("\n3. Constructing multi-horizon forecast targets (1h to 72h ahead)...")
    target_data = {}
    for target in ['pm25', 'aqi', 'pm10', 'no2', 'o3']:
        target_data[target] = {}
        for h in horizons:
            target_data[target][h] = df[target].shift(-h).values
            
    # Coupled Weather Feedback targets
    feedback_targets = {
        'solar_attenuation': df['solar_attenuation_watts'].values,
        'temp_depression': df['temp_depression_c'].values,
        'pblh_suppression': df['pblh_suppression_m'].values,
        'visibility': df['visibility_km'].values
    }
    
    # Drop rows at start (warm-up) and at end (target horizon shift)
    max_horizon = max(horizons)
    warmup_steps = 24
    valid_indices = np.arange(warmup_steps, len(df) - max_horizon)
    
    X_clean = X_features_df.iloc[valid_indices].values.astype(np.float32)
    
    # Chronological Train-Test Split (80% train, 20% test for time-series rigor)
    split_idx = int(len(X_clean) * 0.80)
    X_train, X_val = X_clean[:split_idx], X_clean[split_idx:]
    
    y_train_dict = {}
    y_val_dict = {}
    for target in target_data:
        y_train_dict[target] = {}
        y_val_dict[target] = {}
        for h in horizons:
            y_all = target_data[target][h][valid_indices]
            y_train_dict[target][h] = y_all[:split_idx]
            y_val_dict[target][h] = y_all[split_idx:]
            
    feedback_train = {}
    feedback_val = {}
    for k, v in feedback_targets.items():
        v_clean = v[valid_indices]
        feedback_train[k] = v_clean[:split_idx]
        feedback_val[k] = v_clean[split_idx:]
        
    print(f"Training samples: {len(X_train)}, Validation samples: {len(X_val)}")
    
    # -------------------------------------------------------------
    # Model 1: Multi-Horizon Quantile HistGradientBoosting
    # -------------------------------------------------------------
    print("\n----------------------------------------------------------------")
    print(" Model 1: Multi-Horizon Quantile Gradient Boosted Forecaster    ")
    print("----------------------------------------------------------------")
    quantile_forecaster = MultiHorizonQuantileForecaster(horizons=horizons, quantiles=[0.10, 0.50, 0.90])
    quantile_forecaster.fit(X_train, y_train_dict)
    
    # Evaluate Quantile Forecaster
    evaluation_metrics = {}
    print("\n=== Validation Results for PM2.5 & AQI Quantile Forecasts ===")
    print(f"{'Target':<8} | {'Horizon':<8} | {'MAE':<8} | {'RMSE':<8} | {'R2':<8} | {'80% Coverage (PICP)':<20} | {'MPIW':<8}")
    print("-" * 80)
    
    for target in ['pm25', 'aqi']:
        evaluation_metrics[target] = {}
        for h in horizons:
            preds = quantile_forecaster.predict_horizon(X_val, target_name=target, horizon=h)
            y_true = y_val_dict[target][h]
            
            p10 = preds['p10']
            p50 = preds['p50']
            p90 = preds['p90']
            
            mae = mean_absolute_error(y_true, p50)
            rmse = np.sqrt(mean_squared_error(y_true, p50))
            r2 = r2_score(y_true, p50)
            
            # Coverage: fraction of true values falling within [p10, p90]
            inside_interval = (y_true >= p10) & (y_true <= p90)
            picp = float(np.mean(inside_interval)) * 100.0
            mpiw = float(np.mean(p90 - p10))
            
            evaluation_metrics[target][f"{h}h"] = {
                'mae': round(float(mae), 2),
                'rmse': round(float(rmse), 2),
                'r2': round(float(r2), 3),
                'picp_percent': round(picp, 1),
                'mpiw': round(mpiw, 2)
            }
            
            print(f"{target:<8} | {f'+{h}h':<8} | {mae:<8.2f} | {rmse:<8.2f} | {r2:<8.3f} | {picp:>6.1f}% (Expected ~80%)  | {mpiw:<8.2f}")
            
    # -------------------------------------------------------------
    # Model 2: Bidirectional Weather-AQI Feedback Engine
    # -------------------------------------------------------------
    print("\n----------------------------------------------------------------")
    print(" Model 2: Bidirectional Weather Feedback Regressors              ")
    print("----------------------------------------------------------------")
    feedback_model = WeatherFeedbackModel()
    feedback_model.fit(X_train, feedback_train)
    
    feedback_preds = feedback_model.predict(X_val)
    fb_metrics = {}
    print("\n=== Validation Results for Weather Impact Predictions ===")
    print(f"{'Weather Impact Parameter':<32} | {'MAE':<8} | {'RMSE':<8} | {'R2':<8}")
    print("-" * 65)
    
    impact_map = {
        'solar_attenuation_watts': ('solar_attenuation', 'Solar Attenuation (W/m2)'),
        'temp_depression_c': ('temp_depression', 'Surface Temp Depression (C)'),
        'pblh_suppression_m': ('pblh_suppression', 'PBLH Compression (m)'),
        'visibility_km': ('visibility', 'Koschmieder Visibility (km)')
    }
    
    for pred_key, (true_key, display_name) in impact_map.items():
        y_true = feedback_val[true_key]
        y_pred = feedback_preds[pred_key]
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        r2 = r2_score(y_true, y_pred)
        fb_metrics[pred_key] = {'mae': round(float(mae), 3), 'rmse': round(float(rmse), 3), 'r2': round(float(r2), 3)}
        print(f"{display_name:<32} | {mae:<8.3f} | {rmse:<8.3f} | {r2:<8.3f}")
        
    evaluation_metrics['weather_feedback'] = fb_metrics
    
    # -------------------------------------------------------------
    # Model 3: Pollution Anomaly Detector (Isolation Forest)
    # -------------------------------------------------------------
    print("\n----------------------------------------------------------------")
    print(" Model 3: Pollution Anomaly & Outlier Detector (Isolation Forest)")
    print("----------------------------------------------------------------")
    anomaly_detector = PollutionAnomalyDetector(contamination=0.035)
    anomaly_detector.fit(X_train)
    val_anomaly_res = anomaly_detector.detect(X_val[0])
    print(f"Sample validation check: {val_anomaly_res}")
    
    # -------------------------------------------------------------
    # Model 4: PyTorch Temporal GRU Sequence Forecaster
    # -------------------------------------------------------------
    print("\n----------------------------------------------------------------")
    print(" Model 4: PyTorch Temporal Sequence GRU Forecaster               ")
    print("----------------------------------------------------------------")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    
    # Target: full 72-hour future PM2.5 trajectory
    y_train_72h = np.column_stack([target_data['pm25'][h][valid_indices][:split_idx] for h in horizons])
    y_val_72h = np.column_stack([target_data['pm25'][h][valid_indices][split_idx:] for h in horizons])
    
    seq_len = 24
    X_seq_train, y_seq_train = create_sequence_data(X_train_scaled, y_train_72h, seq_len=seq_len)
    X_seq_val, y_seq_val = create_sequence_data(X_val_scaled, y_val_72h, seq_len=seq_len)
    
    train_loader = DataLoader(
        TensorDataset(torch.tensor(X_seq_train), torch.tensor(y_seq_train)),
        batch_size=64,
        shuffle=True
    )
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training PyTorch GRU on device: {device} (Input dim: {len(feature_names)}, Seq len: {seq_len})...")
    
    gru_model = PyTorchTemporalGRU(
        input_dim=len(feature_names),
        hidden_dim=64,
        num_layers=2,
        output_steps=len(horizons),
        dropout=0.2
    ).to(device)
    
    criterion = nn.SmoothL1Loss()
    optimizer = torch.optim.Adam(gru_model.parameters(), lr=0.003, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=3, factor=0.5)
    
    epochs = 15
    for ep in range(epochs):
        gru_model.train()
        total_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            preds = gru_model(batch_x)
            loss = criterion(preds, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(batch_x)
            
        epoch_loss = total_loss / len(X_seq_train)
        scheduler.step(epoch_loss)
        if (ep + 1) % 3 == 0 or ep == 0:
            print(f"Epoch [{ep+1:02d}/{epochs:02d}] - Train Huber Loss: {epoch_loss:.4f}")
            
    gru_model.eval()
    with torch.no_grad():
        val_preds_pt = gru_model(torch.tensor(X_seq_val).to(device)).cpu().numpy()
        pt_mae = mean_absolute_error(y_seq_val, val_preds_pt)
        pt_r2 = r2_score(y_seq_val.flatten(), val_preds_pt.flatten())
        print(f"PyTorch GRU Validation Overall Trajectory MAE: {pt_mae:.2f}, R2: {pt_r2:.3f}")
        
    evaluation_metrics['pytorch_gru'] = {
        'trajectory_mae': round(float(pt_mae), 2),
        'overall_r2': round(float(pt_r2), 3)
    }
    
    # -------------------------------------------------------------
    # 5. Persist Trained Models & Artifacts
    # -------------------------------------------------------------
    os.makedirs("ai/saved_models", exist_ok=True)
    os.makedirs("ai_train", exist_ok=True)
    
    print("\n----------------------------------------------------------------")
    print(" Saving Model Weights & Pipeline Artifacts                      ")
    print("----------------------------------------------------------------")
    
    joblib.dump(quantile_forecaster, "ai/saved_models/aqi_quantile_models.joblib")
    joblib.dump(feedback_model, "ai/saved_models/weather_feedback.joblib")
    joblib.dump(anomaly_detector, "ai/saved_models/anomaly_detector.joblib")
    joblib.dump(scaler, "ai/saved_models/feature_scaler.joblib")
    torch.save(gru_model.state_dict(), "ai/saved_models/gru_forecaster.pt")
    
    # Save training report metadata
    with open("ai/saved_models/training_report.json", "w") as f:
        json.dump({
            'training_timestamp': pd.Timestamp.now().isoformat(),
            'horizons_hours': horizons,
            'features_count': len(feature_names),
            'feature_names': feature_names,
            'metrics': evaluation_metrics
        }, f, indent=2)
        
    # Also save metadata in ai_train folder for direct access
    with open("ai_train/training_report.json", "w") as f:
        json.dump(evaluation_metrics, f, indent=2)
        
    print(" Saved:")
    print("  - ai/saved_models/aqi_quantile_models.joblib")
    print("  - ai/saved_models/weather_feedback.joblib")
    print("  - ai/saved_models/anomaly_detector.joblib")
    print("  - ai/saved_models/feature_scaler.joblib")
    print("  - ai/saved_models/gru_forecaster.pt")
    print("  - ai/saved_models/training_report.json")
    print("\n================================================================")
    print("          TRAINING PIPELINE COMPLETED SUCCESSFULLY!             ")
    print("================================================================")

if __name__ == "__main__":
    main()

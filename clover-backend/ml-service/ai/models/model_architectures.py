#!/usr/bin/env python3
"""
Model Architectures for Coupled Weather-AQI System
Contains:
1. MultiHorizonQuantileForecaster: Gradient Boosted Quantile Regressors for 1h, 3h, 6h, 12h, 24h, 72h
2. PyTorchTemporalGRU: Deep recurrent neural network for long-range temporal sequence forecasting
3. WeatherFeedbackModel: Predicts aerosol feedbacks on meteorology (solar attenuation, temp depression, PBLH cap, visibility)
4. AnomalyDetector: Isolation Forest for unusual pollution spikes and sensor outliers
5. FeatureAttribution: Fast explainable AI scoring for top driving factors
"""

import math
import numpy as np
import torch
import torch.nn as nn
from sklearn.ensemble import HistGradientBoostingRegressor, IsolationForest

class MultiHorizonQuantileForecaster:
    """
    Multi-horizon quantile forecasting suite using Histogram Gradient Boosting Regressors.
    Estimates 10th, 50th (median), and 90th percentiles for rigorous prediction intervals.
    Horizons: 1h, 3h, 6h, 12h, 24h, 72h ahead.
    """
    def __init__(self, horizons=[1, 3, 6, 12, 24, 72], quantiles=[0.10, 0.50, 0.90]):
        self.horizons = horizons
        self.quantiles = quantiles
        # models[target][horizon][quantile] = estimator
        self.models = {}
        self.is_fitted = False

    def fit(self, X_train, y_dict):
        """
        X_train: array-like of shape (N, n_features)
        y_dict: dict of targets, e.g. {'pm25': {1: y_1h, 3: y_3h, ...}}
        """
        print(f"Training MultiHorizonQuantileForecaster across horizons {self.horizons}...")
        for target_name, horizon_dict in y_dict.items():
            if target_name not in self.models:
                self.models[target_name] = {}
                
            for h in self.horizons:
                if h not in horizon_dict:
                    continue
                y_h = horizon_dict[h]
                self.models[target_name][h] = {}
                
                for q in self.quantiles:
                    reg = HistGradientBoostingRegressor(
                        loss='quantile',
                        quantile=q,
                        max_iter=110,
                        max_leaf_nodes=31,
                        min_samples_leaf=20,
                        learning_rate=0.06,
                        l2_regularization=1.5,
                        random_state=42
                    )
                    reg.fit(X_train, y_h)
                    self.models[target_name][h][q] = reg
                    
        self.is_fitted = True
        print("MultiHorizonQuantileForecaster training complete!")

    def predict_horizon(self, X, target_name='pm25', horizon=24):
        """
        Predicts [p10, p50, p90] for given horizon.
        """
        if not self.is_fitted:
            raise RuntimeError("Forecaster is not fitted!")
            
        h_models = self.models.get(target_name, {}).get(horizon)
        if not h_models:
            raise ValueError(f"No model found for {target_name} at horizon {horizon}h")
            
        p10 = h_models[0.10].predict(X)
        p50 = h_models[0.50].predict(X)
        p90 = h_models[0.90].predict(X)
        
        # Enforce quantile monotonicity (p10 <= p50 <= p90)
        p10_clean = np.minimum(p10, p50)
        p90_clean = np.maximum(p90, p50)
        
        return {
            'p10': np.clip(p10_clean, 0.0, None),
            'p50': np.clip(p50, 0.0, None),
            'p90': np.clip(p90_clean, 0.0, None)
        }

    def predict_all_horizons(self, X_single):
        """
        Runs predictions across all horizons for a single feature vector.
        Returns trajectory dictionary.
        """
        X = np.asarray(X_single).reshape(1, -1)
        results = {}
        
        for target_name in self.models.keys():
            results[target_name] = {}
            for h in self.horizons:
                res = self.predict_horizon(X, target_name=target_name, horizon=h)
                results[target_name][h] = {
                    'p10': float(res['p10'][0]),
                    'p50': float(res['p50'][0]),
                    'p90': float(res['p90'][0]),
                }
        return results


class WeatherFeedbackModel:
    """
    Bidirectional Coupling Regressors:
    Predicts the meteorological impact caused by aerosol and particulate concentrations:
    1. Solar radiation attenuation (W/m2)
    2. Surface temperature depression (deg C)
    3. Planetary boundary layer height suppression (m)
    4. Optical visibility degradation (km)
    """
    def __init__(self):
        self.models = {}
        self.is_fitted = False

    def fit(self, X_train, target_dict):
        """
        target_dict: {
            'solar_attenuation': y_solar,
            'temp_depression': y_temp,
            'pblh_suppression': y_pblh,
            'visibility': y_vis
        }
        """
        print("Training WeatherFeedbackModel regressors...")
        for name, y in target_dict.items():
            reg = HistGradientBoostingRegressor(
                loss='squared_error',
                max_iter=100,
                max_leaf_nodes=28,
                learning_rate=0.07,
                l2_regularization=1.0,
                random_state=42
            )
            reg.fit(X_train, y)
            self.models[name] = reg
            
        self.is_fitted = True
        print("WeatherFeedbackModel training complete!")

    def predict(self, X):
        if not self.is_fitted:
            raise RuntimeError("WeatherFeedbackModel is not fitted!")
            
        X_arr = np.asarray(X).reshape(-1, X.shape[-1] if hasattr(X, 'shape') and len(X.shape) > 1 else len(X))
        
        solar_att = np.maximum(0.0, self.models['solar_attenuation'].predict(X_arr))
        temp_dep = np.maximum(0.0, self.models['temp_depression'].predict(X_arr))
        pblh_sup = np.maximum(0.0, self.models['pblh_suppression'].predict(X_arr))
        vis_km = np.clip(self.models['visibility'].predict(X_arr), 0.2, 40.0)
        
        return {
            'solar_attenuation_watts': solar_att,
            'temp_depression_c': temp_dep,
            'pblh_suppression_m': pblh_sup,
            'visibility_km': vis_km
        }


class PollutionAnomalyDetector:
    """
    Isolation Forest for detecting severe pollution spikes, sudden industrial plumes,
    stubble burning flare-ups, and sensor transmission errors.
    """
    def __init__(self, contamination=0.03):
        self.model = IsolationForest(
            n_estimators=120,
            contamination=contamination,
            max_samples='auto',
            random_state=42
        )
        self.is_fitted = False

    def fit(self, X_train):
        print("Fitting PollutionAnomalyDetector (Isolation Forest)...")
        self.model.fit(X_train)
        self.is_fitted = True
        print("Anomaly Detector fitted successfully!")

    def detect(self, X):
        if not self.is_fitted:
            raise RuntimeError("Anomaly detector not fitted!")
        X_arr = np.asarray(X).reshape(1, -1) if len(np.shape(X)) == 1 else np.asarray(X)
        pred = self.model.predict(X_arr) # -1: anomaly, 1: normal
        score = -self.model.decision_function(X_arr) # higher = more anomalous
        
        return {
            'is_anomaly': bool(pred[0] == -1),
            'anomaly_score': float(score[0]),
            'status': "ANOMALOUS_SPIKE" if pred[0] == -1 else "NORMAL_OPERATION"
        }


class PyTorchTemporalGRU(nn.Module):
    """
    PyTorch Deep Recurrent Neural Network for multi-horizon temporal sequence forecasting.
    Takes sliding sequence window (T, D) and outputs full 72-hour forecast trajectory.
    """
    def __init__(self, input_dim, hidden_dim=64, num_layers=2, output_steps=72, dropout=0.2):
        super(PyTorchTemporalGRU, self).__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.output_steps = output_steps
        
        self.gru = nn.GRU(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, output_steps)
        )

    def forward(self, x):
        # x: (batch_size, seq_len, input_dim)
        out, _ = self.gru(x)
        # Take the final hidden state representation
        last_step = out[:, -1, :]
        preds = self.fc(last_step)
        return preds


class FeatureAttribution:
    """
    Explainable AI (XAI) feature attribution generator.
    Identifies top meteorological and anthropogenic drivers behind AQI predictions.
    """
    @staticmethod
    def explain(feature_dict):
        explanations = []
        
        pm25 = feature_dict.get('pm25', 50.0)
        ws = feature_dict.get('wind_speed', 2.5)
        wd = feature_dict.get('wind_direction', 315.0)
        pblh = feature_dict.get('pblh', 1000.0)
        rh = feature_dict.get('relative_humidity', 50.0)
        cml_attn = feature_dict.get('cml_specific_attenuation', 0.05)
        inversion = feature_dict.get('is_inversion_risk', 0.0)
        
        # 1. Thermal Inversion & Ventilation
        if inversion > 0.5 or pblh < 420:
            explanations.append({
                'factor': 'Thermal Inversion Trapping',
                'impact': 'High Positive (+35 to +85 AQI)',
                'severity': 'CRITICAL',
                'description': f'PBL height compressed to {round(pblh)}m, suppressing vertical mixing.'
            })
            
        # 2. Wind Stagnation
        if ws < 1.8:
            explanations.append({
                'factor': 'Surface Wind Stagnation',
                'impact': 'Moderate Positive (+20 to +45 AQI)',
                'severity': 'HIGH',
                'description': f'Low surface wind speed ({ws:.1f} m/s) prevents horizontal dispersion.'
            })
            
        # 3. Upwind Stubble / NW Transport
        if 285 <= wd <= 345 and ws >= 2.0:
            explanations.append({
                'factor': 'North-West Regional Plume Advection',
                'impact': 'High Positive (+40 to +90 AQI)',
                'severity': 'CRITICAL',
                'description': f'Wind vector aligned with upwind agricultural/industrial corridors ({round(wd)}° NW).'
            })
            
        # 4. Moisture & Aerosol Hygroscopic Swelling (CML-detected)
        if rh > 75 and cml_attn > 0.08:
            explanations.append({
                'factor': 'CML Radio Link Moisture Fading',
                'impact': 'Positive (+15 to +35 AQI)',
                'severity': 'MODERATE',
                'description': f'High humidity ({round(rh)}%) causing hygroscopic particle growth detected via 23GHz RSL drop.'
            })
            
        # 5. Rain Washout (if raining)
        precip = feature_dict.get('precipitation', 0.0)
        if precip > 0.5:
            explanations.append({
                'factor': 'Precipitation Scavenging',
                'impact': 'Negative (-40 to -110 AQI)',
                'severity': 'BENEFICIAL',
                'description': f'Rainfall ({precip:.1f} mm/h) actively washing out suspended particulate matter.'
            })
            
        if not explanations:
            explanations.append({
                'factor': 'Steady State Dispersion',
                'impact': 'Neutral',
                'severity': 'LOW',
                'description': 'Atmospheric ventilation and background emissions in equilibrium.'
            })
            
        return explanations

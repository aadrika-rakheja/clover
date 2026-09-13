#!/usr/bin/env python3
"""
Continuous Real-Time Streaming Pre-Processing Unit
Maintains an active sliding buffer of incoming live telemetry (Open-Meteo weather,
CPCB CAAQMS multi-pollutant monitors, and CML microwave radio link signals).
Performs online rolling feature engineering, temporal lag computation,
wind vector decomposition, atmospheric stagnation indexing, and missing value imputation.
"""

import math
import numpy as np
import pandas as pd
from collections import deque
from datetime import datetime

# Mandatory raw fields expected in live records
RAW_METEOROLOGY_FIELDS = [
    'temperature', 'relative_humidity', 'dew_point', 'surface_pressure',
    'precipitation', 'wind_speed', 'wind_direction', 'solar_radiation',
    'cloud_cover', 'pblh'
]

RAW_POLLUTANT_FIELDS = [
    'pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'voc'
]

RAW_CML_FIELDS = [
    'cml_rsl_dbm', 'cml_specific_attenuation'
]

ALL_RAW_FIELDS = RAW_METEOROLOGY_FIELDS + RAW_POLLUTANT_FIELDS + RAW_CML_FIELDS

class StreamPreprocessor:
    """
    Streaming pre-processor with an internal sliding-window buffer.
    Ensures exact consistency between offline training data and online live ingestion.
    """
    def __init__(self, buffer_size_hours=96):
        self.buffer_size_hours = buffer_size_hours
        self.buffer = []  # List of dicts, sorted by time
        self.feature_names = None
        self._init_feature_names()

    def _init_feature_names(self):
        """Pre-defines deterministic feature names ordering."""
        feats = []
        # Current instant raw metrics
        for col in ALL_RAW_FIELDS:
            feats.append(col)
        
        # Atmospheric physics derivations
        feats.extend([
            'wind_u', 'wind_v', 'ventilation_index', 'is_inversion_risk',
            'stagnation_index', 'dew_point_depression', 'hygroscopic_factor'
        ])
        
        # Temporal cycles
        feats.extend([
            'hour_sin', 'hour_cos', 'doy_sin', 'doy_cos', 'is_weekend'
        ])
        
        # Lag features
        lags = [1, 2, 3, 6, 12, 24]
        for lag in lags:
            feats.append(f'pm25_lag_{lag}h')
            feats.append(f'pm10_lag_{lag}h')
            feats.append(f'temperature_lag_{lag}h')
            feats.append(f'wind_speed_lag_{lag}h')
            feats.append(f'cml_rsl_lag_{lag}h')
            
        # Rolling statistics
        windows = [3, 6, 12, 24]
        for w in windows:
            feats.append(f'pm25_roll_mean_{w}h')
            feats.append(f'pm25_roll_std_{w}h')
            feats.append(f'pm10_roll_mean_{w}h')
            feats.append(f'wind_speed_roll_mean_{w}h')
            feats.append(f'pblh_roll_mean_{w}h')
            feats.append(f'cml_attn_roll_mean_{w}h')
            
        # Rates of change (acceleration & velocity)
        feats.extend([
            'pm25_diff_1h', 'pm25_diff_3h', 'pm25_diff_6h',
            'temp_diff_3h', 'cml_rsl_diff_1h'
        ])
        
        self.feature_names = feats

    def get_feature_names(self):
        return list(self.feature_names)

    def compute_instant_physics(self, record):
        """Computes instantaneous atmospheric physics indices for a single record."""
        ws = float(record.get('wind_speed', 2.5))
        wd = float(record.get('wind_direction', 315.0))
        rad = math.radians(wd)
        
        # Wind vector components (meteorological: direction wind is blowing FROM)
        wind_u = -ws * math.sin(rad)  # East-West
        wind_v = -ws * math.cos(rad)  # North-South
        
        temp = float(record.get('temperature', 25.0))
        dew = float(record.get('dew_point', temp - 5.0))
        dew_point_depression = max(0.0, temp - dew)
        
        rh = float(record.get('relative_humidity', 50.0))
        hygroscopic_factor = 1.0 / (max(0.05, 1.0 - (rh / 100.0)) ** 0.4)
        
        pblh = float(record.get('pblh', 1000.0))
        ventilation_index = ws * pblh
        
        # Inversion & Stagnation risk
        is_inversion_risk = 1.0 if (pblh < 420.0 and ws < 2.0) else 0.0
        stagnation_index = max(0.0, (1200.0 - min(1200.0, pblh)) / 1200.0 * 1.5 + (3.5 - min(3.5, ws)) / 3.5 * 0.8)
        
        # Diurnal and annual cyclical encodings
        time_val = record.get('time')
        if isinstance(time_val, str):
            dt = pd.to_datetime(time_val)
        elif isinstance(time_val, datetime) or isinstance(time_val, pd.Timestamp):
            dt = time_val
        else:
            dt = datetime.now()
            
        hour = dt.hour
        doy = dt.timetuple().tm_yday
        is_weekend = 1.0 if dt.weekday() >= 5 else 0.0
        
        hour_sin = math.sin(2 * math.pi * hour / 24.0)
        hour_cos = math.cos(2 * math.pi * hour / 24.0)
        doy_sin = math.sin(2 * math.pi * doy / 365.25)
        doy_cos = math.cos(2 * math.pi * doy / 365.25)
        
        return {
            'wind_u': wind_u,
            'wind_v': wind_v,
            'ventilation_index': ventilation_index,
            'is_inversion_risk': is_inversion_risk,
            'stagnation_index': stagnation_index,
            'dew_point_depression': dew_point_depression,
            'hygroscopic_factor': hygroscopic_factor,
            'hour_sin': hour_sin,
            'hour_cos': hour_cos,
            'doy_sin': doy_sin,
            'doy_cos': doy_cos,
            'is_weekend': is_weekend
        }

    def ingest_record(self, raw_record):
        """
        Ingests a single live data record into the rolling state buffer.
        Performs missing value handling, sanity clamping, and physics computation.
        """
        clean_record = dict(raw_record)
        
        # Defaults for missing items
        if 'pblh' not in clean_record:
            temp = clean_record.get('temperature', 25.0)
            ws = clean_record.get('wind_speed', 2.5)
            # Estimate diurnal convective boundary layer
            time_val = clean_record.get('time', datetime.now())
            hour = pd.to_datetime(time_val).hour
            clean_record['pblh'] = 350.0 + max(0, math.sin((hour - 6) * math.pi / 12)) * 1200.0 + ws * 50.0
            
        if 'dew_point' not in clean_record:
            temp = clean_record.get('temperature', 25.0)
            rh = clean_record.get('relative_humidity', 55.0)
            clean_record['dew_point'] = temp - ((100.0 - rh) / 5.0)
            
        if 'cml_rsl_dbm' not in clean_record:
            clean_record['cml_rsl_dbm'] = -42.5
            
        if 'cml_specific_attenuation' not in clean_record:
            clean_record['cml_specific_attenuation'] = 0.05
            
        # Add instant physics
        physics = self.compute_instant_physics(clean_record)
        clean_record.update(physics)
        
        # Append to rolling buffer
        self.buffer.append(clean_record)
        
        # Trim buffer if exceeding maximum window
        if len(self.buffer) > self.buffer_size_hours:
            self.buffer.pop(0)

    def extract_features(self):
        """
        Extracts the full feature vector from the current state buffer for the latest timestamp.
        Returns:
            np.ndarray: 1D vector of shape (num_features,)
            dict: named feature dictionary
        """
        if not self.buffer:
            raise ValueError("Buffer is empty! Ingest at least one record first.")
            
        latest = self.buffer[-1]
        buf_len = len(self.buffer)
        
        feat_dict = {}
        
        # 1. Base Raw & Instant Physics Features
        for key in ALL_RAW_FIELDS:
            feat_dict[key] = float(latest.get(key, 0.0))
            
        for key in [
            'wind_u', 'wind_v', 'ventilation_index', 'is_inversion_risk',
            'stagnation_index', 'dew_point_depression', 'hygroscopic_factor',
            'hour_sin', 'hour_cos', 'doy_sin', 'doy_cos', 'is_weekend'
        ]:
            feat_dict[key] = float(latest.get(key, 0.0))
            
        # 2. Lag Features
        lags = [1, 2, 3, 6, 12, 24]
        for lag in lags:
            idx = max(0, buf_len - 1 - lag)
            lag_rec = self.buffer[idx]
            feat_dict[f'pm25_lag_{lag}h'] = float(lag_rec.get('pm25', latest.get('pm25', 50.0)))
            feat_dict[f'pm10_lag_{lag}h'] = float(lag_rec.get('pm10', latest.get('pm10', 80.0)))
            feat_dict[f'temperature_lag_{lag}h'] = float(lag_rec.get('temperature', latest.get('temperature', 25.0)))
            feat_dict[f'wind_speed_lag_{lag}h'] = float(lag_rec.get('wind_speed', latest.get('wind_speed', 2.5)))
            feat_dict[f'cml_rsl_lag_{lag}h'] = float(lag_rec.get('cml_rsl_dbm', latest.get('cml_rsl_dbm', -42.5)))
            
        # 3. Rolling Window Statistics
        windows = [3, 6, 12, 24]
        for w in windows:
            start_idx = max(0, buf_len - w)
            sub_window = self.buffer[start_idx:]
            
            pm25_vals = [float(r.get('pm25', 50.0)) for r in sub_window]
            pm10_vals = [float(r.get('pm10', 80.0)) for r in sub_window]
            ws_vals = [float(r.get('wind_speed', 2.5)) for r in sub_window]
            pblh_vals = [float(r.get('pblh', 1000.0)) for r in sub_window]
            cml_vals = [float(r.get('cml_specific_attenuation', 0.05)) for r in sub_window]
            
            feat_dict[f'pm25_roll_mean_{w}h'] = float(np.mean(pm25_vals))
            feat_dict[f'pm25_roll_std_{w}h'] = float(np.std(pm25_vals)) if len(pm25_vals) > 1 else 0.0
            feat_dict[f'pm10_roll_mean_{w}h'] = float(np.mean(pm10_vals))
            feat_dict[f'wind_speed_roll_mean_{w}h'] = float(np.mean(ws_vals))
            feat_dict[f'pblh_roll_mean_{w}h'] = float(np.mean(pblh_vals))
            feat_dict[f'cml_attn_roll_mean_{w}h'] = float(np.mean(cml_vals))
            
        # 4. Rates of change
        rec_1h = self.buffer[max(0, buf_len - 2)]
        rec_3h = self.buffer[max(0, buf_len - 4)]
        rec_6h = self.buffer[max(0, buf_len - 7)]
        
        curr_pm25 = float(latest.get('pm25', 50.0))
        curr_temp = float(latest.get('temperature', 25.0))
        curr_rsl = float(latest.get('cml_rsl_dbm', -42.5))
        
        feat_dict['pm25_diff_1h'] = curr_pm25 - float(rec_1h.get('pm25', curr_pm25))
        feat_dict['pm25_diff_3h'] = curr_pm25 - float(rec_3h.get('pm25', curr_pm25))
        feat_dict['pm25_diff_6h'] = curr_pm25 - float(rec_6h.get('pm25', curr_pm25))
        feat_dict['temp_diff_3h'] = curr_temp - float(rec_3h.get('temperature', curr_temp))
        feat_dict['cml_rsl_diff_1h'] = curr_rsl - float(rec_1h.get('cml_rsl_dbm', curr_rsl))
        
        # Build ordered vector
        vector = np.array([feat_dict[col] for col in self.feature_names], dtype=np.float32)
        return vector, feat_dict

    def batch_transform(self, df):
        """
        Transforms a full historical DataFrame into identical feature matrix for training.
        Returns:
            X_df: pd.DataFrame with all feature columns
        """
        print(f"Executing batch streaming transformation on {len(df)} historical rows...")
        self.buffer = []
        feature_rows = []
        
        records = df.to_dict('records')
        for i, r in enumerate(records):
            self.ingest_record(r)
            # Only extract after initial warm-up (e.g. 24 hours of buffer)
            vec, fdict = self.extract_features()
            feature_rows.append(fdict)
            
        out_df = pd.DataFrame(feature_rows)
        return out_df

def test_stream_processor():
    """Unit test for StreamPreprocessor"""
    print("Testing StreamPreprocessor...")
    processor = StreamPreprocessor(buffer_size_hours=48)
    
    # Ingest 10 dummy hours
    for h in range(10):
        t = datetime(2024, 1, 15, h, 0, 0)
        sample = {
            'time': t,
            'temperature': 18.0 + h * 0.5,
            'relative_humidity': 75.0 - h * 2.0,
            'dew_point': 12.0,
            'surface_pressure': 1002.0,
            'precipitation': 0.0,
            'wind_speed': 1.8 + h * 0.1,
            'wind_direction': 310.0,
            'solar_radiation': 150.0 * h,
            'cloud_cover': 20.0,
            'pblh': 350.0 + h * 80.0,
            'pm25': 180.0 - h * 5.0,
            'pm10': 280.0 - h * 8.0,
            'no2': 55.0,
            'so2': 14.0,
            'co': 1.8,
            'o3': 30.0 + h * 3.0,
            'voc': 80.0,
            'cml_rsl_dbm': -43.2,
            'cml_specific_attenuation': 0.08
        }
        processor.ingest_record(sample)
        
    vec, fdict = processor.extract_features()
    print(f"Pre-processor successfully generated {len(vec)} features:")
    print("Feature vector sample (first 8):", vec[:8])
    print("Extracted feature names count:", len(processor.get_feature_names()))
    assert len(vec) == len(processor.get_feature_names()), "Vector length mismatch!"
    print("StreamPreprocessor unit test PASSED!")

if __name__ == "__main__":
    test_stream_processor()

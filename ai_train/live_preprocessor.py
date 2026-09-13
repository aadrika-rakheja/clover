#!/usr/bin/env python3
"""
Continuous Live Streaming Pre-Processor for Spatio-Temporal Ingestion
Maintains a 96-hour rolling sliding window of live multi-source fused telemetry.
Extracts:
- Spatio-temporal advection flux (u * dC/dx + v * dC/dy)
- Dynamic Ventilation Index (ws * PBLH)
- Thermal Inversion & Stagnation risk scores
- Hygroscopic particle swelling under ambient humidity
- Multi-scale temporal lags (1h, 2h, 3h, 6h, 12h, 24h)
- Rolling statistics (mean, std, min, max, rate of change)
"""

import math
import numpy as np
import pandas as pd
from datetime import datetime

class LiveStreamPreprocessor:
    def __init__(self, buffer_hours=96):
        self.buffer_hours = buffer_hours
        self.buffer = []
        self.feature_names = None
        self._init_feature_names()

    def _init_feature_names(self):
        names = [
            'temperature', 'relative_humidity', 'dew_point', 'surface_pressure',
            'precipitation', 'rain', 'wind_speed', 'wind_direction', 'solar_radiation',
            'diffuse_radiation', 'shortwave_radiation', 'cloud_cover', 'pblh',
            'pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'voc', 'aod',
            'cml_rsl_dbm', 'cml_specific_attenuation',
            'dC_dx', 'dC_dy', 'advection_flux',
            'wind_u', 'wind_v', 'ventilation_index', 'is_inversion_risk',
            'stagnation_index', 'dew_point_depression', 'hygroscopic_factor',
            'hour_sin', 'hour_cos', 'doy_sin', 'doy_cos', 'is_weekend'
        ]
        
        # Lags
        for lag in [1, 2, 3, 6, 12, 24]:
            names.extend([
                f'pm25_lag_{lag}h', f'pm10_lag_{lag}h', f'temp_lag_{lag}h',
                f'wind_speed_lag_{lag}h', f'cml_rsl_lag_{lag}h', f'advection_lag_{lag}h'
            ])
            
        # Rolling stats
        for w in [3, 6, 12, 24]:
            names.extend([
                f'pm25_roll_mean_{w}h', f'pm25_roll_std_{w}h',
                f'pm10_roll_mean_{w}h', f'wind_speed_roll_mean_{w}h',
                f'pblh_roll_mean_{w}h', f'cml_attn_roll_mean_{w}h'
            ])
            
        # Rates of change
        names.extend([
            'pm25_diff_1h', 'pm25_diff_3h', 'pm25_diff_6h',
            'temp_diff_3h', 'cml_rsl_diff_1h', 'pblh_diff_3h'
        ])
        
        self.feature_names = names

    def get_feature_names(self):
        return list(self.feature_names)

    def ingest_packet(self, packet):
        """
        Ingests a fused live packet into the rolling FIFO buffer.
        """
        clean = dict(packet)
        
        # Temporal cycles
        t_val = clean.get('time', datetime.now())
        dt = pd.to_datetime(t_val)
        hour = dt.hour
        doy = dt.timetuple().tm_yday
        clean['hour_sin'] = math.sin(2 * math.pi * hour / 24.0)
        clean['hour_cos'] = math.cos(2 * math.pi * hour / 24.0)
        clean['doy_sin'] = math.sin(2 * math.pi * doy / 365.25)
        clean['doy_cos'] = math.cos(2 * math.pi * doy / 365.25)
        clean['is_weekend'] = 1.0 if dt.weekday() >= 5 else 0.0
        
        # Wind vectors
        ws = float(clean.get('wind_speed', 2.5))
        wd = float(clean.get('wind_direction', 315.0))
        rad = math.radians(wd)
        clean['wind_u'] = -ws * math.sin(rad)
        clean['wind_v'] = -ws * math.cos(rad)
        
        # Physics
        pblh = float(clean.get('pblh', 750.0))
        clean['ventilation_index'] = ws * pblh
        clean['is_inversion_risk'] = 1.0 if (pblh < 420.0 and ws < 2.0) else 0.0
        clean['stagnation_index'] = max(0.0, (1200.0 - min(1200.0, pblh)) / 1200.0 * 1.5 + (3.5 - min(3.5, ws)) / 3.5 * 0.8)
        
        temp = float(clean.get('temperature', 25.0))
        dew = float(clean.get('dew_point', temp - 5.0))
        clean['dew_point_depression'] = max(0.0, temp - dew)
        
        rh = float(clean.get('relative_humidity', 60.0))
        clean['hygroscopic_factor'] = 1.0 / (max(0.05, 1.0 - (rh / 100.0)) ** 0.4)
        
        self.buffer.append(clean)
        if len(self.buffer) > self.buffer_hours:
            self.buffer.pop(0)

    def extract_feature_vector(self):
        """
        Extracts 1D vector of shape (num_features,) from current rolling buffer.
        """
        if not self.buffer:
            raise ValueError("Buffer is empty!")
            
        latest = self.buffer[-1]
        n_buf = len(self.buffer)
        f_dict = {}
        
        # Base instantaneous
        for col in [
            'temperature', 'relative_humidity', 'dew_point', 'surface_pressure',
            'precipitation', 'rain', 'wind_speed', 'wind_direction', 'solar_radiation',
            'diffuse_radiation', 'shortwave_radiation', 'cloud_cover', 'pblh',
            'pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'voc', 'aod',
            'cml_rsl_dbm', 'cml_specific_attenuation',
            'dC_dx', 'dC_dy', 'advection_flux',
            'wind_u', 'wind_v', 'ventilation_index', 'is_inversion_risk',
            'stagnation_index', 'dew_point_depression', 'hygroscopic_factor',
            'hour_sin', 'hour_cos', 'doy_sin', 'doy_cos', 'is_weekend'
        ]:
            f_dict[col] = float(latest.get(col, 0.0))
            
        # Lags
        for lag in [1, 2, 3, 6, 12, 24]:
            idx = max(0, n_buf - 1 - lag)
            rec = self.buffer[idx]
            f_dict[f'pm25_lag_{lag}h'] = float(rec.get('pm25', latest.get('pm25', 50.0)))
            f_dict[f'pm10_lag_{lag}h'] = float(rec.get('pm10', latest.get('pm10', 80.0)))
            f_dict[f'temp_lag_{lag}h'] = float(rec.get('temperature', latest.get('temperature', 25.0)))
            f_dict[f'wind_speed_lag_{lag}h'] = float(rec.get('wind_speed', latest.get('wind_speed', 2.5)))
            f_dict[f'cml_rsl_lag_{lag}h'] = float(rec.get('cml_rsl_dbm', latest.get('cml_rsl_dbm', -42.5)))
            f_dict[f'advection_lag_{lag}h'] = float(rec.get('advection_flux', latest.get('advection_flux', 0.0)))
            
        # Rolling stats
        for w in [3, 6, 12, 24]:
            start_i = max(0, n_buf - w)
            sub = self.buffer[start_i:]
            pm25_arr = [float(r.get('pm25', 50.0)) for r in sub]
            pm10_arr = [float(r.get('pm10', 80.0)) for r in sub]
            ws_arr = [float(r.get('wind_speed', 2.5)) for r in sub]
            pblh_arr = [float(r.get('pblh', 750.0)) for r in sub]
            cml_arr = [float(r.get('cml_specific_attenuation', 0.05)) for r in sub]
            
            f_dict[f'pm25_roll_mean_{w}h'] = float(np.mean(pm25_arr))
            f_dict[f'pm25_roll_std_{w}h'] = float(np.std(pm25_arr)) if len(pm25_arr) > 1 else 0.0
            f_dict[f'pm10_roll_mean_{w}h'] = float(np.mean(pm10_arr))
            f_dict[f'wind_speed_roll_mean_{w}h'] = float(np.mean(ws_arr))
            f_dict[f'pblh_roll_mean_{w}h'] = float(np.mean(pblh_arr))
            f_dict[f'cml_attn_roll_mean_{w}h'] = float(np.mean(cml_arr))
            
        # Rates of change
        r1 = self.buffer[max(0, n_buf - 2)]
        r3 = self.buffer[max(0, n_buf - 4)]
        r6 = self.buffer[max(0, n_buf - 7)]
        
        curr_pm25 = float(latest.get('pm25', 50.0))
        curr_temp = float(latest.get('temperature', 25.0))
        curr_rsl = float(latest.get('cml_rsl_dbm', -42.5))
        curr_pblh = float(latest.get('pblh', 750.0))
        
        f_dict['pm25_diff_1h'] = curr_pm25 - float(r1.get('pm25', curr_pm25))
        f_dict['pm25_diff_3h'] = curr_pm25 - float(r3.get('pm25', curr_pm25))
        f_dict['pm25_diff_6h'] = curr_pm25 - float(r6.get('pm25', curr_pm25))
        f_dict['temp_diff_3h'] = curr_temp - float(r3.get('temperature', curr_temp))
        f_dict['cml_rsl_diff_1h'] = curr_rsl - float(r1.get('cml_rsl_dbm', curr_rsl))
        f_dict['pblh_diff_3h'] = curr_pblh - float(r3.get('pblh', curr_pblh))
        
        vector = np.array([f_dict[col] for col in self.feature_names], dtype=np.float32)
        return vector, f_dict

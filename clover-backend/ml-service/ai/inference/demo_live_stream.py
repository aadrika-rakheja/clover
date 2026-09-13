#!/usr/bin/env python3
"""
Live Streaming Pre-Processing & Continuous AI Inference Simulation
Demonstrates continuous live ingestion from Open-Meteo and CAAQMS sensors,
real-time feature engineering via StreamPreprocessor,
and real-time coupled prediction with prediction intervals and weather feedback.
Outputs 'pipeline/live_coupled_forecast.json' for the web frontend.
"""

import os
import sys
import time
import json
import requests
import numpy as np
import pandas as pd
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.live_engine import CoupledLiveEngine

def fetch_live_open_meteo(lat=28.474, lon=77.504):
    """Fetches current real-time atmospheric observation from Open-Meteo for Greater Noida."""
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,rain,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=boundary_layer_height,direct_radiation&timezone=Asia%2FKolkata"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        curr = data.get('current', {})
        hourly = data.get('hourly', {})
        pblh_arr = hourly.get('boundary_layer_height', [600.0])
        sol_arr = hourly.get('direct_radiation', [120.0])
        
        return {
            'time': curr.get('time', datetime.now().isoformat()),
            'temperature': curr.get('temperature_2m', 26.5),
            'relative_humidity': curr.get('relative_humidity_2m', 60.0),
            'dew_point': curr.get('dew_point_2m', 18.0),
            'surface_pressure': curr.get('surface_pressure', 1004.0),
            'precipitation': curr.get('precipitation', 0.0),
            'wind_speed': curr.get('wind_speed_10m', 2.8),
            'wind_direction': curr.get('wind_direction_10m', 315.0),
            'solar_radiation': sol_arr[0] if len(sol_arr) > 0 else 150.0,
            'cloud_cover': curr.get('cloud_cover', 25.0),
            'pblh': pblh_arr[0] if len(pblh_arr) > 0 else 750.0,
        }
    except Exception as e:
        print(f"Notice: Using simulated live weather reading: {e}")
        return {
            'time': datetime.now().isoformat(),
            'temperature': 27.2,
            'relative_humidity': 62.0,
            'dew_point': 19.1,
            'surface_pressure': 1005.2,
            'precipitation': 0.0,
            'wind_speed': 2.4,
            'wind_direction': 310.0,
            'solar_radiation': 280.0,
            'cloud_cover': 20.0,
            'pblh': 850.0,
        }

def run_live_simulation(num_steps=12, interval_sec=1):
    print("================================================================")
    print(" LIVE PRE-PROCESSING & CONTINUOUS COUPLED AI INFERENCE ENGINE   ")
    print("================================================================")
    
    engine = CoupledLiveEngine(models_dir="ai/saved_models")
    
    # Warm up buffer with recent realistic hourly trace (24 hours)
    print("\n1. Pre-filling stream pre-processor with last 24h baseline context...")
    base_time = datetime.now() - pd.Timedelta(hours=24)
    for h in range(24):
        t = base_time + pd.Timedelta(hours=h)
        warm_record = {
            'time': t.isoformat(),
            'temperature': 24.0 + np.sin(h/4)*4,
            'relative_humidity': 65.0 - np.sin(h/4)*15,
            'dew_point': 17.0,
            'surface_pressure': 1003.0,
            'precipitation': 0.0,
            'wind_speed': 2.2 + np.sin(h/3)*0.8,
            'wind_direction': 315.0,
            'solar_radiation': max(0, np.sin((h-6)*np.pi/12)*600),
            'cloud_cover': 20.0,
            'pblh': 400.0 + max(0, np.sin((h-6)*np.pi/12)*1100),
            'pm25': 165.0 + np.sin(h/3)*35,
            'pm10': 260.0 + np.sin(h/3)*45,
            'no2': 55.0,
            'so2': 14.0,
            'co': 1.8,
            'o3': 40.0,
            'voc': 85.0,
            'cml_rsl_dbm': -43.1,
            'cml_specific_attenuation': 0.065
        }
        engine.ingest(warm_record)
        
    print("Stream Pre-processor warmed up with 24 hours of temporal memory.")
    
    print("\n2. Beginning live incoming stream simulation...")
    for step in range(num_steps):
        live_wx = fetch_live_open_meteo()
        
        # Inject live CAAQMS & CML reading
        live_reading = dict(live_wx)
        live_reading.update({
            'pm25': 178.0 + np.random.normal(0, 4.0),
            'pm10': 285.0 + np.random.normal(0, 7.0),
            'no2': 58.0 + np.random.normal(0, 2.0),
            'so2': 14.5,
            'co': 1.9,
            'o3': 42.0,
            'voc': 90.0,
            'cml_rsl_dbm': -43.4,
            'cml_specific_attenuation': 0.072
        })
        
        # Step A: Ingest into Continuous Streaming Pre-Processor
        engine.ingest(live_reading)
        
        # Step B: Run Coupled Inference
        pred_state = engine.predict_current_state()
        
        obs = pred_state['current_observations']
        fb = pred_state['weather_feedbacks']
        anom = pred_state['anomaly_detection']
        fc24 = pred_state['multi_horizon_forecasts'].get('24h', {})
        fc72 = pred_state['multi_horizon_forecasts'].get('72h', {})
        
        print(f"\n--- [T+{step*5}m Stream Pulse] Live Time: {live_reading['time']} ---")
        print(f"Current AQI: {obs['aqi']} ({obs['aqi_category']['label']}) | PM2.5: {obs['pm25']} ug/m3 | Temp: {obs['temperature']}°C")
        print(f"Ventilation Index: {obs['ventilation_index']} m2/s | Inversion Risk: {obs['is_inversion_risk']}")
        print(f"Forecast +24h AQI Interval: [{fc24.get('aqi_uncertainty_interval', {}).get('p10_lower')} - {fc24.get('aqi_uncertainty_interval', {}).get('p90_upper')}] (Median: {fc24.get('aqi_uncertainty_interval', {}).get('p50_median')})")
        print(f"Forecast +72h AQI Interval: [{fc72.get('aqi_uncertainty_interval', {}).get('p10_lower')} - {fc72.get('aqi_uncertainty_interval', {}).get('p90_upper')}] (Median: {fc72.get('aqi_uncertainty_interval', {}).get('p50_median')})")
        print(f"Aerosol-Weather Feedback: Temp Depression: -{fb['temp_depression_celsius']}°C | PBLH Suppression: -{fb['pblh_suppression_meters']}m | Visibility: {fb['koschmieder_visibility_km']} km")
        print(f"Anomaly Status: {anom['status']} (Score: {anom['anomaly_score']:.3f})")
        
        # Export live forecast payload for web UI
        os.makedirs("pipeline", exist_ok=True)
        with open("pipeline/live_coupled_forecast.json", "w") as f:
            json.dump(pred_state, f, indent=2)
            
        if interval_sec > 0:
            time.sleep(interval_sec)
            
    print("\nLive coupled forecast JSON written to 'pipeline/live_coupled_forecast.json'!")

if __name__ == "__main__":
    run_live_simulation(num_steps=3, interval_sec=0)

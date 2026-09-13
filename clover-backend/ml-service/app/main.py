"""
Clover ML Forecast Service — FastAPI App
Integrates PyTorch GRU Neural Network, Scikit-Learn Quantile Regressors,
Isolation Forest Anomaly Detector, and CML Microwave Link Atmospheric Physics.
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from math import exp
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Add parent directory to sys.path so 'ai' package can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

app = FastAPI(
    title="CLOVER Air Quality & Weather Coupled AI Engine",
    version="2.0.0",
    description="72-Hour PM2.5 & AQI Coupled Forecasting, CML Link Attenuation, and Anomaly Detection"
)

# Attempt to load CoupledLiveEngine from AI module
engine = None
try:
    from ai.inference.live_engine import CoupledLiveEngine
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ai/saved_models"))
    if not os.path.exists(models_dir):
        models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../ai/saved_models"))
    if os.path.exists(models_dir):
        engine = CoupledLiveEngine(models_dir=models_dir)
        print(f"[ML Service] Successfully loaded CoupledLiveEngine from {models_dir}")
except Exception as err:
    print(f"[ML Service] Notice: Running with built-in atmospheric coupled baseline ({err})")


class Features(BaseModel):
    pm25: float = Field(ge=0, le=2000)
    pm10: Optional[float] = Field(default=None, ge=0, le=3000)
    temperatureC: Optional[float] = None
    humidityPct: Optional[float] = Field(default=None, ge=0, le=100)
    windSpeedMs: Optional[float] = Field(default=None, ge=0)
    windDirectionDeg: Optional[float] = Field(default=None, ge=0, le=360)
    cmlMeanRslDbm: Optional[float] = None
    cmlHealthyLinks: int = Field(default=0, ge=0)


class ForecastRequest(BaseModel):
    stationId: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    features: Features
    horizons: List[int] = Field(default_factory=lambda: list(range(73)), min_length=1, max_length=73)


def aqi_from_pm25(pm25: float) -> int:
    bands = [
        (0, 30, 0, 50),
        (31, 60, 51, 100),
        (61, 90, 101, 200),
        (91, 120, 201, 300),
        (121, 250, 301, 400),
        (251, 500, 401, 500)
    ]
    for lo, hi, alo, ahi in bands:
        if pm25 <= hi:
            return round(((ahi - alo) / (hi - lo)) * (pm25 - lo) + alo)
    return 500


def fallback_forecast_pm25(f: Features, hour: int) -> float:
    wind_factor = max(0.70, 1.0 - (f.windSpeedMs or 1.5) * 0.035)
    humidity_factor = 1.0 + max(0.0, (f.humidityPct or 50.0) - 60.0) * 0.003
    cml_factor = 1.0 - min(0.08, max(0, f.cmlHealthyLinks) * 0.01)
    persistence = 0.72 * exp(-hour / 20.0)
    climatology = 95.0 + 12.0 * ((hour % 24) in range(7, 11))
    return round(max(1.0, (f.pm25 * persistence + climatology * (1.0 - persistence)) * wind_factor * humidity_factor * cml_factor), 1)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "clover-ml-fastapi",
        "engineLoaded": bool(engine is not None),
        "modelVersion": "coupled-gru-quantile-2.0" if engine else "baseline-fusion-1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/v1/forecast")
def forecast(request: ForecastRequest):
    if any(h < 0 or h > 72 for h in request.horizons):
        raise HTTPException(422, "Forecast horizons must be between 0 and 72")

    issued = datetime.now(timezone.utc)
    horizons_sorted = sorted(set(request.horizons))
    forecast_results = []

    # If CoupledLiveEngine is active, ingest features
    if engine:
        try:
            raw_rec = {
                "time": issued.isoformat(),
                "pm25": request.features.pm25,
                "pm10": request.features.pm10 or (request.features.pm25 * 1.6),
                "temperature": request.features.temperatureC or 25.0,
                "relative_humidity": request.features.humidityPct or 50.0,
                "wind_speed": request.features.windSpeedMs or 2.5,
                "wind_direction": request.features.windDirectionDeg or 315.0,
                "cml_rsl_dbm": request.features.cmlMeanRslDbm or -42.5
            }
            engine.ingest(raw_rec)
            prediction_state = engine.predict_current_state()

            for h in horizons_sorted:
                h_str = f"{h}h"
                h_data = prediction_state.get('multi_horizon_forecasts', {}).get(h_str)
                if h_data:
                    pm25_val = h_data['pm25_uncertainty_interval']['p50_median']
                    aqi_val = h_data['aqi_uncertainty_interval']['p50_median']
                else:
                    pm25_val = fallback_forecast_pm25(request.features, h)
                    aqi_val = aqi_from_pm25(pm25_val)

                forecast_results.append({
                    "horizonHours": h,
                    "validAt": (issued + timedelta(hours=h)).isoformat(),
                    "pm25": pm25_val,
                    "aqi": aqi_val
                })

            return {
                "stationId": request.stationId,
                "issuedAt": issued.isoformat(),
                "modelVersion": "coupled-gru-quantile-2.0",
                "disclaimer": "CML/RSL is an atmospheric covariate, not a direct PM2.5 measurement.",
                "forecast": forecast_results,
                "coupledState": prediction_state
            }
        except Exception as ex:
            print(f"[ML Service] Engine prediction warning: {ex}. Falling back to baseline.")

    # Standard / Fallback response format
    for h in horizons_sorted:
        pm25_val = fallback_forecast_pm25(request.features, h)
        forecast_results.append({
            "horizonHours": h,
            "validAt": (issued + timedelta(hours=h)).isoformat(),
            "pm25": pm25_val,
            "aqi": aqi_from_pm25(pm25_val)
        })

    return {
        "stationId": request.stationId,
        "issuedAt": issued.isoformat(),
        "modelVersion": "baseline-fusion-1.0",
        "disclaimer": "CML/RSL is an atmospheric covariate, not a direct PM2.5 measurement.",
        "forecast": forecast_results
    }

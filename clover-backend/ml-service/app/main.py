"""Deterministic inference baseline. Replace forecast_pm25 with the trained model loader in production."""
from datetime import datetime, timedelta, timezone
from math import exp
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Clover ML Forecast Service", version="1.0.0")

class Features(BaseModel):
    pm25: float = Field(ge=0, le=2000)
    temperatureC: float | None = None
    humidityPct: float | None = Field(default=None, ge=0, le=100)
    windSpeedMs: float | None = Field(default=None, ge=0)
    cmlMeanRslDbm: float | None = None
    cmlHealthyLinks: int = Field(default=0, ge=0)

class ForecastRequest(BaseModel):
    stationId: str
    lat: float | None = None
    lon: float | None = None
    features: Features
    horizons: list[int] = Field(default_factory=lambda: list(range(73)), min_length=1, max_length=73)

def aqi_from_pm25(pm25: float) -> int:
    # CPCB-style PM2.5 bands, linear interpolation.
    bands = [(0,30,0,50),(31,60,51,100),(61,90,101,200),(91,120,201,300),(121,250,301,400),(251,500,401,500)]
    for lo, hi, alo, ahi in bands:
        if pm25 <= hi: return round(((ahi-alo)/(hi-lo))*(pm25-lo)+alo)
    return 500

def forecast_pm25(f: Features, hour: int) -> float:
    wind_factor = max(0.70, 1 - (f.windSpeedMs or 1.5) * .035)
    humidity_factor = 1 + max(0, (f.humidityPct or 50) - 60) * .003
    cml_factor = 1 - min(.08, max(0, f.cmlHealthyLinks) * .01) # coupling signal, never treats CML as PM sensor
    persistence = 0.72 * exp(-hour / 20)
    climatology = 95 + 12 * ((hour % 24) in range(7, 11))
    return round(max(1, (f.pm25 * persistence + climatology * (1-persistence)) * wind_factor * humidity_factor * cml_factor), 1)

@app.get("/health")
def health(): return {"status":"ok", "modelVersion":"baseline-fusion-1.0"}

@app.post("/v1/forecast")
def forecast(request: ForecastRequest):
    if any(h < 0 or h > 72 for h in request.horizons): raise HTTPException(422, "Forecast horizons must be between 0 and 72")
    issued = datetime.now(timezone.utc)
    return {"stationId":request.stationId,"issuedAt":issued.isoformat(),"modelVersion":"baseline-fusion-1.0","disclaimer":"CML/RSL is an atmospheric covariate, not a direct PM2.5 measurement.","forecast":[{"horizonHours":h,"validAt":(issued+timedelta(hours=h)).isoformat(),"pm25":forecast_pm25(request.features,h),"aqi":aqi_from_pm25(forecast_pm25(request.features,h))} for h in sorted(set(request.horizons))]}

# CLOVER

CLOVER is a Delhi NCR / Greater Noida air-quality intelligence dashboard. It combines air-quality station readings, weather observations, and Commercial Microwave Link (CML) telemetry to show current conditions, alerts, CML health, and PM2.5/AQI forecasts for up to 72 hours.

The runnable application is composed of three services:

| Component | Directory | Default URL | Role |
| --- | --- | --- | --- |
| Frontend | `clover-frontend/` | `http://localhost:5173` | Vite-served React dashboard using CDN-loaded browser libraries |
| API | `clover-backend/` | `http://localhost:4000` | Node.js / Express API, MongoDB persistence, Redis-aware caching setup |
| ML service | `clover-backend/ml-service/` | `http://localhost:8000` | FastAPI forecast service called by the API |
| Data stores | Docker services | MongoDB `27017`, Redis `6379` | Persistent telemetry and optional cache |

The repository also contains `backend/`, `ai/`, and `ai_train/` directories. The supported integrated application is `clover-backend/` + `clover-frontend/`, as referenced by the top-level Compose file and frontend API client.

## Prerequisites

Choose one run method:

- **Docker (recommended):** Docker Engine with Docker Compose v2.
- **Local development:** Node.js 22+ (the backend Docker image uses Node 22), npm, Python 3.12+, MongoDB 7+, and optionally Redis 7+.

The frontend loads Tailwind, React, Leaflet, Chart.js, GSAP, Lenis, and Babel from public CDNs at runtime, so an internet connection is needed to render those libraries in a browser.

## Quick start with Docker

From the `clover/` directory:

```bash
docker compose up --build
```

This starts MongoDB, Redis, the API, and the FastAPI ML service. Then start the frontend separately:

```bash
cd clover-frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/health` to the API at port 4000.

Seed the bundled demonstration stations, CML links, and observations in a second terminal after the stack is ready:

```bash
cd clover-backend
npm install
npm run seed
```

The seed command uses the default local MongoDB address, so it works with the Compose MongoDB port mapping. It is safe to repeat for station and CML metadata, but it intentionally inserts another set of timestamped sample observations on each run.

Verify the running services:

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
```

To stop the stack while retaining database volumes:

```bash
docker compose down
```

To remove the containers **and** persisted MongoDB/Redis volumes:

```bash
docker compose down -v
```

## Local development

Run the three application processes in separate terminals. Start MongoDB first; Redis is optional because the API falls back if Redis cannot connect.

### 1. Configure and start the backend

```bash
cd clover-backend
cp .env.example .env
npm install
npm run dev
```

`npm run dev` uses Nodemon. Use `npm start` for a non-watching server.

### 2. Start the ML service

```bash
cd clover-backend/ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

### 3. Seed the local database (optional, for demo data)

```bash
cd clover-backend
npm run seed
npm run db:check
```

### 4. Start the frontend

```bash
cd clover-frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

## Configuration

Copy `clover-backend/.env.example` to `clover-backend/.env`. These are the environment variables read by the backend:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime mode; production changes database connection timeout behavior. |
| `PORT` | `4000` | Express API port. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/clover` | MongoDB connection string. |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:3000` | Comma-separated browser origins allowed by the API. |
| `PREDICTION_SERVICE_URL` | `http://localhost:8000` | FastAPI service base URL. |
| `ML_SERVICE_URL` | `http://localhost:8000` | Supported legacy alias, used only when `PREDICTION_SERVICE_URL` is absent. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `127.0.0.1` / `6379` / empty | Redis connection settings. |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, or `debug`. |

For the Docker stack, service host names are supplied automatically: MongoDB is `mongodb`, Redis is `redis`, and the ML service is `ai-service`.

For a separately deployed frontend, define `window.CLOVER_API_URL` before `src/services/api.js` loads in `clover-frontend/index.html`, for example:

```html
<script>window.CLOVER_API_URL = 'https://api.example.com';</script>
```

Without it, the frontend uses relative URLs when served over HTTP (ideal for the Vite proxy or a same-origin deployment), and falls back to `http://localhost:4000` when opened directly from `file://`.

## Data and forecasts

MongoDB stores three source types: `aq_station`, `weather`, and `cml`. The API accepts either a JSON array or an `{ "observations": [...] }` envelope at the ingestion endpoint. Common vendor names such as `station_id`, `timestamp`, `pm2_5`, `temperature`, `humidity`, `rsl`, and `frequency` are normalized to the API schema.

Example ingestion request:

```bash
curl -X POST http://localhost:4000/api/v1/ingestion/observations \
  -H 'Content-Type: application/json' \
  -d '{
    "observations": [
      {
        "source": "aq_station",
        "deviceId": "ncr_gnoida_kp3",
        "observedAt": "2026-09-13T10:00:00Z",
        "pm25": 115,
        "pm10": 178,
        "latitude": 28.474,
        "longitude": 77.504
      },
      {
        "source": "weather",
        "deviceId": "weather_gnoida_main",
        "temperatureC": 29,
        "humidityPct": 68,
        "windSpeedMs": 2.1
      }
    ]
  }'
```

An AQ observation needs a numeric `pm25`. A CML observation needs numeric `rslDbm` and `frequencyGhz`. CML health is `healthy` only if its newest observation is less than 15 minutes old and has quality at least `0.8`; otherwise it is `degraded` or `offline`.

Forecast requests are proxied from Express to FastAPI. `stationId` is required; `features.pm25` is required unless the API can find a current AQ observation for that station:

```bash
curl -X POST http://localhost:4000/api/v1/predictions \
  -H 'Content-Type: application/json' \
  -d '{
    "stationId": "ncr_gnoida_kp3",
    "horizons": [0, 6, 24, 72],
    "features": {
      "pm25": 115,
      "temperatureC": 29,
      "humidityPct": 68,
      "windSpeedMs": 2.1,
      "cmlMeanRslDbm": -48.2,
      "cmlHealthyLinks": 4
    }
  }'
```

The FastAPI service runs a built-in baseline forecast when optional trained-model imports or model assets are unavailable. Check `http://localhost:8000/health`: `engineLoaded: false` and model version `baseline-fusion-1.0` mean the baseline is in use. This is the expected behavior for the supplied ML Docker image, which installs only the FastAPI runtime and copies only the `app/` directory.

## API reference

All routes return JSON. API routes below are prefixed with `/api/v1`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` or `/api/v1/health` | API status and configured prediction-service URL. |
| GET | `/api/v1/dashboard` | Stations, latest AQ/weather/CML data, generated PM2.5 alerts, and summary counts. |
| GET | `/api/v1/stations` | Active monitoring stations. |
| GET | `/api/v1/stations/:stationId` | Station metadata plus its latest AQ observation. |
| GET | `/api/v1/weather` | Up to 100 newest weather observations. |
| GET | `/api/v1/observations/latest?source=aq_station&limit=100` | Latest observations; `source` may be `aq_station`, `weather`, or `cml`; max limit is 1000. |
| POST | `/api/v1/ingestion/observations` | Batch telemetry ingestion; returns `201`, or `207` if individual records were rejected. |
| GET | `/api/v1/cml/links` | Active CML link definitions with computed health. |
| POST | `/api/v1/cml/links` | Upsert CML metadata (`linkId`, `from`, `to`, `frequencyGhz`, `baselineRslDbm`). |
| GET | `/api/v1/cml/links/:linkId/health` | Current CML link health. |
| POST | `/api/v1/predictions` | Generate a 0–72-hour PM2.5 / AQI forecast through the ML service. |

The API applies a global rate limit of 300 requests per IP per 15 minutes. Error responses use `{ "error": { "message": "..." } }`.

## Troubleshooting

- **The dashboard reports API unavailable:** confirm `curl http://localhost:4000/health` works, then ensure the frontend is running on port 5173 or its origin appears in `CORS_ORIGIN`.
- **No stations or readings appear:** start MongoDB and run `npm run seed`, or ingest real observations. The backend can start without MongoDB, but database-backed requests require it to be reachable.
- **Forecast responds with 503:** start the ML service and confirm `PREDICTION_SERVICE_URL` points to it. Local default: `http://localhost:8000`; Docker default: `http://ai-service:8000` from inside the backend container.
- **CML links show offline after seeding:** sample CML observations become stale after 15 minutes by design. Seed again or ingest current CML readings.
- **`npm run db:check` fails:** set a valid `MONGODB_URI` in `clover-backend/.env`; the check script requires an actual MongoDB connection.
- **Port conflict:** change `PORT` for the API and align Vite's proxy / `CLOVER_API_URL`, or stop the process holding ports 4000, 5173, 8000, 27017, or 6379.

## Useful commands

```bash
# Backend
cd clover-backend
npm run dev       # watch mode
npm start         # normal server
npm run seed      # seed demo reference data and observations
npm run db:check  # inspect collections and samples
npm run db:cleanup

# Frontend
cd ../clover-frontend
npm run dev
npm run build
npm run preview
```

`db:cleanup` is a database-maintenance command. Review `clover-backend/db/cleanup.js` before using it against any non-development database.

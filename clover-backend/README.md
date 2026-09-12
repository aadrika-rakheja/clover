# Clover backend

Production-oriented JavaScript/Express API backed by MongoDB. Node handles API, ingestion, validation, CML health, and orchestration; the separately maintained Python model stays isolated behind `src/services/ai/predictionService.js`.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Or run MongoDB, the API, and the Python prediction service together:

```bash
docker compose up --build
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Service liveness |
| GET | `/api/v1/dashboard` | Dashboard stations, live observations, alerts and counts |
| GET | `/api/v1/stations` | Active monitoring stations |
| GET | `/api/v1/stations/:stationId` | Station and latest AQ reading |
| GET | `/api/v1/weather` | Latest weather stream data |
| GET | `/api/v1/observations/latest?source=aq_station` | Filtered latest telemetry |
| POST | `/api/v1/ingestion/observations` | Normalized batch AQ, weather or CML ingestion |
| GET/POST | `/api/v1/cml/links` | CML network links |
| GET | `/api/v1/cml/links/:linkId/health` | CML freshness/quality health |
| POST | `/api/v1/predictions` | Proxy request to Python prediction API |

The API does not seed or generate fake readings. Data is supplied only through ingestion or external integrations. Set `MONGODB_URI`, `PREDICTION_SERVICE_URL`, and `CORS_ORIGIN` in `.env` for each environment.

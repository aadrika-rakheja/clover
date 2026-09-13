# CLOVER Backend API

The backend API for **CLOVER — Delhi NCR Air Pollution–Weather Coupled Forecasting System**.

Built with **Node.js**, **Express.js**, **MongoDB / Mongoose**, **Redis**, and **Python FastAPI (AI Service)**.

---

## 🛠️ Quick Start

### 1. Prerequisites
- Node.js (v18+)
- Python 3.10+ (for AI service)
- MongoDB 7+ (optional, server auto-recovers if offline)
- Redis 7+ (optional, cache falls back automatically)

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Install Dependencies & Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

### 4. Health Check
Once running, verify backend health:
```bash
curl http://localhost:4000/api/v1/health
```

---

## 🐳 Docker Compose Startup

To run the complete ecosystem (Backend, AI Service, MongoDB, Redis):

```bash
docker-compose up --build
```

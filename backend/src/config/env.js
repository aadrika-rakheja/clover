import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clover',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim()),
  predictionServiceUrl: (
    process.env.PREDICTION_SERVICE_URL ||
    process.env.ML_SERVICE_URL ||
    'http://localhost:8000'
  ).replace(/\/$/, ''),
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || '',
  logLevel: process.env.LOG_LEVEL || 'info',
};

// src/config/env.ts
import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

export const ENV = {
  PORT: process.env.PORT || '4000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  /** Comma-separated frontend origins, e.g. https://app.vercel.app,http://localhost:5173 */
  CORS_ORIGIN: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_VERCEL: Boolean(process.env.VERCEL),
  IS_PROD: isProd,
};

if (isProd) {
  if (!ENV.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (!ENV.JWT_SECRET || ENV.JWT_SECRET === 'dev-secret') {
    throw new Error('JWT_SECRET must be set to a strong secret in production');
  }
}

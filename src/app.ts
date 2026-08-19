// src/app.ts
import express from 'express';
import morgan from 'morgan';

import { ENV } from './config/env.js';
import authRouter from './modules/auth/auth.routes.js';
import reportsRouter from './modules/reports/reports.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import matchesRouter from './modules/matching/matching.routes.js';
import verificationRouter from './modules/matching/verification.routes.js';

const app = express();

// 1. Comprehensive CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;

  const defaultOrigins = [
    'https://pm-project-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];

  const envOrigins = (ENV.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

  let isAllowed = false;

  if (!origin) {
    // Non-browser, curl, server-to-server
    isAllowed = true;
  } else {
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes('*') || allowedOrigins.includes(normalizedOrigin)) {
      isAllowed = true;
    } else {
      try {
        const hostname = new URL(origin).hostname;
        if (hostname.endsWith('.vercel.app') || hostname === 'localhost' || hostname === '127.0.0.1') {
          isAllowed = true;
        }
      } catch {
        if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
          isAllowed = true;
        }
      }
    }
  }

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] ||
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Headers, Access-Control-Request-Method'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Immediately fulfill OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    if (isAllowed) {
      res.status(204).end();
      return;
    } else {
      res.status(403).json({ error: `Origin '${origin}' not allowed by CORS` });
      return;
    }
  }

  next();
});

// Logging & Body Parsers
app.use(morgan(ENV.IS_PROD ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

// Health Check Endpoints (returns status: success)
app.get(['/', '/health', '/healthz', '/api/health'], (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'LostFound backend is running and healthy',
    timestamp: new Date().toISOString(),
    service: 'gim-lostfound-backend',
  });
});

// Module Routes
app.use('/auth', authRouter);
app.use('/reports', reportsRouter);
app.use('/notifications', notificationsRouter);
app.use('/matches', matchesRouter);
app.use('/matches', verificationRouter);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global Error Handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.message.includes('CORS') ? 403 : 500;
  res.status(status).json({
    error: ENV.IS_PROD && status === 500 ? 'Internal server error' : err.message,
  });
});

export default app;

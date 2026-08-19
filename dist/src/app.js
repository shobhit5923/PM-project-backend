// src/app.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ENV } from './config/env.js';
import authRouter from './modules/auth/auth.routes.js';
import reportsRouter from './modules/reports/reports.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import matchesRouter from './modules/matching/matching.routes.js';
import verificationRouter from './modules/matching/verification.routes.js';
const app = express();
const defaultOrigins = [
    'https://pm-project-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
];
const envOrigins = ENV.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins].map((o) => o.replace(/\/$/, ''))));
// 1. CORS middleware must run before any host or route middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser requests (e.g. server-to-server, curl, Postman)
        if (!origin) {
            callback(null, true);
            return;
        }
        const normalizedOrigin = origin.replace(/\/$/, '');
        try {
            const hostname = new URL(origin).hostname;
            if (allowedOrigins.includes(normalizedOrigin) ||
                allowedOrigins.includes('*') ||
                hostname.endsWith('.vercel.app') ||
                hostname === 'localhost' ||
                hostname === '127.0.0.1') {
                callback(null, true);
                return;
            }
        }
        catch {
            // Fallback for invalid URL strings
            if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
                callback(null, true);
                return;
            }
        }
        callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 204,
}));
// 2. Host header middleware
const defaultHosts = [
    'pm-project-backend.vercel.app',
    'localhost',
    '127.0.0.1',
];
const envHosts = ENV.ALLOWED_HOSTS
    .split(',')
    .map((host) => host.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''))
    .filter(Boolean);
const allowedHosts = Array.from(new Set([...defaultHosts, ...envHosts]));
app.use((req, res, next) => {
    // Always allow preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        next();
        return;
    }
    if (!allowedHosts.length || allowedHosts.includes('*')) {
        next();
        return;
    }
    const hostHeader = req.headers.host || req.hostname || '';
    if (!hostHeader) {
        next();
        return;
    }
    const hostWithoutPort = hostHeader.split(':')[0];
    const isAllowed = allowedHosts.includes(hostWithoutPort) ||
        allowedHosts.includes(hostHeader) ||
        allowedHosts.includes('*') ||
        hostWithoutPort.endsWith('.vercel.app') ||
        hostWithoutPort === 'localhost' ||
        hostWithoutPort === '127.0.0.1';
    if (isAllowed) {
        next();
        return;
    }
    res.status(403).json({ error: `Host '${hostHeader}' is not allowed` });
});
app.use(morgan(ENV.IS_PROD ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'gim-lostfound-backend' });
});
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'LostFound backend is running' });
});
app.use('/auth', authRouter);
app.use('/reports', reportsRouter);
app.use('/notifications', notificationsRouter);
app.use('/matches', matchesRouter);
app.use('/matches', verificationRouter);
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
app.use((err, _req, res, _next) => {
    console.error(err);
    const status = err.message.includes('CORS') ? 403 : 500;
    res.status(status).json({
        error: ENV.IS_PROD && status === 500 ? 'Internal server error' : err.message,
    });
});
export default app;

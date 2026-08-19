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
const allowedOrigins = ENV.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length
        ? (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                callback(null, true);
                return;
            }
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
        : true,
    credentials: true,
}));
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

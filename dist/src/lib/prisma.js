// src/lib/prisma.ts
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { ENV } from '../config/env.js';
const isLocal = ENV.DATABASE_URL.includes('localhost') || ENV.DATABASE_URL.includes('127.0.0.1');
const pool = new pg.Pool({
    connectionString: ENV.DATABASE_URL,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    // Keep serverless connection usage low on Vercel
    max: ENV.IS_VERCEL ? 1 : 10,
    idleTimeoutMillis: ENV.IS_VERCEL ? 5000 : 30000,
    connectionTimeoutMillis: 15000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
export default prisma;

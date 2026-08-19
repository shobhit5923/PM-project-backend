// src/modules/auth/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';

export interface AuthRequest extends Request {
  userId?: number | string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No auth header' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid auth header' });

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    console.log('Authenticated userId:', req.userId);
    next();
  } catch {
       console.log('Authenticated userId:', req.userId);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

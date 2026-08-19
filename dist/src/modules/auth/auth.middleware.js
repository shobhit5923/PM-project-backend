import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: 'No auth header' });
    const token = authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Invalid auth header' });
    try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET);
        req.userId = decoded.userId;
        console.log('Authenticated userId:', req.userId);
        next();
    }
    catch {
        console.log('Authenticated userId:', req.userId);
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { registerUser, loginUser } from './auth.service.js';
const router = Router();
// POST /auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body || {};
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }
        if (typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }
        if (typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }
        const result = await registerUser(name, email, password, phone);
        res.status(201).json(result);
    }
    catch (err) {
        console.error('Registration error:', err);
        const message = err.message || 'Registration failed';
        const status = message.includes('already exists') || message.includes('required') || message.includes('valid') ? 400 : 500;
        res.status(status).json({ error: message });
    }
});
// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        const result = await loginUser(email, password);
        res.json(result);
    }
    catch (err) {
        console.error('Login error:', err);
        const message = err.message || 'Login failed';
        res.status(400).json({ error: message });
    }
});
export default router;

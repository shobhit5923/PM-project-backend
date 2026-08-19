// src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { ENV } from '../../config/env.js';
const SALT_ROUNDS = 10;
function toSafeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
export async function registerUser(name, email, password, phone) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
        throw new Error('An account with this email already exists.');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    try {
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                passwordHash,
                phone: phone ? phone.trim() : null,
            },
        });
        const token = jwt.sign({ userId: user.id }, ENV.JWT_SECRET, { expiresIn: '7d' });
        return { user: toSafeUser(user), token };
    }
    catch (err) {
        if (err.code === 'P2002') {
            throw new Error('An account with this email already exists.');
        }
        throw err;
    }
}
export async function loginUser(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user)
        throw new Error('Invalid email or password');
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid)
        throw new Error('Invalid email or password');
    const token = jwt.sign({ userId: user.id }, ENV.JWT_SECRET, { expiresIn: '7d' });
    return { user: toSafeUser(user), token };
}

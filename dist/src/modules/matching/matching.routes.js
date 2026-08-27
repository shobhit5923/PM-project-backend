import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { reMatchAllOpenReports } from './matching.service.js';
const router = Router();
/**
 * Redacts sensitive fields of found items for unverified claims to prevent false claims
 */
function sanitizeMatchesForUser(matches, userId) {
    return matches.map((match) => {
        const isLostOwner = Number(match.lostReport?.userId) === userId;
        const isVerified = match.status === 'VERIFIED';
        if (isLostOwner && !isVerified) {
            return {
                ...match,
                foundReport: {
                    ...match.foundReport,
                    description: '[Protected for anti-fraud security. Complete verification to unlock details.]',
                    locationText: '[Location Protected]',
                    uniqueIdentifier: match.foundReport?.uniqueIdentifier ? '••••••••' : null,
                },
            };
        }
        return match;
    });
}
// POST /matches/re-match — Trigger background retro-matching
router.post('/re-match', requireAuth, async (_req, res) => {
    reMatchAllOpenReports().catch((err) => console.error('Background retro-matching error:', err));
    res.json({ message: 'Retro-matching started in background' });
});
// Helper for type filtering (LOST, FOUND, ALL)
function buildMatchWhereClause(userId, type) {
    const normalizedType = (type || 'LOST').toUpperCase();
    if (normalizedType === 'FOUND') {
        return { foundReport: { userId } };
    }
    else if (normalizedType === 'ALL') {
        return {
            OR: [
                { lostReport: { userId } },
                { foundReport: { userId } },
            ],
        };
    }
    // Default to LOST items reported by user
    return { lostReport: { userId } };
}
// GET /matches/my — Returns matches for logged in user (supports ?type=LOST|FOUND|ALL)
router.get('/my', requireAuth, async (req, res) => {
    try {
        const userId = Number(req.userId);
        const type = req.query.type;
        // Fire background retro-matching without blocking the response
        reMatchAllOpenReports().catch((e) => console.error('Background retro-match error:', e));
        const matches = await prisma.match.findMany({
            where: buildMatchWhereClause(userId, type),
            include: {
                foundReport: true,
                lostReport: true,
                questions: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(sanitizeMatchesForUser(matches, userId));
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET /matches/found-for-me — Returns matches for logged in user (supports ?type=LOST|FOUND|ALL)
router.get('/found-for-me', requireAuth, async (req, res) => {
    try {
        const userId = Number(req.userId);
        const type = req.query.type;
        // Fire background retro-matching without blocking the response
        reMatchAllOpenReports().catch((e) => console.error('Background retro-match error:', e));
        const matches = await prisma.match.findMany({
            where: buildMatchWhereClause(userId, type),
            include: {
                foundReport: true,
                lostReport: true,
                questions: {
                    include: {
                        answers: true,
                    },
                },
            },
            orderBy: { finalScore: 'desc' },
        });
        res.json(sanitizeMatchesForUser(matches, userId));
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
export default router;

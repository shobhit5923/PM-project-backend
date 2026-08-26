import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import prisma from '../../lib/prisma.js';
import { createVerificationQuestions, submitVerificationAnswers } from './verification.service.js';
const router = Router();
function paramId(value) {
    return Array.isArray(value) ? value[0] : value;
}
// POST /matches/:id/questions
router.post('/:id/questions', requireAuth, async (req, res) => {
    try {
        const id = paramId(req.params.id);
        const match = await prisma.match.findUnique({
            where: { id },
            include: {
                lostReport: true,
                foundReport: true,
            },
        });
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        const currentUserId = Number(req.userId);
        const lostOwnerId = Number(match.lostReport?.userId);
        const foundOwnerId = Number(match.foundReport?.userId);
        // Allow participants of the match (Lost Owner or Found Finder)
        if (currentUserId !== lostOwnerId && currentUserId !== foundOwnerId) {
            return res.status(403).json({ error: 'Unauthorized: You are not a participant in this match' });
        }
        // Return existing questions if already generated
        let questions = await prisma.verificationQuestion.findMany({
            where: { matchId: match.id },
        });
        if (questions.length === 0) {
            await createVerificationQuestions(match.id);
            questions = await prisma.verificationQuestion.findMany({
                where: { matchId: match.id },
            });
        }
        res.json(questions);
    }
    catch (err) {
        res.status(400).json({ error: err.message || 'Failed to load verification questions' });
    }
});
// POST /matches/:id/answers
router.post('/:id/answers', requireAuth, async (req, res) => {
    try {
        const id = paramId(req.params.id);
        const { answers } = req.body;
        const match = await prisma.match.findUnique({
            where: { id },
            include: {
                lostReport: true,
                foundReport: true,
            },
        });
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        const currentUserId = Number(req.userId);
        const lostOwnerId = Number(match.lostReport?.userId);
        const foundOwnerId = Number(match.foundReport?.userId);
        if (currentUserId !== lostOwnerId && currentUserId !== foundOwnerId) {
            return res.status(403).json({ error: 'Unauthorized: You are not a participant in this match' });
        }
        const updatedMatch = await submitVerificationAnswers(id, answers);
        res.json(updatedMatch);
    }
    catch (err) {
        res.status(400).json({ error: err.message || 'Failed to submit verification answers' });
    }
});
export default router;

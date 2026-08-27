import { Router } from 'express';
import { requireAuth, AuthRequest } from '../auth/auth.middleware.js';
import prisma from '../../lib/prisma.js';
import { createVerificationQuestions, submitVerificationAnswers } from './verification.service.js';

const router = Router();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

// POST /matches/:id/questions — Only the lost item owner can start verification questions
router.post('/:id/questions', requireAuth, async (req: AuthRequest, res) => {
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

    // Strictly enforce: Only the Lost Item Owner can start verification to claim the item
    if (currentUserId !== lostOwnerId) {
      return res.status(403).json({
        error: 'Only the user who lost this item can start verification and claim it.',
      });
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
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to load verification questions' });
  }
});

// POST /matches/:id/answers — Only the lost item owner can submit verification answers
router.post('/:id/answers', requireAuth, async (req: AuthRequest, res) => {
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

    // Strictly enforce: Only the Lost Item Owner can submit answers to claim the item
    if (currentUserId !== lostOwnerId) {
      return res.status(403).json({
        error: 'Only the user who lost this item can submit verification answers to claim it.',
      });
    }

    const updatedMatch = await submitVerificationAnswers(id, answers);
    res.json(updatedMatch);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit verification answers' });
  }
});

export default router;

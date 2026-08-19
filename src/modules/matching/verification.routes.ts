import { Router } from 'express';
import { requireAuth, AuthRequest } from '../auth/auth.middleware.js';
import prisma from '../../lib/prisma.js';
import { createVerificationQuestions , submitVerificationAnswers } from './verification.service.js';

const router = Router();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

// POST /matches/:id/questions
router.post('/:id/questions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = paramId(req.params.id);
    const match = await prisma.match.findUnique({
      where: { id },
      include: { lostReport: true },
    });

    if (!match || Number(match.lostReport.userId) !== Number(req.userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await createVerificationQuestions(match.id);

    const questions = await prisma.verificationQuestion.findMany({
      where: { matchId: match.id },
    });

    res.json(questions);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /matches/:id/answers
router.post('/:id/answers', requireAuth, async (req: AuthRequest, res) => {
  const { answers } = req.body;

  const match = await submitVerificationAnswers(paramId(req.params.id), answers);
  res.json(match);
});


export default router;

import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth, AuthRequest } from '../auth/auth.middleware.js';
import { reMatchAllOpenReports } from './matching.service.js';

const router = Router();

/**
 * Redacts sensitive fields of found items for unverified claims to prevent false claims
 */
function sanitizeMatchesForUser(matches: any[], userId: number) {
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

// GET /matches/my
router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.userId);
    try {
      await reMatchAllOpenReports();
    } catch (e) {
      // Ignore background retro-matching errors
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { lostReport: { userId } },
          { foundReport: { userId } },
        ],
      },
      include: {
        foundReport: true,
        lostReport: true,
        questions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(sanitizeMatchesForUser(matches, userId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /matches/found-for-me
// Get all matches where the current user is involved (either as lost or found owner)
router.get('/found-for-me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.userId);
    try {
      await reMatchAllOpenReports();
    } catch (e) {
      // Ignore background retro-matching errors
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { lostReport: { userId } },
          { foundReport: { userId } },
        ],
      },
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
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

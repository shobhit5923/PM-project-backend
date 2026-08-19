import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth } from '../auth/auth.middleware.js';
const router = Router();
// GET /matches/my
router.get('/my', requireAuth, async (req, res) => {
    const matches = await prisma.match.findMany({
        where: {
            lostReport: {
                userId: Number(req.userId),
            },
        },
        include: {
            foundReport: true,
            lostReport: true,
            questions: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json(matches);
});
// GET /matches/found-for-me
// Get all FOUND reports that match user's LOST reports
router.get('/found-for-me', requireAuth, async (req, res) => {
    try {
        // Get all user's lost reports
        const lostReports = await prisma.report.findMany({
            where: { userId: Number(req.userId), type: 'LOST' },
        });
        const lostReportIds = lostReports.map((r) => r.id);
        // Get all matches where user's lost report is involved
        const matches = await prisma.match.findMany({
            where: {
                lostReportId: { in: lostReportIds },
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
        res.json(matches);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
export default router;

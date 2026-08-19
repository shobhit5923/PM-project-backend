// src/modules/notifications/notifications.routes.ts
import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth } from '../auth/auth.middleware.js';
const router = Router();
function paramId(value) {
    return Array.isArray(value) ? value[0] : value;
}
// GET /notifications
router.get('/', requireAuth, async (req, res) => {
    const notifications = await prisma.notification.findMany({
        where: { userId: Number(req.userId) },
        orderBy: { createdAt: 'desc' },
    });
    res.json(notifications);
});
// POST /notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res) => {
    const id = paramId(req.params.id);
    await prisma.notification.update({
        where: { id },
        data: { isRead: true },
    });
    res.json({ success: true });
});
export default router;

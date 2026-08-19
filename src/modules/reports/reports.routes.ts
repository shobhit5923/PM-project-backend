// src/modules/reports/reports.routes.ts
import { Router } from 'express';
import { createReport, getUserReports, getReportById, getOpenReports } from './reports.service.js';
import { requireAuth, AuthRequest } from '../auth/auth.middleware.js';
import { ReportType } from '../../generated/prisma/enums.js';
import { runMatchingForReport } from '../matching/matching.service.js';

const router = Router();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

// GET /reports — browse all open reports
router.get('/', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const reports = await getOpenReports();
    res.json(reports);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to fetch reports' });
  }
});

// POST /reports/lost
router.post('/lost', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category, brand, model, color, uniqueIdentifier, description, locationText, latitude, longitude, dateTime } = req.body;

    if (!category || !description || !locationText || !dateTime) {
      return res.status(400).json({ error: 'category, description, locationText, dateTime are required' });
    }

    const report = await createReport({
      type: ReportType.LOST,
      userId: req.userId!,
      category,
      brand,
      model,
      color,
      uniqueIdentifier,
      description,
      locationText,
      latitude,
      longitude,
      dateTime: new Date(dateTime),
    });

    let matches: Awaited<ReturnType<typeof runMatchingForReport>> = [];
    try {
      matches = await runMatchingForReport(report.id);
    } catch (error) {
      console.error('Matching failed for lost report:', report.id, error);
    }

    res.status(201).json({ ...report, matches });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create lost report' });
  }
});

// POST /reports/found
router.post('/found', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category, brand, model, color, uniqueIdentifier, description, locationText, latitude, longitude, dateTime } = req.body;

    if (!category || !description || !locationText || !dateTime) {
      return res.status(400).json({ error: 'category, description, locationText, dateTime are required' });
    }

    const report = await createReport({
      type: ReportType.FOUND,
      userId: req.userId!,
      category,
      brand,
      model,
      color,
      uniqueIdentifier,
      description,
      locationText,
      latitude,
      longitude,
      dateTime: new Date(dateTime),
    });

    let matches: Awaited<ReturnType<typeof runMatchingForReport>> = [];
    try {
      matches = await runMatchingForReport(report.id);
    } catch (error) {
      console.error('Matching failed for found report:', report.id, error);
    }

    res.status(201).json({ ...report, matches });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create found report' });
  }
});

// GET /reports/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const reports = await getUserReports(req.userId!);
  res.json(reports);
});

// GET /reports/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const report = await getReportById(paramId(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

export default router;

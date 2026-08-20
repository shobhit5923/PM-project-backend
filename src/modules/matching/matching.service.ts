// src/modules/matching/matching.service.ts
import prisma from '../../lib/prisma.js';
import { Report } from '../../generated/prisma/client.js';
import { semanticMatchScore } from '../../lib/ai/semanticMatcher.js';

const MATCH_THRESHOLD = 30;

/**
 * Simple token-overlap boost when Gemini is unavailable
 */
function textSimilarityBoost(lost: Report, found: Report): number {
  const a = `${lost.description} ${lost.brand ?? ''} ${lost.model ?? ''} ${lost.color ?? ''}`
    .toLowerCase();
  const b = `${found.description} ${found.brand ?? ''} ${found.model ?? ''} ${found.color ?? ''}`
    .toLowerCase();

  const wordsA = new Set(a.split(/\W+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\W+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  const ratio = overlap / Math.max(wordsA.size, wordsB.size);
  return Math.round(ratio * 30);
}

/**
 * Calculate base match score between LOST and FOUND reports
 */
export function calculateBaseScore(lost: Report, found: Report) {
  // 1. Check Serial / IMEI / Unique Identifier Match (Instant High Confidence)
  const isUniqueIdMatch = Boolean(
    lost.uniqueIdentifier &&
      found.uniqueIdentifier &&
      lost.uniqueIdentifier.trim().length > 3 &&
      lost.uniqueIdentifier.trim().toLowerCase() === found.uniqueIdentifier.trim().toLowerCase()
  );

  const lostCat = (lost.category || '').toLowerCase().trim();
  const foundCat = (found.category || '').toLowerCase().trim();

  const isCatMatch =
    lostCat === foundCat ||
    (lostCat.includes('electron') && foundCat.includes('electron')) ||
    (lostCat.includes('phone') && foundCat.includes('phone')) ||
    (!lostCat || !foundCat);

  // 2. Spec Match (Max 40 points)
  let specScore = 0;
  if (isCatMatch) specScore += 15;

  if (
    lost.brand &&
    found.brand &&
    lost.brand.trim().toLowerCase() === found.brand.trim().toLowerCase()
  ) {
    specScore += 15;
  }

  if (
    lost.model &&
    found.model &&
    lost.model.trim().toLowerCase() === found.model.trim().toLowerCase()
  ) {
    specScore += 10;
  }

  // 3. Context Proximity Match (Max 35 points)
  let contextScore = 0;
  if (
    lost.color &&
    found.color &&
    lost.color.trim().toLowerCase() === found.color.trim().toLowerCase()
  ) {
    contextScore += 10;
  }

  if (
    lost.locationText &&
    found.locationText &&
    (found.locationText.toLowerCase().includes(lost.locationText.toLowerCase()) ||
      lost.locationText.toLowerCase().includes(found.locationText.toLowerCase()))
  ) {
    contextScore += 15;
  }

  const diffMs = Math.abs(
    new Date(lost.dateLostFound).getTime() - new Date(found.dateLostFound).getTime()
  );
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 24) {
    contextScore += 10;
  } else if (diffHours <= 72) {
    contextScore += 5;
  }

  const baseScore = specScore + contextScore;

  return {
    baseScore,
    categoryMultiplier: 1.0,
    isUniqueIdMatch,
  };
}

/**
 * Run matching for a newly created or existing report.
 */
export async function runMatchingForReport(reportId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return [];

  const oppositeType = report.type === 'LOST' ? 'FOUND' : 'LOST';

  const candidates = await prisma.report.findMany({
    where: { type: oppositeType, status: 'OPEN' },
  });

  const createdMatches = [];

  for (const candidate of candidates) {
    const lost = report.type === 'LOST' ? report : candidate;
    const found = report.type === 'FOUND' ? report : candidate;

    const { baseScore, isUniqueIdMatch } = calculateBaseScore(lost, found);

    let finalScore = baseScore;

    if (isUniqueIdMatch) {
      finalScore = 95;
    } else {
      try {
        const probability = await semanticMatchScore(
          `${lost.category} ${lost.brand ?? ''} ${lost.model ?? ''} ${lost.color ?? ''} ${lost.description} ${lost.locationText}`,
          `${found.category} ${found.brand ?? ''} ${found.model ?? ''} ${found.color ?? ''} ${found.description} ${found.locationText}`
        );

        const aiBonus = Math.round(probability * 35);
        finalScore = Math.min(100, Math.max(0, baseScore + aiBonus));
      } catch (error) {
        console.warn('Semantic AI matching failed, using text similarity fallback:', error);
        const fallbackBonus = textSimilarityBoost(lost, found);
        finalScore = Math.min(100, Math.max(0, baseScore + fallbackBonus));
      }
    }

    if (finalScore >= MATCH_THRESHOLD) {
      const existing = await prisma.match.findFirst({
        where: {
          lostReportId: lost.id,
          foundReportId: found.id,
        },
      });
      if (existing) continue;

      const match = await prisma.match.create({
        data: {
          lostReportId: lost.id,
          foundReportId: found.id,
          baseScore,
          finalScore,
          status: 'POTENTIAL',
        },
        include: {
          lostReport: true,
          foundReport: true,
        },
      });

      createdMatches.push(match);

      await prisma.notification.create({
        data: {
          userId: lost.userId,
          type: 'MATCH_FOUND',
          payload: { matchId: match.id, score: finalScore },
        },
      });

      if (found.userId !== lost.userId) {
        await prisma.notification.create({
          data: {
            userId: found.userId,
            type: 'MATCH_FOUND',
            payload: { matchId: match.id, score: finalScore },
          },
        });
      }
    }
  }

  return createdMatches;
}

/**
 * Re-run matching across all OPEN reports in the database
 */
export async function reMatchAllOpenReports() {
  try {
    const openReports = await prisma.report.findMany({
      where: { status: 'OPEN' },
    });

    for (const report of openReports) {
      await runMatchingForReport(report.id);
    }
  } catch (err) {
    console.error('Error running retro-matching across open reports:', err);
  }
}

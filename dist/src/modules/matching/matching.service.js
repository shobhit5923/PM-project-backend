// src/modules/matching/matching.service.ts
import prisma from '../../lib/prisma.js';
import { semanticMatchScore } from '../../lib/ai/semanticMatcher.js';
const MATCH_THRESHOLD = 40;
/**
 * Simple token-overlap boost when Gemini is unavailable
 */
function textSimilarityBoost(lost, found) {
    const a = `${lost.description} ${lost.brand ?? ''} ${lost.model ?? ''} ${lost.color ?? ''}`
        .toLowerCase();
    const b = `${found.description} ${found.brand ?? ''} ${found.model ?? ''} ${found.color ?? ''}`
        .toLowerCase();
    const wordsA = new Set(a.split(/\W+/).filter((w) => w.length > 2));
    const wordsB = new Set(b.split(/\W+/).filter((w) => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0)
        return 0;
    let overlap = 0;
    for (const w of wordsA) {
        if (wordsB.has(w))
            overlap++;
    }
    const ratio = overlap / Math.max(wordsA.size, wordsB.size);
    return Math.round(ratio * 25);
}
/**
 * Calculate base match score between LOST and FOUND reports
 */
export function calculateBaseScore(lost, found) {
    let score = 0;
    if (lost.category.toLowerCase() === found.category.toLowerCase()) {
        score += 15;
    }
    if (lost.brand && found.brand && lost.brand.toLowerCase() === found.brand.toLowerCase()) {
        score += 10;
    }
    if (lost.model && found.model && lost.model.toLowerCase() === found.model.toLowerCase()) {
        score += 10;
    }
    if (lost.color && found.color && lost.color.toLowerCase() === found.color.toLowerCase()) {
        score += 5;
    }
    if (lost.uniqueIdentifier &&
        found.uniqueIdentifier &&
        lost.uniqueIdentifier === found.uniqueIdentifier) {
        score += 40;
    }
    if (lost.locationText &&
        found.locationText &&
        (found.locationText.toLowerCase().includes(lost.locationText.toLowerCase()) ||
            lost.locationText.toLowerCase().includes(found.locationText.toLowerCase()))) {
        score += 10;
    }
    const diffMs = Math.abs(new Date(lost.dateLostFound).getTime() - new Date(found.dateLostFound).getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= 24) {
        score += 5;
    }
    else if (diffHours <= 72) {
        score += 2;
    }
    return score;
}
/**
 * Run matching for a newly created report.
 * Returns any matches created for this report.
 */
export async function runMatchingForReport(reportId) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report)
        return [];
    const oppositeType = report.type === 'LOST' ? 'FOUND' : 'LOST';
    const candidates = await prisma.report.findMany({
        where: { type: oppositeType, status: 'OPEN' },
    });
    const createdMatches = [];
    for (const candidate of candidates) {
        const lost = report.type === 'LOST' ? report : candidate;
        const found = report.type === 'FOUND' ? report : candidate;
        const baseScore = calculateBaseScore(lost, found);
        let finalScore = baseScore;
        try {
            const probability = await semanticMatchScore(`${lost.category} ${lost.brand ?? ''} ${lost.model ?? ''} ${lost.color ?? ''} ${lost.description} ${lost.locationText}`, `${found.category} ${found.brand ?? ''} ${found.model ?? ''} ${found.color ?? ''} ${found.description} ${found.locationText}`);
            // AI can contribute up to ~30 points
            finalScore = baseScore + probability * 30;
        }
        catch (error) {
            console.warn('Semantic AI matching failed, using text similarity fallback:', error);
            finalScore = baseScore + textSimilarityBoost(lost, found);
        }
        if (finalScore >= MATCH_THRESHOLD) {
            const existing = await prisma.match.findFirst({
                where: {
                    lostReportId: lost.id,
                    foundReportId: found.id,
                },
            });
            if (existing)
                continue;
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

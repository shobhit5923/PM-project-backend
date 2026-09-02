import prisma from '../../lib/prisma.js';
import { generateVerificationQuestions } from '../../lib/ai/questionGenerator.js';

export async function createVerificationQuestions(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      lostReport: true,
      foundReport: true,
    },
  });

  if (!match) throw new Error('Match not found');

  const questions = await generateVerificationQuestions(
    match.lostReport.description,
    match.foundReport.description
  );

  for (const q of questions) {
    await prisma.verificationQuestion.create({
      data: {
        matchId,
        questionText: q.question,
        sensitivity: q.sensitivity,
        weight: q.sensitivity === 'HIGH' ? 15 : 5,
        expectedAnswer: q.expectedAnswer || null,
      },
    });
  }

  return questions;
}

const STOP_WORDS = new Set([
  'the', 'is', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for',
  'with', 'it', 'my', 'of', 'by', 'this', 'that', 'there', 'was', 'were',
  'item', 'lost', 'found', 'something', 'anything', 'some', 'any', 'yes', 'no'
]);

function extractKeywords(str?: string | null): string[] {
  if (!str) return [];
  return str
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Validates user's verification answer against expected answer, found item attributes, & description.
 */
function isAnswerCorrect(
  userAnswer: string,
  expectedAnswer?: string | null,
  foundDescription?: string,
  foundReport?: { category?: string | null; brand?: string | null; model?: string | null; color?: string | null; locationText?: string | null } | null
): boolean {
  if (!userAnswer || userAnswer.trim().length < 2) return false;

  const userClean = userAnswer.trim().toLowerCase();
  const userTokens = extractKeywords(userClean);
  if (userTokens.length === 0) return false;

  const genericPlaceholders = ['brand', 'color', 'model', 'location', 'contents', 'unique features'];

  // 1. Check against specific expectedAnswer if meaningful
  if (expectedAnswer && expectedAnswer.trim().length > 0) {
    const expectedClean = expectedAnswer.trim().toLowerCase();
    if (!genericPlaceholders.includes(expectedClean)) {
      if (expectedClean.includes(userClean) || userClean.includes(expectedClean)) {
        return true;
      }
      const expectedTokens = extractKeywords(expectedClean);
      if (expectedTokens.length > 0 && userTokens.some((t) => expectedTokens.includes(t))) {
        return true;
      }
    }
  }

  // 2. Check against Found Report specific fields (brand, model, color, locationText, category)
  if (foundReport) {
    const fieldsToMatch = [
      foundReport.brand,
      foundReport.model,
      foundReport.color,
      foundReport.locationText,
      foundReport.category,
    ];

    for (const field of fieldsToMatch) {
      if (field && field.trim().length > 0) {
        const fieldClean = field.trim().toLowerCase();
        if (fieldClean.includes(userClean) || userClean.includes(fieldClean)) {
          return true;
        }
        const fieldTokens = extractKeywords(fieldClean);
        if (userTokens.some((t) => fieldTokens.includes(t))) {
          return true;
        }
      }
    }
  }

  // 3. Check against Found Item Description context
  if (foundDescription && foundDescription.trim().length > 0) {
    const descClean = foundDescription.trim().toLowerCase();
    if (descClean.includes(userClean)) {
      return true;
    }
    const descTokens = extractKeywords(descClean);
    if (userTokens.some((t) => descTokens.includes(t))) {
      return true;
    }
  }

  // Incorrect answer — no matching keywords found in found item details
  return false;
}

export async function submitVerificationAnswers(
  matchId: string,
  answers: { questionId: string; answer: string }[]
) {
  let score = 0;

  const matchObj = await prisma.match.findUnique({
    where: { id: matchId },
    include: { foundReport: true },
  });

  for (const ans of answers) {
    const question = await prisma.verificationQuestion.findUnique({
      where: { id: ans.questionId },
    });

    if (!question) continue;

    const isCorrect = isAnswerCorrect(
      ans.answer,
      question.expectedAnswer,
      matchObj?.foundReport?.description,
      matchObj?.foundReport
    );

    const awarded = isCorrect ? question.weight : 0;
    score += awarded;

    await prisma.verificationAnswer.create({
      data: {
        questionId: question.id,
        userAnswer: ans.answer,
        isCorrect,
        awardedScore: awarded,
      },
    });
  }

  const currentMatch = await prisma.match.findUnique({ where: { id: matchId } });
  
  // Retain base score + AI similarity score, add ONLY the earned QA bonus score
  const previousQaBonus = currentMatch?.qaBonusScore || 0;
  const baseAndAiScore = Math.max(0, (currentMatch?.finalScore || 0) - previousQaBonus);
  const newFinalScore = Math.min(100, Math.round(baseAndAiScore + score));

  // Automatic verification status update for scores >= 85
  const newStatus = newFinalScore >= 85 ? 'VERIFIED' : (currentMatch?.status || 'POTENTIAL');

  const match = await prisma.match.update({
    where: { id: matchId },
    data: {
      qaBonusScore: score,
      finalScore: newFinalScore,
      status: newStatus,
    },
    include: {
      lostReport: true,
      foundReport: true,
    },
  });

  return match;
}

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

/**
 * Smart answer verification checking user's answer against expected answer & item description
 */
function isAnswerCorrect(
  userAnswer: string,
  expectedAnswer?: string | null,
  foundDescription?: string
): boolean {
  if (!userAnswer || userAnswer.trim().length < 2) return false;

  const normalizedUser = userAnswer.trim().toLowerCase();

  // If expected answer exists, evaluate keyword / token overlap
  if (expectedAnswer && expectedAnswer.trim().length > 0) {
    const normalizedExpected = expectedAnswer.trim().toLowerCase();
    if (normalizedExpected.includes(normalizedUser) || normalizedUser.includes(normalizedExpected)) {
      return true;
    }

    const userTokens = normalizedUser.split(/\W+/).filter((t) => t.length > 2);
    const expectedTokens = normalizedExpected.split(/\W+/).filter((t) => t.length > 2);
    const overlap = userTokens.filter((t) => expectedTokens.includes(t));

    if (overlap.length > 0) return true;
  }

  // Token overlap check against found item description context
  if (foundDescription && foundDescription.trim().length > 0) {
    const descTokens = foundDescription.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    const userTokens = normalizedUser.split(/\W+/).filter((t) => t.length > 2);
    const overlap = userTokens.filter((t) => descTokens.includes(t));

    if (overlap.length > 0) return true;
  }

  // Fallback for valid descriptive answer
  return normalizedUser.length >= 3;
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
      matchObj?.foundReport?.description
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
  const newFinalScore = Math.min(100, Math.round((currentMatch?.finalScore || 0) + score));

  const match = await prisma.match.update({
    where: { id: matchId },
    data: {
      qaBonusScore: score,
      finalScore: newFinalScore,
    },
  });

  if (match.finalScore >= 85) {
    return prisma.match.update({
      where: { id: matchId },
      data: { status: 'VERIFIED' },
    });
  }

  return match;
}

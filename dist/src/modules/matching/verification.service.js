import prisma from '../../lib/prisma.js';
import { generateVerificationQuestions } from '../../lib/ai/questionGenerator.js';
export async function createVerificationQuestions(matchId) {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            lostReport: true,
            foundReport: true,
        },
    });
    if (!match)
        throw new Error('Match not found');
    const questions = await generateVerificationQuestions(match.lostReport.description, match.foundReport.description);
    for (const q of questions) {
        await prisma.verificationQuestion.create({
            data: {
                matchId,
                questionText: q.question,
                sensitivity: q.sensitivity,
                weight: q.sensitivity === 'HIGH' ? 15 : 5,
            },
        });
    }
    return questions;
}
export async function submitVerificationAnswers(matchId, answers) {
    let score = 0;
    for (const ans of answers) {
        const question = await prisma.verificationQuestion.findUnique({
            where: { id: ans.questionId },
        });
        if (!question)
            continue;
        // Simple evaluation for now (AI-based later)
        const isCorrect = ans.answer.length > 3; // placeholder logic
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
    const match = await prisma.match.update({
        where: { id: matchId },
        data: {
            qaBonusScore: score,
            finalScore: { increment: score },
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

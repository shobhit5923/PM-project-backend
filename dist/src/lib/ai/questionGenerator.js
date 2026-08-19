import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../../config/env.js';
function getFallbackQuestions() {
    return [
        { question: 'What brand is the item?', sensitivity: 'LOW', expectedAnswer: 'brand' },
        { question: 'What color is the item?', sensitivity: 'LOW', expectedAnswer: 'color' },
        {
            question: 'Describe any unique marks, stickers, scratches, or damage on the item.',
            sensitivity: 'HIGH',
            expectedAnswer: 'unique features'
        },
        {
            question: 'Where exactly on campus did you last see or lose this item?',
            sensitivity: 'HIGH',
            expectedAnswer: 'location'
        },
        {
            question: 'What personal contents or identifying details are inside/on the item?',
            sensitivity: 'HIGH',
            expectedAnswer: 'contents'
        },
    ];
}
function parseQuestionsJson(text) {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed))
        return [];
    return parsed
        .filter((q) => q && typeof q.question === 'string')
        .map((q) => ({
        question: q.question,
        sensitivity: q.sensitivity === 'HIGH' ? 'HIGH' : 'LOW',
        expectedAnswer: typeof q.expectedAnswer === 'string' ? q.expectedAnswer : '',
    }));
}
export async function generateVerificationQuestions(lostDescription, foundDescription) {
    if (!ENV.GEMINI_API_KEY || ENV.GEMINI_API_KEY.length < 20) {
        console.warn('GEMINI_API_KEY missing/invalid — using fallback verification questions');
        return getFallbackQuestions();
    }
    try {
        const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `
You are helping verify ownership of a lost item.

Based on the descriptions below, generate 5 verification questions with expected answers derived from the found item description.
Rules:
- 3 questions must be HIGH sensitivity (only real owner knows)
- 2 questions must be LOW sensitivity (general features)
- Include expectedAnswer for each question if identifiable from the description
- Output JSON array only

Descriptions:
Lost: "${lostDescription}"
Found: "${foundDescription}"

Format:
[
  { "question": "...", "sensitivity": "HIGH", "expectedAnswer": "..." },
  { "question": "...", "sensitivity": "LOW", "expectedAnswer": "..." }
]
`;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const questions = parseQuestionsJson(text);
        if (questions.length === 0) {
            console.warn('Failed to parse Gemini questions — using fallback');
            return getFallbackQuestions();
        }
        return questions;
    }
    catch (error) {
        console.warn('Gemini question generation failed — using fallback:', error);
        return getFallbackQuestions();
    }
}

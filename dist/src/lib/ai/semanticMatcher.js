import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../../config/env.js';
export async function semanticMatchScore(lostReport, foundReport) {
    if (!ENV.GEMINI_API_KEY || ENV.GEMINI_API_KEY.length < 20) {
        throw new Error('GEMINI_API_KEY is missing or invalid');
    }
    const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `
You are an expert system for matching lost and found items.

Determine if the two descriptions refer to the SAME real-world object.
Consider:
- Brand synonyms (iphone == apple iphone)
- Model variations (iphone13 == iphone 13)
- Location semantics (gim campus == gim library)
- Human description differences

Return ONLY a number between 0 and 1 representing match probability.

Lost:
"${lostReport}"

Found:
"${foundReport}"
`;
    const result = await model.generateContent(prompt);
    console.log('Semantic match raw response:', result);
    const text = result.response.text().trim();
    const score = parseFloat(text);
    if (isNaN(score))
        return 0;
    return Math.max(0, Math.min(1, score));
}

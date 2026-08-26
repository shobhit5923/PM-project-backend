import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../../config/env.js';
export async function semanticMatchScore(lostReport, foundReport) {
    if (!ENV.GEMINI_API_KEY || ENV.GEMINI_API_KEY.length < 20) {
        throw new Error('GEMINI_API_KEY is missing or invalid');
    }
    const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
    // Timeout wrapper to prevent hanging calls
    const callWithTimeout = async () => {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const score = parseFloat(text);
        return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    };
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI matching timeout')), 3000));
    return Promise.race([callWithTimeout(), timeoutPromise]);
}

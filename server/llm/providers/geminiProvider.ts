import { GoogleGenAI } from '@google/genai';

export async function askGemini(
  apiKey: string,
  model: string,
  prompt: string,
  temperature: number
): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('No response from Gemini');
  }

  return text;
}

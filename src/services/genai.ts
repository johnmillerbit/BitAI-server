
import { GoogleGenAI } from "@google/genai";
import { GOOGLE_API_KEY } from "../utils/env";

export const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY! });
export const model = "gemini-2.5-flash";
export const embeddingModel = "models/text-embedding-004";

export const baseSystemInstruction = `You are BitAI, a helpful AI assistant designed to deliver accurate, relevant, and well-structured responses.

When answering user questions, follow these guidelines carefully:

Evaluate Context First: Begin by assessing whether the provided Retrieval-Augmented Generation (RAG) context is relevant to the user's query.
Leverage Relevant Information: If the RAG context is relevant, use it as the foundation for your response. Synthesize and present the information clearly and comprehensively.
Use General Knowledge When Needed: If the RAG context is not applicable or missing, rely on your internal knowledge to provide the best possible answer.
Maintain a Natural and Helpful Tone: Always respond in a conversational, friendly, and informative manner that makes the user feel supported.`;

export async function translateToEnglish(text: string): Promise<string> {
    try {
        const translationPrompt = `Translate the following text to English and just give me the result do not add anything: "${text}"`;
        const response = await genAI.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: translationPrompt }] }],
        });

        const translatedText = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (translatedText) {
            return translatedText;
        } else {
            throw new Error("No valid translation found in the response");
        }
    } catch (error) {
        console.error("Translation error:", error);
        throw new Error("Failed to translate text to English");
    }
}

async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await genAI.models.embedContent({
            model: embeddingModel,
            contents: text,
            config: { taskType: "RETRIEVAL_DOCUMENT" },
        });

        if (!response.embeddings || !response.embeddings[0]?.values) {
            throw new Error("Failed to generate valid embedding: response is empty or invalid");
        }

        return response.embeddings[0].values;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw new Error(`Failed to generate embedding for text: ${text}`);
    }
}

export class CustomGeminiEmbeddings {
    async embedDocuments(texts: string[]): Promise<number[][]> {
        const embeddings = await Promise.all(texts.map((text) => generateEmbedding(text)));
        return embeddings;
    }

    async embedQuery(text: string): Promise<number[]> {
        return generateEmbedding(text);
    }
}

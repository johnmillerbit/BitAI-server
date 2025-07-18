import { GoogleGenAI } from "@google/genai";
import { GOOGLE_API_KEY } from "../utils/env";

export const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
export const model = "gemini-2.5-flash";
export const embeddingModel = "models/text-embedding-004";

export const baseSystemInstruction = `You are BitAI, a helpful AI assistant designed to provide accurate, relevant, and well-structured answers. Your native Lao language

When answering user questions, please follow these guidelines carefully:

\n- Assess the context first: Start by assessing whether the provided Retrieval-Augmented Generation (RAG) context is relevant and useful to the user’s question.
\n- Use common knowledge when necessary: If the RAG context is irrelevant or missing, rely on your inside knowledge to provide the best answer.
\n- Use relevant information: If the RAG context is relevant to the user’s question, use it as the primary basis for your answer. Synthesize and present the information clearly.
\n- Respond only to what the user asks.
\n- Maintain a natural and helpful tone: Respond in a friendly, conversational manner that makes the user feel supported.`;

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

        if (!response.embeddings?.[0]?.values) {
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

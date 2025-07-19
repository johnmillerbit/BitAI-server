import { Request, Response, Router } from "express";
import { baseSystemInstruction, genAI, model, translateToEnglish } from "../services/genai";
import { initializeVectorStore } from "../services/vectorStore";
import { ChatRequestBody, StreamResponse } from "../types";
import { asyncHandler } from "../utils/asyncHandler";
import AppError from "../utils/AppError";

const router = Router();

router.post("/", asyncHandler(async (req: Request<{}, {}, ChatRequestBody>, res: Response): Promise<void> => {
    const { query, history = [] } = req.body;

    if (!query || typeof query !== "string") {
        throw new AppError("Query is required and must be a string", 400);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const vectorStore = await initializeVectorStore();
    const englishQuery = await translateToEnglish(query);
    const retrievedDocs = await vectorStore.similaritySearch(englishQuery, 9);
    const context = retrievedDocs.map((doc) => doc.pageContent).join("\n");
    const originalLanguage = retrievedDocs.map((doc) => doc.metadata.originalContent).join("\n")

    const systemInstructionWithContext = [
        {
            text: `${baseSystemInstruction}\n\nRAG Context:\n- Original language:\n ${originalLanguage}\n- English context:\n${context}`,
        },
    ];
    console.log("System Instruction with Context:", systemInstructionWithContext);

    const contents = [
        ...history.map((msg) => ({
            role: msg.role,
            parts: msg.parts.map((part) => ({ text: part.text })),
        })),
        {
            role: "user",
            parts: [{ text: query }],
        },
    ];

    const response = await genAI.models.generateContentStream({
        model,
        config: {
            thinkingConfig: {
                thinkingBudget: -1,
            },
            tools: [{ urlContext: {} }],
            responseMimeType: "text/plain",
            systemInstruction: systemInstructionWithContext,
        },
        contents,
    });

    try {
        for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
                const response: StreamResponse = { text };
                res.write(`data: ${JSON.stringify(response)}\n\n`);
            }
        }
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (error: any) {
        console.error("Error during streaming:", error);
        if (!res.headersSent) {
            throw new AppError(`Streaming error: ${error.message}`, 500);
        } else {
            res.write(`data: ${JSON.stringify({ error: `Streaming error: ${error.message}` })}\n\n`);
            res.end();
        }
    }
}));

export default router;

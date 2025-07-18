import { Router, Request, Response } from "express";
import { ChatRequestBody, StreamResponse } from "../types";
import { initializeVectorStore } from "../services/vectorStore";
import { genAI, model, baseSystemInstruction, translateToEnglish } from "../services/genai";

const router = Router();

router.post("/", async (req: Request<{}, {}, ChatRequestBody>, res: Response): Promise<void> => {
    const { query, history = [] } = req.body;

    if (!query || typeof query !== "string") {
        res.status(400).json({ error: "Query is required and must be a string" });
        return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
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

        for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
                const response: StreamResponse = { text };
                res.write(`data: ${JSON.stringify(response)}\n\n`);
            }
        }

        res.write("data: [DONE]\n\n");
        res.end();
    } catch (error: unknown) {
        console.error("Error in /chat:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error";

        if (!res.headersSent) {
            res.status(500).json({ error: errorMessage });
        } else {
            res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
            res.end();
        }
    }
});

export default router;

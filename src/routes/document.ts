
import { Router, Request, Response } from "express";
import { AddDocumentRequestBody } from "../types";
import { initializeVectorStore } from "../services/vectorStore";
import { translateToEnglish } from "../services/genai";

const router = Router();

router.post(
    "/",
    async (
        req: Request<{}, {}, AddDocumentRequestBody>,
        res: Response
    ): Promise<void> => {
        const { content, metadata = {} } = req.body;

        if (!content || typeof content !== "string") {
            res.status(400).json({
                error: "Content is required and must be a string",
            });
            return;
        }

        try {
            const vectorStore = await initializeVectorStore();
            const englishContent = await translateToEnglish(content);
            await vectorStore.addDocuments([
                {
                    pageContent: englishContent,
                    metadata: { ...metadata, originalContent: content },
                },
            ]);

            res.status(200).json({
                message: "Document added successfully",
                content: englishContent,
                metadata: { ...metadata, originalContent: content },
            });
        } catch (error: unknown) {
            console.error("Error adding document:", error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to add document to vector store";
            res.status(500).json({ error: errorMessage });
        }
    }
);

export default router;

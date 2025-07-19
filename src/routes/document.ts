import { Router, Request, Response } from "express";
import { AddDocumentRequestBody } from "../types";
import { initializeVectorStore } from "../services/vectorStore";
import { translateToEnglish } from "../services/genai";
import { requireApiKey } from "../middleware/apiKey";
import { asyncHandler } from "../utils/asyncHandler";
import { getDocuments, deleteDocument } from "../services/documents";

const router = Router();

router.post(
    "/",
    requireApiKey,
    asyncHandler(async (
        req: Request<{}, {}, AddDocumentRequestBody>,
        res: Response
    ) => {
        const { content, metadata = {} } = req.body;

        if (!content || typeof content !== "string") {
            res.status(400).json({
                error: "Content is required and must be a string",
            });
            return;
        }

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
            metadata: { ...metadata },
            originalContent: content,
        });
    })
);

router.get(
    "/",
    requireApiKey,
    asyncHandler(async (req: Request, res: Response) => {
        const documents = await getDocuments();
        res.status(200).json(documents);
    })
);

router.delete(
    "/:id",
    requireApiKey,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: "Document ID is required" });
            return;
        }
        const result = await deleteDocument(id);
        if (!result) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        res.status(200).json({ message: "Document deleted successfully" });
    })
);

export default router;

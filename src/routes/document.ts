import { Router, Request, Response } from "express";
import { AddDocumentRequestBody } from "../types";
import { initializeVectorStore } from "../services/vectorStore";
import { translateToEnglish } from "../services/genai";
import { requireApiKey } from "../middleware/apiKey";
import { asyncHandler } from "../utils/asyncHandler";
import { getDocuments, deleteDocument } from "../services/documents";
import AppError from "../utils/AppError";

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
            throw new AppError("Content is required and must be a string", 400);
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
            throw new AppError("Document ID is required", 400);
        }
        await deleteDocument(id); // deleteDocument now throws AppError for 404
        res.status(200).json({ message: "Document deleted successfully" });
    })
);

export default router;

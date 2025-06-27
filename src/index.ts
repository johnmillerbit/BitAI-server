import { GoogleGenAI } from "@google/genai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

// Define interfaces for chat requests
interface ChatMessage {
    role: "user" | "model";
    parts: Array<{ text: string }>;
}

interface ChatRequestBody {
    query: string;
    history?: ChatMessage[];
}

interface StreamResponse {
    text: string;
}

// Interface for document addition
interface AddDocumentRequestBody {
    content: string;
    metadata?: Record<string, any>;
}

// Initialize Express
const app = express();
app.use(express.json());
app.use(
    cors({
        origin: "https://bitai.millerbit.biz/",
    })
);

// Validate environment variables
if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is required");
}

if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is required");
}

// Initialize GoogleGenAI
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
const model = "gemini-2.5-flash";
const embeddingModel = "gemini-embedding-exp-03-07";

const baseSystemInstruction = `You are BitAI,

Use the provided context from the RAG system to answer questions accurately. If the RAG system does not provide relevant documents or information, generate a response based on your own knowledge and reasoning, ensuring it is helpful and accurate to the best of your abilities.

Answer in Lao language when requested.

Be helpful, conversational, and provide detailed responses based on the context or your knowledge.`;

// Custom embedding function for gemini-embedding-exp-03-07
async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await genAI.models.embedContent({
            model: embeddingModel,
            contents: text,
            config: { taskType: "RETRIEVAL_DOCUMENT" }, // Fixed: Changed taskType to task_type
        });

        // Check if embeddings and values exist
        if (!response.embeddings || !response.embeddings[0]?.values) {
            throw new Error("Failed to generate valid embedding: response is empty or invalid");
        }

        return response.embeddings[0].values;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw new Error(`Failed to generate embedding for text: ${text}`);
    }
}

// Custom embeddings class compatible with LangChain
class CustomGeminiEmbeddings {
    async embedDocuments(texts: string[]): Promise<number[][]> {
        const embeddings = await Promise.all(texts.map((text) => generateEmbedding(text)));
        return embeddings;
    }

    async embedQuery(text: string): Promise<number[]> {
        return generateEmbedding(text);
    }
}

// Initialize pgvector
const pgConfig = {
    postgresConnectionOptions: {
        connectionString: process.env.POSTGRES_URL,
    },
    tableName: "documents",
    columns: {
        idColumnName: "id",
        vectorColumnName: "embedding",
        contentColumnName: "content",
        metadataColumnName: "metadata",
    },
};

async function initializeVectorStore(): Promise<PGVectorStore> {
    try {
        const embeddings = new CustomGeminiEmbeddings();
        const vectorStore = await PGVectorStore.initialize(embeddings, pgConfig);
        return vectorStore;
    } catch (error) {
        console.error("Failed to initialize vector store:", error);
        throw new Error("Vector store initialization failed");
    }
}

// New endpoint to add documents to PGVectorStore
app.post(
    "/add-document",
    async (
        req: Request<{}, {}, AddDocumentRequestBody>,
        res: Response
    ): Promise<void> => {
        const { content, metadata = {} } = req.body;

        // Validate request body
        if (!content || typeof content !== "string") {
            res.status(400).json({
                error: "Content is required and must be a string",
            });
            return;
        }

        try {
            const vectorStore = await initializeVectorStore();

            // Add document to vector store
            await vectorStore.addDocuments([
                {
                    pageContent: content,
                    metadata,
                },
            ]);

            res.status(200).json({
                message: "Document added successfully",
                content,
                metadata,
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

// Chat Stream API with RAG and history
app.post(
    "/chat",
    async (
        req: Request<{}, {}, ChatRequestBody>,
        res: Response
    ): Promise<void> => {
        const { query, history = [] } = req.body;

        // Validate request body
        if (!query || typeof query !== "string") {
            res.status(400).json({
                error: "Query is required and must be a string",
            });
            return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {
            // Initialize vector store
            const vectorStore = await initializeVectorStore();

            // Retrieve relevant documents
            const retrievedDocs = await vectorStore.similaritySearch(query, 3);
            const context = retrievedDocs
                .map((doc) => doc.pageContent)
                .join("\n");

            // Log similarity search results with scores
            const test = await vectorStore.similaritySearchWithScore(query, 3);
            console.log("Similarity Search Results:", test);

            // Combine base system instruction with RAG context
            const systemInstructionWithContext = [
                {
                    text: `${baseSystemInstruction}\n\nRAG Context: ${context}`,
                },
            ];

            // Prepare contents with history and current query
            const contents = [
                ...history.map((msg: ChatMessage) => ({
                    role: msg.role,
                    parts: msg.parts.map((part) => ({ text: part.text })),
                })),
                {
                    role: "user",
                    parts: [{ text: query }],
                },
            ];

            // Stream response from Gemini
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
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Internal server error";

            if (!res.headersSent) {
                res.status(500).json({ error: errorMessage });
            } else {
                res.write(
                    `data: ${JSON.stringify({
                        error: errorMessage,
                    })}\n\n`
                );
                res.end();
            }
        }
    }
);

// Health check endpoint
app.get("/health", (_req: Request, res: Response): void => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    process.exit(0);
});
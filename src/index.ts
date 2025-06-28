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
// app.use(
//     cors({
//         origin: "http://localhost:3000",
//     })
// );

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
const embeddingModel = "models/text-embedding-004";

const baseSystemInstruction = `You are BitAI,

Use the provided context from the RAG system to answer questions accurately. If the RAG system does not provide relevant documents or information, generate a response based on your own knowledge and reasoning, ensuring it is helpful and accurate to the best of your abilities.
Be helpful, conversational, and provide detailed responses based on the context or your knowledge.`;

// Translation function to translate text to English using Gemini
async function translateToEnglish(text: string): Promise<string> {
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

// Custom embedding function for gemini-embedding-exp-03-07
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

// Endpoint to add documents to PGVectorStore with translation
app.post(
    "/add-document",
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

// Chat Stream API with RAG, history, and query translation
app.post(
    "/chat",
    async (
        req: Request<{}, {}, ChatRequestBody>,
        res: Response
    ): Promise<void> => {
        const { query, history = [] } = req.body;

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
            const vectorStore = await initializeVectorStore();
            const englishQuery = await translateToEnglish(query);
            const retrievedDocs = await vectorStore.similaritySearch(englishQuery, 3);
            const context = retrievedDocs.map((doc) => doc.pageContent).join("\n");

            console.log("Original query:", query);
            console.log("English query:", englishQuery);
            const test = await vectorStore.similaritySearchWithScore(englishQuery, 3);
            console.log("Similarity Search Results:", test);

            const systemInstructionWithContext = [
                {
                    text: `${baseSystemInstruction}\n\nRAG Context: ${context}`,
                },
            ];

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
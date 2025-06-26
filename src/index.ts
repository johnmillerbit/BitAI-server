import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors"

dotenv.config();

// Define interfaces
interface RagRequestBody {
    query: string;
    history?: Array<{
        role: "user" | "model" | "system";
        parts: Array<{ text: string }>;
    }>;
}

interface StreamResponse {
    text: string;
}

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:3000"
}))

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

// Initialize Google Embeddings
const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY!,
    model: "embedding-001",
});

// Initialize pgvector
const pgConfig = {
    postgresConnectionOptions: {
        connectionString: process.env.POSTGRES_URL!,
    },
    tableName: "documents",
    columns: {
        idColumnName: "id",
        vectorColumnName: "embedding",
        contentColumnName: "content",
        metadataColumnName: "metadata",
    },
};

async function initializeVectorStore() {
    const vectorStore = await PGVectorStore.initialize(embeddings, pgConfig);
    // const docs = [
    //     {
    //         pageContent: "MillerBit is a passionate programming student team dedicated to learning, building, and growing together in the world of technology. Founded by a group of like-minded students with a shared interest in coding, MillerBit focuses on developing real-world projects, participating in hackathons, and continuously improving technical skills.",
    //         metadata: { source: "wiki" },
    //     }
    // ];
    // await vectorStore.addDocuments(docs);
    return vectorStore;
}

// RAG Stream API
app.post(
    "/api/rag",
    async (req: Request<{}, {}, RagRequestBody>, res: Response) => {
        const { query, history = [] } = req.body;

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

            // Add context as the first message in history (role: model)
            const contextMessage = {
                role: "model" as const,
                parts: [{ text: `You are BitAI. Use the following context to answer the query in lao language.\nContext: ${context}\nAnswer in a conversational tone.` }],
            };
            const chatHistory = [contextMessage, ...history];

            // Create chat instance
            const chat = genAI.chats.create({
                model: "gemini-2.5-flash",
                history: chatHistory,
            });

            // Stream response from Gemini
            const stream = await chat.sendMessageStream({
                message: query,
            });

            for await (const chunk of stream) {
                const text = chunk.text;
                if (text) {
                    const response: StreamResponse = { text };
                    res.write(`data: ${JSON.stringify(response)}\n\n`);
                }
            }

            res.write("data: [DONE]\n\n");
            res.end();
        } catch (error) {
            console.error("Error in /api/rag:", error);
            res.write(
                `data: ${JSON.stringify({
                    error: "Internal server error",
                })}\n\n`
            );
            res.end();
        }
    }
);

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { env } from "../utils/env";
import { CustomGeminiEmbeddings } from "./genai";

const pgConfig = {
    postgresConnectionOptions: {
        connectionString: env.POSTGRES_URL,
    },
    tableName: "documents",
    columns: {
        idColumnName: "id",
        vectorColumnName: "embedding",
        contentColumnName: "content",
        metadataColumnName: "metadata",
        originalContentColumnName: "originalContent",
    },
};

export async function initializeVectorStore(): Promise<PGVectorStore> {
    try {
        const embeddings = new CustomGeminiEmbeddings();
        const vectorStore = await PGVectorStore.initialize(embeddings, pgConfig);
        return vectorStore;
    } catch (error) {
        console.error("Failed to initialize vector store:", error);
        throw new Error("Vector store initialization failed");
    }
}

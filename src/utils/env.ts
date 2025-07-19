
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is required");
}

if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is required");
}

export const env = {
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    POSTGRES_URL: process.env.POSTGRES_URL,
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
    X_API_KEY: process.env.X_API_KEY,
    NODE_ENV: process.env.NODE_ENV || "development",
};

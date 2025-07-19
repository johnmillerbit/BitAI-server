import { Pool } from "pg";
import { env } from "../utils/env";
import AppError from "../utils/AppError";

const pool = new Pool({
    connectionString: env.POSTGRES_URL,
});

const testConnection = async () => {
    try {
        await pool.connect();
        console.log("Connected to the database");
    } catch (error: any) {
        throw new AppError(`Error connecting to the database: ${error.message}`, 500);
    }
};

testConnection();

export default pool;

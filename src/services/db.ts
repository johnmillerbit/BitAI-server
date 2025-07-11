import { Pool } from "pg";
import { POSTGRES_URL } from "../utils/env";

const pool = new Pool({
    connectionString: POSTGRES_URL,
});

const testConnection = async () => {
    try {
        await pool.connect();
        console.log("Connected to the database");
    } catch (error) {
        console.error("Error connecting to the database:", error);
    }
};

testConnection();

export default pool;

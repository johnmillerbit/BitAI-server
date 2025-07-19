import pool from "./db";
import AppError from "../utils/AppError";

export async function getDocuments() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT id, content, metadata, created_at FROM documents order by created_at desc");
        return res.rows;
    } catch (error: any) {
        throw new AppError(`Failed to retrieve documents: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

export async function deleteDocument(id: string) {
    const client = await pool.connect();
    try {
        const res = await client.query("DELETE FROM documents WHERE id = $1 RETURNING *", [id]);
        if (res.rowCount === 0) {
            throw new AppError("Document not found", 404);
        }
        return res.rows[0];
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error; // Re-throw AppError
        }
        throw new AppError(`Failed to delete document: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

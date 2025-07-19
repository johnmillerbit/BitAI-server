import pool from './db';
import AppError from '../utils/AppError';

export async function getAllDonators() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM donator ORDER BY created_at DESC');
        return res.rows;
    } catch (error: any) {
        throw new AppError(`Failed to retrieve all donators: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

export async function getAllowedDonators() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM donator where allowed = true ORDER BY created_at DESC');
        return res.rows;
    } catch (error: any) {
        throw new AppError(`Failed to retrieve allowed donators: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

export async function getUnallowedDonators() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM donator where allowed = false ORDER BY created_at DESC');
        return res.rows;
    } catch (error: any) {
        throw new AppError(`Failed to retrieve unallowed donators: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

export async function allowDonator(id: number) {
    const client = await pool.connect();
    try {
        const res = await client.query('UPDATE donator SET allowed = true WHERE id = $1 RETURNING *', [id]);
        if (res.rowCount === 0) {
            throw new AppError("Donator not found", 404);
        }
        return res.rows[0];
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to allow donator: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

export async function disAllowDonator(id: number) {
    const client = await pool.connect();
    try {
        const res = await client.query('UPDATE donator SET allowed = false WHERE id = $1 RETURNING *', [id]);
        if (res.rowCount === 0) {
            throw new AppError("Donator not found", 404);
        }
        return res.rows[0];
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to disallow donator: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

export async function deleteDonator(id: number) {
    const client = await pool.connect();
    try {
        const res = await client.query('DELETE FROM donator WHERE id = $1 RETURNING *', [id]);
        if (res.rowCount === 0) {
            throw new AppError("Donator not found", 404);
        }
        return res.rows[0];
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(`Failed to delete donator: ${error.message}`, 500);
    } finally {
        client.release();
    }
}

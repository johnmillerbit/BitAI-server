import pool from "./db";

export async function getDocuments() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, content, metadata, created_at FROM documents order by created_at desc");
    return res.rows;
  } finally {
    client.release();
  }
}

export async function deleteDocument(id: string) {
  const client = await pool.connect();
  try {
    const res = await client.query("DELETE FROM documents WHERE id = $1 RETURNING *", [id]);
    return res.rows[0];
  } finally {
    client.release();
  }
}
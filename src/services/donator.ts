import pool from './db';

export async function getAllDonators() {
  const client = await pool.connect();
  try {
	const res = await client.query('SELECT * FROM donator ORDER BY created_at DESC');
	return res.rows;
  } finally {
	client.release();
  }
}
export async function getAllowedDonators() {
  const client = await pool.connect();
  try {
	const res = await client.query('SELECT * FROM donator where allowed = true ORDER BY created_at DESC');
	return res.rows;
  } finally {
	client.release();
  }
}

export async function getUnallowedDonators() {
  const client = await pool.connect();
  try {
	const res = await client.query('SELECT * FROM donator where allowed = false ORDER BY created_at DESC');
	return res.rows;
  } finally {
	client.release();
  }
}

export async function allowDonator(id: number) {
	const client = await pool.connect();
	try {
		const res = await client.query('UPDATE donator SET allowed = true WHERE id = $1 RETURNING *', [id]);
		return res.rows[0];
	} finally {
		client.release();
	}
}

export async function disAllowDonator(id: number) {
	const client = await pool.connect();
	try {
		const res = await client.query('UPDATE donator SET allowed = false WHERE id = $1 RETURNING *', [id]);
		return res.rows[0];
	} finally {
		client.release();
	}
}

export async function deleteDonator(id: number) {
  const client = await pool.connect();
  try {
	const res = await client.query('DELETE FROM donator WHERE id = $1 RETURNING *', [id]);
	return res.rows[0];
  } finally {
	client.release();
  }
}
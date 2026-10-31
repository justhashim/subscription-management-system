import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  const sql = await readFile(path.resolve(process.cwd(), 'migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
  console.log('Database migration applied: 001_initial.sql');
} finally {
  await pool.end();
}

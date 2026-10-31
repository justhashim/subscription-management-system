// src/utils/errors.ts
// Shared helpers: error class + handler, db typing, transactions, row patching.
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';

export const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
export const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

/** Anything with query(): fastify.db or a transaction client. */
export interface Db {
  query(text: string, params?: any[]): Promise<any>;
}

export async function withTransaction<T>(app: FastifyInstance, fn: (tx: Db) => Promise<T>): Promise<T> {
  const client = await app.db.getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Human-readable unique number, e.g. SUB-20261031-A1B2C3. */
export function makeNumber(prefix: string): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

/** pg returns BIGINT as string; convert the listed columns to numbers. */
export function numify<T>(row: T, keys: string[]): T {
  const out: any = { ...row };
  for (const key of keys) {
    if (out[key] !== null && out[key] !== undefined) out[key] = Number(out[key]);
  }
  return out;
}

/** UPDATE only the whitelisted columns that are present in `data`. Table/columns are code constants. */
export async function patchRow(
  db: Db,
  table: string,
  id: string,
  data: Record<string, unknown>,
  allowed: readonly string[],
  returning: string
) {
  const keys = allowed.filter((key) => data[key] !== undefined);
  if (keys.length === 0) throw new AppError(400, 'No updatable fields supplied');

  const params: unknown[] = keys.map((key) => {
    const value = data[key];
    return value !== null && typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : value;
  });
  const sets = keys.map((key, index) => `${key} = $${index + 1}`);
  params.push(id);

  const result = await db.query(
    `UPDATE ${table} SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${params.length} RETURNING ${returning}`,
    params
  );
  return result.rows[0] ?? null;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    if (error.validation) {
      return reply.status(400).send({ error: error.message });
    }
    if (error.code === '23505') return reply.status(409).send({ error: 'Record already exists' });
    if (error.code === '23503') {
      return reply.status(409).send({ error: 'Referenced record does not exist or is still in use' });
    }
    if (error.code === '23514') return reply.status(400).send({ error: 'Value violates a database rule' });

    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (status === 500) request.log.error(error);
    return reply.status(status).send({ error: status === 500 ? 'Internal server error' : error.message });
  });
}

// src/repositories/planRepo.ts
import { numify, patchRow, type Db } from '../utils/errors.js';

const COLS = `id, name, description, billing_interval, price, currency, minimum_quantity, included_products,
  to_char(available_from, 'YYYY-MM-DD') AS available_from,
  to_char(available_until, 'YYYY-MM-DD') AS available_until,
  auto_close, allow_early_close, allow_pause, allow_renewal, status, created_at, updated_at`;
const NUM = ['price'];
const PATCHABLE = [
  'name', 'description', 'billing_interval', 'price', 'currency', 'minimum_quantity', 'included_products',
  'available_from', 'available_until', 'auto_close', 'allow_early_close', 'allow_pause', 'allow_renewal', 'status'
] as const;

export interface PlanInput {
  name: string;
  description?: string | null;
  billing_interval: string;
  price: number;
  currency?: string;
  minimum_quantity?: number;
  included_products?: { product_id: string; variant_name?: string | null; quantity: number }[];
  available_from?: string | null;
  available_until?: string | null;
  auto_close?: boolean;
  allow_early_close?: boolean;
  allow_pause?: boolean;
  allow_renewal?: boolean;
}

export const planRepo = {
  async insert(db: Db, d: PlanInput) {
    const result = await db.query(
      `INSERT INTO plans (name, description, billing_interval, price, currency, minimum_quantity, included_products,
                          available_from, available_until, auto_close, allow_early_close, allow_pause, allow_renewal)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
       RETURNING ${COLS}`,
      [d.name, d.description ?? null, d.billing_interval, d.price, d.currency ?? 'INR', d.minimum_quantity ?? 1,
        JSON.stringify(d.included_products ?? []), d.available_from ?? null, d.available_until ?? null,
        d.auto_close ?? false, d.allow_early_close ?? true, d.allow_pause ?? true, d.allow_renewal ?? true]
    );
    return numify(result.rows[0], NUM);
  },

  async getById(db: Db, id: string) {
    const result = await db.query(`SELECT ${COLS} FROM plans WHERE id = $1`, [id]);
    return result.rows[0] ? numify(result.rows[0], NUM) : null;
  },

  async list(db: Db, f: { status?: string; interval?: string; limit: number; offset: number }) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (f.status) { params.push(f.status); conditions.push(`status = $${params.length}`); }
    if (f.interval) { params.push(f.interval); conditions.push(`billing_interval = $${params.length}`); }
    params.push(f.limit, f.offset);
    const result = await db.query(
      `SELECT ${COLS} FROM plans
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY name ASC, id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows.map((row: any) => numify(row, NUM));
  },

  async patch(db: Db, id: string, data: object) {
    const row = await patchRow(db, 'plans', id, data as Record<string, unknown>, PATCHABLE, COLS);
    return row ? numify(row, NUM) : null;
  }
};

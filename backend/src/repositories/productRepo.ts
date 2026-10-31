// src/repositories/productRepo.ts
import { numify, patchRow, type Db } from '../utils/errors.js';

const COLS = `id, name, description, product_type, sales_price, cost_price, variants, notes, status, created_at, updated_at`;
const NUM = ['sales_price', 'cost_price'];
const PATCHABLE = ['name', 'description', 'product_type', 'sales_price', 'cost_price', 'variants', 'notes', 'status'] as const;

export interface ProductInput {
  name: string;
  description?: string | null;
  product_type: string;
  sales_price: number;
  cost_price?: number;
  variants?: { name: string; price_adjustment: number }[];
  notes?: string | null;
}

export const productRepo = {
  async insert(db: Db, d: ProductInput) {
    const result = await db.query(
      `INSERT INTO products (name, description, product_type, sales_price, cost_price, variants, notes)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING ${COLS}`,
      [d.name, d.description ?? null, d.product_type, d.sales_price, d.cost_price ?? 0,
        JSON.stringify(d.variants ?? []), d.notes ?? null]
    );
    return numify(result.rows[0], NUM);
  },

  async getById(db: Db, id: string) {
    const result = await db.query(`SELECT ${COLS} FROM products WHERE id = $1`, [id]);
    return result.rows[0] ? numify(result.rows[0], NUM) : null;
  },

  async list(db: Db, f: { status?: string; q?: string; limit: number; offset: number }) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (f.status) { params.push(f.status); conditions.push(`status = $${params.length}`); }
    if (f.q) { params.push(`%${f.q}%`); conditions.push(`name ILIKE $${params.length}`); }
    params.push(f.limit, f.offset);
    const result = await db.query(
      `SELECT ${COLS} FROM products
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY name ASC, id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows.map((row: any) => numify(row, NUM));
  },

  async findByIds(db: Db, ids: string[]) {
    const result = await db.query(`SELECT ${COLS} FROM products WHERE id = ANY($1::uuid[])`, [ids]);
    return result.rows.map((row: any) => numify(row, NUM));
  },

  async findActiveByNames(db: Db, names: string[]) {
    const result = await db.query(
      `SELECT ${COLS} FROM products WHERE status = 'active' AND LOWER(name) = ANY($1::text[])`,
      [names.map((n) => n.toLowerCase())]
    );
    return result.rows.map((row: any) => numify(row, NUM));
  },

  async patch(db: Db, id: string, data: object) {
    const row = await patchRow(db, 'products', id, data as Record<string, unknown>, PATCHABLE, COLS);
    return row ? numify(row, NUM) : null;
  }
};

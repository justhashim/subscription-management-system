// src/repositories/quotationRepo.ts
import { numify, type Db } from '../utils/errors.js';

const COLS = `q.id, q.quotation_number, q.customer_id, q.created_by, q.template_name, q.title, q.items,
  q.subtotal, q.discount_amount, q.tax_amount, q.total_amount,
  to_char(q.valid_until, 'YYYY-MM-DD') AS valid_until, q.status, q.notes, q.created_at, q.updated_at`;
const NUM = ['subtotal', 'discount_amount', 'tax_amount', 'total_amount'];

export const quotationRepo = {
  async insert(db: Db, d: {
    number: string; customerId: string; createdBy: string; templateName: string; title: string;
    items: unknown[]; subtotal: number; validUntil: string; notes: string | null;
  }) {
    const result = await db.query(
      `INSERT INTO quotations (quotation_number, customer_id, created_by, template_name, title, items,
                               subtotal, discount_amount, tax_amount, total_amount, valid_until, notes)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 0, 0, $7, $8, $9)
       RETURNING id`,
      [d.number, d.customerId, d.createdBy, d.templateName, d.title, JSON.stringify(d.items),
        d.subtotal, d.validUntil, d.notes]
    );
    return result.rows[0].id as string;
  },

  async getById(db: Db, id: string, lock = false) {
    const result = await db.query(
      `SELECT ${COLS}, c.customer_name
       FROM quotations q JOIN customers c ON c.id = q.customer_id
       WHERE q.id = $1 ${lock ? 'FOR UPDATE OF q' : ''}`,
      [id]
    );
    return result.rows[0] ? numify(result.rows[0], NUM) : null;
  },

  async list(db: Db, f: { status?: string; customerId?: string; customerIds?: string[]; limit: number; offset: number }) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (f.status) { params.push(f.status); conditions.push(`q.status = $${params.length}`); }
    if (f.customerId) { params.push(f.customerId); conditions.push(`q.customer_id = $${params.length}`); }
    if (f.customerIds) {
      params.push(f.customerIds);
      conditions.push(`q.customer_id = ANY($${params.length}::uuid[])`, `q.status <> 'draft'`);
    }
    params.push(f.limit, f.offset);
    const result = await db.query(
      `SELECT ${COLS}, c.customer_name
       FROM quotations q JOIN customers c ON c.id = q.customer_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY q.created_at DESC, q.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows.map((row: any) => numify(row, NUM));
  },

  async setStatus(db: Db, id: string, status: string) {
    await db.query(`UPDATE quotations SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  }
};

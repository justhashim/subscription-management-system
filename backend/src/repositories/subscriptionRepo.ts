// src/repositories/subscriptionRepo.ts
import { numify, patchRow, type Db } from '../utils/errors.js';

const D = (col: string, alias: string) => `to_char(${col}, 'YYYY-MM-DD') AS ${alias}`;
const COLS = `s.id, s.subscription_number, s.customer_id, s.quotation_id, s.plan_id, s.created_by,
  ${D('s.start_date', 'start_date')}, ${D('s.end_date', 'end_date')}, ${D('s.next_billing_date', 'next_billing_date')},
  s.billing_interval, s.plan_price, s.status, s.auto_renew, s.paused_at, s.closed_at, s.created_at, s.updated_at`;
const PATCHABLE = ['status', 'start_date', 'end_date', 'next_billing_date', 'auto_renew', 'paused_at', 'closed_at'] as const;

export interface SubscriptionItemSnapshot {
  product_id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
}

export const subscriptionRepo = {
  async insert(db: Db, d: {
    number: string; customerId: string; quotationId: string | null; planId: string; createdBy: string;
    startDate: string; endDate: string | null; billingInterval: string; planPrice: number;
    status: string; autoRenew: boolean;
  }) {
    const result = await db.query(
      `INSERT INTO subscriptions (subscription_number, customer_id, quotation_id, plan_id, created_by, start_date,
                                  end_date, billing_interval, plan_price, status, auto_renew)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [d.number, d.customerId, d.quotationId, d.planId, d.createdBy, d.startDate, d.endDate,
        d.billingInterval, d.planPrice, d.status, d.autoRenew]
    );
    return result.rows[0].id as string;
  },

  async insertItems(db: Db, subscriptionId: string, items: SubscriptionItemSnapshot[]) {
    for (const item of items) {
      await db.query(
        `INSERT INTO subscription_items (subscription_id, product_id, product_name, variant_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [subscriptionId, item.product_id, item.product_name, item.variant_name, item.quantity, item.unit_price]
      );
    }
  },

  /** With lock = true the subscription row is locked (FOR UPDATE) until the transaction ends. */
  async getById(db: Db, id: string, lock = false) {
    const result = await db.query(
      `SELECT ${COLS}, c.customer_name, p.name AS plan_name,
              p.allow_pause, p.allow_early_close, p.allow_renewal, p.auto_close
       FROM subscriptions s
       JOIN customers c ON c.id = s.customer_id
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = $1 ${lock ? 'FOR UPDATE OF s' : ''}`,
      [id]
    );
    return result.rows[0] ? numify(result.rows[0], ['plan_price']) : null;
  },

  async getItems(db: Db, subscriptionId: string) {
    const result = await db.query(
      `SELECT id, product_id, product_name, variant_name, quantity, unit_price
       FROM subscription_items WHERE subscription_id = $1 ORDER BY created_at ASC, id ASC`,
      [subscriptionId]
    );
    return result.rows.map((row: any) => numify(row, ['unit_price']));
  },

  async list(db: Db, f: { status?: string; customerId?: string; customerIds?: string[]; limit: number; offset: number }) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (f.status) { params.push(f.status); conditions.push(`s.status = $${params.length}`); }
    if (f.customerId) { params.push(f.customerId); conditions.push(`s.customer_id = $${params.length}`); }
    if (f.customerIds) { params.push(f.customerIds); conditions.push(`s.customer_id = ANY($${params.length}::uuid[])`); }
    params.push(f.limit, f.offset);
    const result = await db.query(
      `SELECT ${COLS}, c.customer_name, p.name AS plan_name
       FROM subscriptions s
       JOIN customers c ON c.id = s.customer_id
       JOIN plans p ON p.id = s.plan_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows.map((row: any) => numify(row, ['plan_price']));
  },

  async update(db: Db, id: string, data: Record<string, unknown>) {
    return patchRow(db, 'subscriptions', id, data, PATCHABLE, 'id');
  },

  /** Plans with auto_close: close subscriptions whose end date has passed. */
  async closeExpired(db: Db): Promise<number> {
    const result = await db.query(
      `UPDATE subscriptions s
       SET status = 'closed', closed_at = now(), next_billing_date = NULL, updated_at = now()
       FROM plans p
       WHERE p.id = s.plan_id AND p.auto_close = true
         AND s.status IN ('confirmed', 'active', 'paused')
         AND s.end_date < CURRENT_DATE`
    );
    return result.rowCount ?? 0;
  }
};

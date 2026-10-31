// src/repositories/discountRepo.ts
import type { PoolClient } from 'pg';

export type NewDiscount = {
  name: string;
  code: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minimumPurchase: number;
  minimumQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
};

export const discountRepo = {
  async createDiscount(db: PoolClient, d: NewDiscount) {
    const result = await db.query(
      `INSERT INTO discounts (
         name, code, discount_type, discount_value, minimum_purchase,
         minimum_quantity, starts_at, ends_at, max_redemptions, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id, name, code, discount_type, discount_value, minimum_purchase,
                 minimum_quantity, starts_at, ends_at, max_redemptions, status`,
      [
        d.name, d.code, d.discountType, d.discountValue, d.minimumPurchase,
        d.minimumQuantity, d.startsAt, d.endsAt, d.maxRedemptions
      ]
    );
    return this.toApi(result.rows[0]);
  },

  async listDiscounts(db: PoolClient) {
    const result = await db.query(
      `SELECT id, name, code, discount_type, discount_value, minimum_purchase,
              minimum_quantity, starts_at, ends_at, max_redemptions, status
       FROM discounts
       ORDER BY created_at DESC`
    );
    return result.rows.map((row: any) => this.toApi(row));
  },

  // Locks the discount row so concurrent invoices cannot exceed max_redemptions.
  async getDiscountForUpdate(db: PoolClient, code: string) {
    const result = await db.query(
      `SELECT id, discount_type, discount_value, minimum_purchase,
              minimum_quantity, max_redemptions
       FROM discounts
       WHERE code = $1
         AND status = 'active'
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now())
       FOR UPDATE`,
      [code]
    );
    return result.rows[0] ?? null;
  },

  // Redemptions on void invoices no longer count against the limit.
  async getRedemptionCount(db: PoolClient, discountId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*)::integer AS count
       FROM discount_redemptions dr
       JOIN invoices i ON i.id = dr.invoice_id
       WHERE dr.discount_id = $1
         AND i.status <> 'void'`,
      [discountId]
    );
    return Number(result.rows[0].count);
  },

  async recordRedemption(
    db: PoolClient,
    discountId: string,
    invoiceId: string,
    customerId: string,
    appliedAmount: number
  ) {
    if (!Number.isSafeInteger(appliedAmount) || appliedAmount <= 0) {
      throw new Error('Redemption amount must be a positive integer in paise');
    }

    const result = await db.query(
      `INSERT INTO discount_redemptions (discount_id, invoice_id, customer_id, discount_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [discountId, invoiceId, customerId, appliedAmount]
    );
    return result.rows[0];
  },

  // BIGINT columns arrive from pg as strings; expose them as integers.
  toApi(row: any) {
    return {
      ...row,
      discount_value: Number(row.discount_value),
      minimum_purchase: Number(row.minimum_purchase ?? 0),
      minimum_quantity: Number(row.minimum_quantity ?? 1),
      max_redemptions: row.max_redemptions === null ? null : Number(row.max_redemptions)
    };
  }
};

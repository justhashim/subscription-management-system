
import type { PoolClient } from 'pg';

export const discountRepo = {
  async getDiscountForUpdate(db: PoolClient, code: string) {
    const result = await db.query(
      `SELECT
         id,
         discount_type,
         discount_value,
         minimum_purchase,
         minimum_quantity,
         max_redemptions
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

  async getRedemptionCount(
    db: PoolClient,
    discountId: string
  ): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*)::integer AS count
       FROM discount_redemptions
       WHERE discount_id = $1`,
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
      `INSERT INTO discount_redemptions (
         discount_id,
         invoice_id,
         customer_id,
         discount_amount
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [discountId, invoiceId, customerId, appliedAmount]
    );

    return result.rows[0];
  }
};

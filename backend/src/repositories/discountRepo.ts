import { PoolClient } from 'pg';

export const discountRepo = {
  /**
   * Fetches an active discount and acquires a row-level lock (FOR UPDATE) to claim quotas atomically[cite: 2, 4].
   */
  async getDiscountForUpdate(db: PoolClient, code: string) {
    const res = await db.query(
      `SELECT id, discount_type, discount_value, minimum_purchase, minimum_quantity, max_redemptions 
       FROM discounts 
       WHERE code = $1 AND status = 'active' 
       AND (starts_at IS NULL OR starts_at <= now()) 
       AND (ends_at IS NULL OR ends_at >= now())
       FOR UPDATE`, 
      [code]
    );
    return res.rows[0];
  },

  /**
   * Counts current redemptions to validate against max_redemptions[cite: 4].
   */
  async getRedemptionCount(db: PoolClient, discountId: string) {
    const res = await db.query(
      `SELECT COUNT(*) as count FROM discount_redemptions WHERE discount_id = $1`,
      [discountId]
    );
    return parseInt(res.rows[0].count, 10);
  },

  /**
   * Records the discount application for an invoice[cite: 4].
   */
  async recordRedemption(db: PoolClient, discountId: string, invoiceId: string, customerId: string, appliedAmount: number) {
    await db.query(
      `INSERT INTO discount_redemptions (discount_id, invoice_id, customer_id, discount_amount) 
       VALUES ($1, $2, $3, $4)`,
      [discountId, invoiceId, customerId, appliedAmount]
    );
  }
};
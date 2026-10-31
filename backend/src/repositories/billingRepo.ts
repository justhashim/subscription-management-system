import { PoolClient } from 'pg';

export const billingRepo = {
  /**
   * Finds all active subscriptions due for billing on or before the target date.
   */
  async getDueSubscriptions(db: PoolClient, targetDate: string) {
    const res = await db.query(
      `SELECT id, customer_id, plan_id, plan_price, billing_interval, next_billing_date 
       FROM subscriptions 
       WHERE status = 'active' AND next_billing_date <= $1`,
      [targetDate]
    );
    return res.rows;
  },

  /**
   * Initializes the parent billing run tracker.
   */
  async createBillingRun(db: PoolClient, runNumber: string, billingDate: string, totalSubscriptions: number) {
    const res = await db.query(
      `INSERT INTO billing_runs (run_number, billing_date, status, total_subscriptions) 
       VALUES ($1, $2, 'processing', $3) RETURNING id`,
      [runNumber, billingDate, totalSubscriptions]
    );
    return res.rows[0];
  },

  /**
   * Records an individual processing attempt for a subscription[cite: 4].
   */
  async createBillingRunItem(
    db: PoolClient, 
    runId: string, 
    subId: string, 
    periodIndex: number, 
    periodStart: string, 
    periodEnd: string
  ) {
    const res = await db.query(
      `INSERT INTO billing_run_items (billing_run_id, subscription_id, period_index, period_start, period_end, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [runId, subId, periodIndex, periodStart, periodEnd]
    );
    return res.rows[0];
  },

  /**
   * Updates the item status post-transaction (success, skipped, or failed)[cite: 4].
   */
  async updateBillingRunItem(db: PoolClient, itemId: string, status: string, invoiceId: string | null = null, failureReason: string | null = null) {
    await db.query(
      `UPDATE billing_run_items 
       SET status = $1, invoice_id = $2, failure_reason = $3, processed_at = now() 
       WHERE id = $4`,
      [status, invoiceId, failureReason, itemId]
    );
  }
};
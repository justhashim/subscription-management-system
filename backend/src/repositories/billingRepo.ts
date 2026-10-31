
import type { PoolClient } from 'pg';

export const billingRepo = {
  async getDueSubscriptions(db: PoolClient, targetDate: string) {
    const result = await db.query(
      `SELECT
         id,
         customer_id,
         plan_id,
         plan_price,
         start_date,
         end_date,
         billing_interval,
         next_billing_date
       FROM subscriptions
       WHERE status = 'active'
         AND next_billing_date IS NOT NULL
         AND next_billing_date <= $1
         AND (end_date IS NULL OR next_billing_date <= end_date)
       ORDER BY next_billing_date ASC`,
      [targetDate]
    );

    return result.rows;
  },

  async createBillingRun(
    db: PoolClient,
    runNumber: string,
    billingDate: string,
    totalSubscriptions: number
  ) {
    const result = await db.query(
      `INSERT INTO billing_runs (
         run_number,
         billing_date,
         status,
         total_subscriptions,
         started_at
       )
       VALUES ($1, $2, 'processing', $3, now())
       RETURNING id`,
      [runNumber, billingDate, totalSubscriptions]
    );

    return result.rows[0];
  },

  async createBillingRunItem(
    db: PoolClient,
    runId: string,
    subscriptionId: string,
    periodIndex: number,
    periodStart: string,
    periodEnd: string
  ) {
    const result = await db.query(
      `INSERT INTO billing_run_items (
         billing_run_id,
         subscription_id,
         period_index,
         period_start,
         period_end,
         status
       )
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [
        runId,
        subscriptionId,
        periodIndex,
        periodStart,
        periodEnd
      ]
    );

    return result.rows[0];
  },

  async updateBillingRunItem(
    db: PoolClient,
    itemId: string,
    status: 'success' | 'failed' | 'skipped',
    invoiceId: string | null = null,
    failureReason: string | null = null
  ) {
    await db.query(
      `UPDATE billing_run_items
       SET status = $1,
           invoice_id = $2,
           failure_reason = $3,
           processed_at = now()
       WHERE id = $4`,
      [status, invoiceId, failureReason, itemId]
    );
  }
};

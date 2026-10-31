// src/repositories/billingRepo.ts
import type { PoolClient } from 'pg';
import type { BillingItem } from '../services/invoiceBuilder.service.js';

export type DueSubscription = {
  id: string;
  subscription_number: string;
  customer_id: string;
  billing_interval: string;
  start_date: string;        // YYYY-MM-DD
  end_date: string | null;   // YYYY-MM-DD
  next_billing_date: string; // YYYY-MM-DD
};

// Dates are returned as text so the server timezone can never shift them.
const DATE = (column: string) => `to_char(${column}, 'YYYY-MM-DD')`;

export const billingRepo = {
  async getDueSubscriptions(db: PoolClient, targetDate: string): Promise<DueSubscription[]> {
    const result = await db.query(
      `SELECT
         id,
         subscription_number,
         customer_id,
         billing_interval,
         ${DATE('start_date')} AS start_date,
         ${DATE('end_date')} AS end_date,
         ${DATE('next_billing_date')} AS next_billing_date
       FROM subscriptions
       WHERE status = 'active'
         AND next_billing_date IS NOT NULL
         AND next_billing_date <= $1::date
         AND (end_date IS NULL OR next_billing_date <= end_date)
       ORDER BY next_billing_date ASC, id ASC`,
      [targetDate]
    );
    return result.rows;
  },

  // Locks the subscription row for the duration of its billing transaction.
  async lockSubscription(db: PoolClient, subscriptionId: string) {
    const result = await db.query(
      `SELECT status, ${DATE('next_billing_date')} AS next_billing_date
       FROM subscriptions
       WHERE id = $1
       FOR UPDATE`,
      [subscriptionId]
    );
    return (result.rows[0] ?? null) as { status: string; next_billing_date: string | null } | null;
  },

  // Moves next_billing_date forward only if nobody else already did.
  async advanceSubscription(
    db: PoolClient,
    subscriptionId: string,
    fromDate: string,
    toDate: string
  ): Promise<boolean> {
    const result = await db.query(
      `UPDATE subscriptions
       SET next_billing_date = $2::date,
           updated_at = now()
       WHERE id = $1
         AND next_billing_date = $3::date`,
      [subscriptionId, toDate, fromDate]
    );
    return result.rowCount === 1;
  },

  async getSubscriptionItems(db: PoolClient, subscriptionId: string): Promise<BillingItem[]> {
    const result = await db.query(
      `SELECT product_id, product_name, variant_name, quantity, unit_price
       FROM subscription_items
       WHERE subscription_id = $1
       ORDER BY created_at ASC, id ASC`,
      [subscriptionId]
    );
    return result.rows;
  },

  // One query for many subscriptions (used by the dry-run preview).
  async getItemsForSubscriptions(
    db: PoolClient,
    subscriptionIds: string[]
  ): Promise<Map<string, BillingItem[]>> {
    const map = new Map<string, BillingItem[]>();
    if (subscriptionIds.length === 0) return map;

    const result = await db.query(
      `SELECT subscription_id, product_id, product_name, variant_name, quantity, unit_price
       FROM subscription_items
       WHERE subscription_id = ANY($1::uuid[])
       ORDER BY created_at ASC, id ASC`,
      [subscriptionIds]
    );

    for (const row of result.rows) {
      const list = map.get(row.subscription_id) ?? [];
      list.push(row);
      map.set(row.subscription_id, list);
    }
    return map;
  },

  async createBillingRun(
    db: PoolClient,
    runNumber: string,
    billingDate: string,
    totalSubscriptions: number
  ) {
    const result = await db.query(
      `INSERT INTO billing_runs (run_number, billing_date, status, total_subscriptions, started_at)
       VALUES ($1, $2::date, 'processing', $3, now())
       RETURNING id`,
      [runNumber, billingDate, totalSubscriptions]
    );
    return result.rows[0] as { id: string };
  },

  async finalizeBillingRun(
    db: PoolClient,
    runId: string,
    status: 'completed' | 'partially_failed' | 'failed',
    invoicesCreated: number,
    failureCount: number
  ) {
    await db.query(
      `UPDATE billing_runs
       SET status = $2,
           invoices_created = $3,
           failure_count = $4,
           completed_at = now()
       WHERE id = $1`,
      [runId, status, invoicesCreated, failureCount]
    );
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
         billing_run_id, subscription_id, period_index, period_start, period_end, status
       )
       VALUES ($1, $2, $3, $4::date, $5::date, 'pending')
       RETURNING id`,
      [runId, subscriptionId, periodIndex, periodStart, periodEnd]
    );
    return result.rows[0] as { id: string };
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


import type { FastifyInstance } from 'fastify';
import { billingRepo } from '../repositories/billingRepo.js';
import { invoiceRepo } from '../repositories/invoiceRepo.js';
import {
  calculateLineItem,
  calculateInvoiceTotals
} from '../utils/financialMath.js';

type BillingSubscription = {
  id: string;
  customer_id: string;
  plan_id: string;
  plan_price: string | number;
  start_date: string | Date;
  end_date: string | Date | null;
  next_billing_date: string | Date;
  billing_interval: 'daily' | 'monthly' | 'yearly';
};

export class BillingEngine {
  constructor(private readonly app: FastifyInstance) {}

  async runBillingBatch(targetDate: string, runNumber: string) {
    const db = this.app.db;

    // Validate the configured tax rate (basis points).
    const configuredTaxRate = Number(
      process.env.DEFAULT_TAX_RATE_BPS ?? 0
    );

    if (
      !Number.isSafeInteger(configuredTaxRate) ||
      configuredTaxRate < 0 ||
      configuredTaxRate > 10000
    ) {
      throw new Error(
        'DEFAULT_TAX_RATE_BPS must be between 0 and 10000'
      );
    }

    // Load subscriptions due for billing.
    const candidateClient = await db.getClient();
    let candidates: BillingSubscription[];

    try {
      const result = await candidateClient.query(
        `SELECT
           id,
           customer_id,
           plan_id,
           plan_price,
           start_date,
           end_date,
           next_billing_date,
           billing_interval
         FROM subscriptions
         WHERE status = 'active'
           AND next_billing_date IS NOT NULL
           AND next_billing_date <= $1
           AND (end_date IS NULL OR next_billing_date <= end_date)
         ORDER BY next_billing_date ASC`,
        [targetDate]
      );

      candidates = result.rows;
    } finally {
      candidateClient.release();
    }

    if (candidates.length === 0) {
      return {
        status: 'completed',
        total: 0,
        invoicesCreated: 0,
        skipped: 0,
        failed: 0
      };
    }

    // Create billing run.
    const initClient = await db.getClient();
    let run: { id: string };

    try {
      run = await billingRepo.createBillingRun(
        initClient,
        runNumber,
        targetDate,
        candidates.length
      );
    } finally {
      initClient.release();
    }

    let invoicesCreated = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of candidates) {
      const tx = await db.getClient();

      let runItemId: string | null = null;
      let transactionStarted = false;

      try {
        const periodStart = this.toDateOnly(
          sub.next_billing_date
        );

        const periodIndex = this.calculatePeriodIndex(
          this.toDateOnly(sub.start_date),
          periodStart,
          sub.billing_interval
        );

        const periodEnd = this.calculatePeriodEnd(
          periodStart,
          sub.billing_interval
        );

        const nextBillingDate = this.addDays(periodEnd, 1);

        // Create run item before invoice transaction.
        const runItem = await billingRepo.createBillingRunItem(
          tx,
          run.id,
          sub.id,
          periodIndex,
          periodStart,
          periodEnd
        );

        runItemId = runItem.id;

        await tx.query('BEGIN');
        transactionStarted = true;

        // Load subscription item snapshots.
        const itemResult = await tx.query(
          `SELECT
             product_id,
             product_name,
             variant_name,
             quantity,
             unit_price
           FROM subscription_items
           WHERE subscription_id = $1
           ORDER BY created_at ASC`,
          [sub.id]
        );

        if (itemResult.rows.length === 0) {
          throw new Error(
            'Subscription has no billing items'
          );
        }

        // Calculate each invoice line only once.
        const calculatedResults = itemResult.rows.map(
          (item: any) => {
            return calculateLineItem({
              planPrice: Number(item.unit_price),
              variantAdjustment: 0,
              quantity: Number(item.quantity),
              lineDiscountAmount: 0,
              proratedSubDiscount: 0,
              taxRateBasisPoints: configuredTaxRate
            });
          }
        );

        const lineItems = itemResult.rows.map(
          (item: any, index: number) => {
            const line = calculatedResults[index];

            return {
              productId: item.product_id,
              description: item.product_name,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unit_price),
              discountAmount: line.discountAmount ?? 0,
              taxRateBasisPoints: configuredTaxRate,
              taxAmount: line.taxAmount ?? 0,
              lineTotal: line.lineTotal
            };
          }
        );

        // Calculate invoice totals from the same line calculations.
        const totals = calculateInvoiceTotals(
          calculatedResults
        );

        // Create invoice.
        const invoice = await invoiceRepo.createInvoice(
          tx,
          {
            invoiceNumber:
              `INV-${runNumber}-${sub.id.substring(0, 6)}`,
            customerId: sub.customer_id,
            subscriptionId: sub.id,
            billingRunId: run.id,
            periodIndex,
            dueDate: periodEnd,
            totals
          }
        );

        // Duplicate invoice protection.
        if (!invoice) {
          await tx.query('ROLLBACK');
          transactionStarted = false;

          await billingRepo.updateBillingRunItem(
            tx,
            runItemId,
            'skipped',
            null,
            'Invoice already exists for this billing period'
          );

          skipped++;
          continue;
        }

        // Insert invoice items.
        await invoiceRepo.createInvoiceItems(
          tx,
          invoice.id,
          lineItems
        );

        // Advance subscription only after invoice creation succeeds.
        await tx.query(
          `UPDATE subscriptions
           SET next_billing_date = $1,
               updated_at = now()
           WHERE id = $2
             AND next_billing_date = $3`,
          [nextBillingDate, sub.id, periodStart]
        );

        // Mark billing run item successful.
        await billingRepo.updateBillingRunItem(
          tx,
          runItemId,
          'success',
          invoice.id
        );

        await tx.query('COMMIT');
        transactionStarted = false;

        invoicesCreated++;
      } catch (error: unknown) {
        if (transactionStarted) {
          await tx.query('ROLLBACK').catch(() => undefined);
          transactionStarted = false;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Unknown billing error';

        if (runItemId) {
          await billingRepo.updateBillingRunItem(
            tx,
            runItemId,
            'failed',
            null,
            message
          ).catch((updateError: unknown) => {
            this.app.log.error(updateError);
          });
        }

        failed++;

        this.app.log.error(
          {
            subscriptionId: sub.id,
            error: message
          },
          'Subscription billing failed'
        );
      } finally {
        tx.release();
      }
    }

    // Finalize billing run.
    const finalStatus =
      failed === 0
        ? 'completed'
        : invoicesCreated === 0 && skipped === 0
          ? 'failed'
          : 'partially_failed';

    await db.query(
      `UPDATE billing_runs
       SET status = $1,
           invoices_created = $2,
           failure_count = $3,
           completed_at = now()
       WHERE id = $4`,
      [
        finalStatus,
        invoicesCreated,
        failed,
        run.id
      ]
    );

    return {
      status: finalStatus,
      billingRunId: run.id,
      total: candidates.length,
      invoicesCreated,
      skipped,
      failed
    };
  }

  private toDateOnly(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }

  private parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid billing date: ${value}`);
    }

    return date;
  }

  private calculatePeriodIndex(
    startDate: string,
    billingDate: string,
    interval: string
  ): number {
    const start = this.parseDate(startDate);
    const current = this.parseDate(billingDate);

    if (current < start) {
      throw new Error(
        'Billing date cannot be before subscription start date'
      );
    }

    let index: number;

    if (interval === 'daily') {
      index =
        Math.floor(
          (current.getTime() - start.getTime()) / 86400000
        ) + 1;
    } else if (interval === 'monthly') {
      index =
        (current.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        current.getUTCMonth() -
        start.getUTCMonth() +
        1;
    } else if (interval === 'yearly') {
      index =
        current.getUTCFullYear() -
        start.getUTCFullYear() +
        1;
    } else {
      throw new Error(
        `Unsupported billing interval: ${interval}`
      );
    }

    if (!Number.isSafeInteger(index) || index < 1) {
      throw new Error('Invalid billing period index');
    }

    return index;
  }

  // Add months while preserving the day where possible.
  // Example: January 31 + 1 month = February 28/29.
  private addMonthsClamped(date: Date, months: number): Date {
    const result = new Date(date);
    const originalDay = result.getUTCDate();

    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);

    const lastDay = new Date(
      Date.UTC(
        result.getUTCFullYear(),
        result.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

    result.setUTCDate(Math.min(originalDay, lastDay));

    return result;
  }

  private calculatePeriodEnd(
    startDate: string,
    interval: string
  ): string {
    const start = this.parseDate(startDate);
    let endExclusive: Date;

    if (interval === 'daily') {
      endExclusive = new Date(start);
      endExclusive.setUTCDate(
        endExclusive.getUTCDate() + 1
      );
    } else if (interval === 'monthly') {
      endExclusive = this.addMonthsClamped(start, 1);
    } else if (interval === 'yearly') {
      endExclusive = this.addMonthsClamped(start, 12);
    } else {
      throw new Error(
        `Unsupported billing interval: ${interval}`
      );
    }

    endExclusive.setUTCDate(
      endExclusive.getUTCDate() - 1
    );

    return endExclusive.toISOString().slice(0, 10);
  }

  private addDays(date: string, days: number): string {
    const result = this.parseDate(date);

    result.setUTCDate(
      result.getUTCDate() + days
    );

    return result.toISOString().slice(0, 10);
  }
}

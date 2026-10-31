// src/services/billingEngine.service.ts
import type { FastifyInstance } from 'fastify';
import { billingRepo } from '../repositories/billingRepo.js';
import { invoiceRepo } from '../repositories/invoiceRepo.js';
import { InvoiceBuilder, type BillingItem } from './invoiceBuilder.service.js';
import { DiscountManager } from './discountManager.serivce.js';
import { addDays, assertDateString, getPeriodForDate } from '../utils/billingPeriod.js';

type BillingConfig = {
  taxRateBasisPoints: number;
  paymentTermsDays: number;
};

export class BillingEngine {
  private readonly builder = new InvoiceBuilder();
  private readonly discounts = new DiscountManager();

  constructor(private readonly app: FastifyInstance) {}

  // Tax rate and payment terms are not stored in the schema, so they come from configuration.
  private readConfig(): BillingConfig {
    const taxRateBasisPoints = Number(process.env.DEFAULT_TAX_RATE_BPS ?? 0);
    const paymentTermsDays = Number(process.env.DEFAULT_PAYMENT_TERMS_DAYS ?? 0);

    if (!Number.isSafeInteger(taxRateBasisPoints) || taxRateBasisPoints < 0 || taxRateBasisPoints > 10000) {
      throw new Error('DEFAULT_TAX_RATE_BPS must be between 0 and 10000');
    }
    if (!Number.isSafeInteger(paymentTermsDays) || paymentTermsDays < 0) {
      throw new Error('DEFAULT_PAYMENT_TERMS_DAYS must be a non-negative integer');
    }
    return { taxRateBasisPoints, paymentTermsDays };
  }

  // Single pricing path shared by preview and the real run.
  private async priceInvoice(
    db: any,
    items: BillingItem[],
    taxRateBasisPoints: number,
    discountCode: string | null,
    pendingRedemptions = 0
  ) {
    let discountId: string | null = null;
    let discountAmount = 0;

    if (discountCode) {
      const summary = this.builder.summarize(items);
      const evaluation = await this.discounts.evaluate(
        db,
        discountCode,
        summary.subtotal,
        summary.quantity,
        pendingRedemptions
      );
      if (evaluation.discountId) {
        discountId = evaluation.discountId;
        discountAmount = evaluation.appliedAmount;
      }
    }

    const { lines, totals } = this.builder.build(items, taxRateBasisPoints, discountAmount);
    return { lines, totals, discountId, discountAmount };
  }

  /** Dry run: what a billing run on `targetDate` would create. Writes nothing. */
  async preview(targetDate: string, discountCode?: string | null) {
    assertDateString(targetDate);
    const config = this.readConfig();
    const code = discountCode?.trim() || null;

    const client = await this.app.db.getClient();
    try {
      const due = await billingRepo.getDueSubscriptions(client, targetDate);
      const ids = due.map((s) => s.id);
      const itemsBySubscription = await billingRepo.getItemsForSubscriptions(client, ids);
      const existing = await invoiceRepo.getExistingPeriods(client, ids);

      let expectedRevenue = 0;
      let willSkip = 0;
      let discountsGranted = 0;
      const candidates: Record<string, unknown>[] = [];

      for (const sub of due) {
        const base = {
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscription_number,
          customerId: sub.customer_id
        };

        try {
          const period = getPeriodForDate(sub.start_date, sub.billing_interval, sub.next_billing_date);
          const alreadyInvoiced = existing.has(`${sub.id}:${period.periodIndex}`);
          const items = itemsBySubscription.get(sub.id) ?? [];

          if (items.length === 0) throw new Error('Subscription has no billing items');

          const priced = await this.priceInvoice(
            client,
            items,
            config.taxRateBasisPoints,
            alreadyInvoiced ? null : code,
            discountsGranted
          );

          if (alreadyInvoiced) {
            willSkip++;
          } else {
            expectedRevenue += priced.totals.totalAmount;
            if (priced.discountId) discountsGranted++;
          }

          candidates.push({
            ...base,
            periodIndex: period.periodIndex,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            ...priced.totals,
            discountApplied: priced.discountId !== null,
            alreadyInvoiced
          });
        } catch (error) {
          candidates.push({
            ...base,
            error: error instanceof Error ? error.message : 'Unknown billing error'
          });
        }
      }

      return {
        subscriptionsDue: due.length,
        willSkip,
        expectedRevenue,
        candidates
      };
    } finally {
      client.release();
    }
  }

  async runBillingBatch(targetDate: string, runNumber: string, discountCode?: string | null) {
    assertDateString(targetDate);
    const config = this.readConfig();
    const code = discountCode?.trim() || null;
    const db = this.app.db;

    const setupClient = await db.getClient();
    let candidates;
    let run: { id: string };
    try {
      candidates = await billingRepo.getDueSubscriptions(setupClient, targetDate);
      if (candidates.length === 0) {
        return { status: 'completed', total: 0, invoicesCreated: 0, skipped: 0, failed: 0 };
      }
      run = await billingRepo.createBillingRun(setupClient, runNumber, targetDate, candidates.length);
    } finally {
      setupClient.release();
    }

    let invoicesCreated = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of candidates) {
      const tx = await db.getClient();
      let runItemId: string | null = null;
      let inTransaction = false;

      try {
        const period = getPeriodForDate(sub.start_date, sub.billing_interval, sub.next_billing_date);

        // The run item is written first (its own commit) so a failure can still be recorded.
        const runItem = await billingRepo.createBillingRunItem(
          tx, run.id, sub.id, period.periodIndex, period.periodStart, period.periodEnd
        );
        runItemId = runItem.id;

        await tx.query('BEGIN');
        inTransaction = true;

        // Lock the subscription and make sure nobody else billed it in the meantime.
        const locked = await billingRepo.lockSubscription(tx, sub.id);
        if (!locked || locked.status !== 'active' || locked.next_billing_date !== sub.next_billing_date) {
          await billingRepo.updateBillingRunItem(
            tx, runItemId, 'skipped', null, 'Subscription already billed or no longer active'
          );
          await tx.query('COMMIT');
          inTransaction = false;
          skipped++;
          continue;
        }

        const items = await billingRepo.getSubscriptionItems(tx, sub.id);
        if (items.length === 0) {
          throw new Error('Subscription has no billing items');
        }

        const priced = await this.priceInvoice(tx, items, config.taxRateBasisPoints, code);

        // A duplicate period violates the unique recurring-invoice index. The savepoint
        // lets us treat that as "already billed" without aborting the whole transaction.
        let invoice: { id: string } | null = null;
        await tx.query('SAVEPOINT create_invoice');
        try {
          invoice = await invoiceRepo.createInvoice(tx, {
            invoiceNumber: `INV-${sub.subscription_number}-${period.periodIndex}`,
            customerId: sub.customer_id,
            subscriptionId: sub.id,
            billingRunId: run.id,
            periodIndex: period.periodIndex,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            issueDate: targetDate,
            dueDate: addDays(targetDate, config.paymentTermsDays),
            totals: priced.totals
          });
        } catch (error: any) {
          if (error?.code !== '23505') throw error;

          await tx.query('ROLLBACK TO SAVEPOINT create_invoice');
          const existing = await invoiceRepo.findActiveRecurringInvoice(tx, sub.id, period.periodIndex);
          if (!existing) throw error; // a different unique violation (e.g. invoice number)
        }

        if (!invoice) {
          // Period already invoiced: move the subscription on so it is not retried forever.
          await billingRepo.advanceSubscription(tx, sub.id, sub.next_billing_date, period.nextBillingDate);
          await billingRepo.updateBillingRunItem(
            tx, runItemId, 'skipped', null, 'Invoice already exists for this billing period'
          );
          await tx.query('COMMIT');
          inTransaction = false;
          skipped++;
          continue;
        }

        await invoiceRepo.createInvoiceItems(tx, invoice.id, priced.lines);

        if (priced.discountId) {
          await this.discounts.redeem(tx, priced.discountId, invoice.id, sub.customer_id, priced.discountAmount);
        }

        const advanced = await billingRepo.advanceSubscription(
          tx, sub.id, sub.next_billing_date, period.nextBillingDate
        );
        if (!advanced) {
          throw new Error('Subscription billing date changed during billing');
        }

        await billingRepo.updateBillingRunItem(tx, runItemId, 'success', invoice.id);
        await tx.query('COMMIT');
        inTransaction = false;
        invoicesCreated++;
      } catch (error: unknown) {
        if (inTransaction) {
          await tx.query('ROLLBACK').catch(() => undefined);
          inTransaction = false;
        }

        const message = error instanceof Error ? error.message : 'Unknown billing error';

        if (runItemId) {
          await billingRepo
            .updateBillingRunItem(tx, runItemId, 'failed', null, message)
            .catch((updateError: unknown) => this.app.log.error(updateError));
        }

        failed++;
        this.app.log.error({ subscriptionId: sub.id, error: message }, 'Subscription billing failed');
      } finally {
        tx.release();
      }
    }

    const finalStatus =
      failed === 0 ? 'completed' : invoicesCreated === 0 && skipped === 0 ? 'failed' : 'partially_failed';

    const finalClient = await db.getClient();
    try {
      await billingRepo.finalizeBillingRun(finalClient, run.id, finalStatus, invoicesCreated, failed);
    } finally {
      finalClient.release();
    }

    return {
      status: finalStatus,
      billingRunId: run.id,
      total: candidates.length,
      invoicesCreated,
      skipped,
      failed
    };
  }
}

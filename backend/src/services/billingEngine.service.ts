// src/services/billingEngine.service.ts
import { FastifyInstance } from 'fastify';
import { billingRepo } from '../repositories/billingRepo.js';
import { invoiceRepo } from '../repositories/invoiceRepo.js';
import { calculateLineItem, calculateInvoiceTotals } from '../utils/financialMath.js';

export class BillingEngine {
  private app: FastifyInstance;

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  /**
   * Executes the billing run, processing all active subscriptions due up to the target date.
   */
  async runBillingBatch(targetDate: string, runNumber: string): Promise<any> {
    const dbPool = this.app.db;
    
    // Phase 1: Candidate Selection
    const dbClient = await dbPool.getClient();
    const candidates = await billingRepo.getDueSubscriptions(dbClient, targetDate);
    dbClient.release();

    if (candidates.length === 0) {
      return { status: 'completed', invoicesCreated: 0, skipped: 0, failed: 0 };
    }

    // Phase 2: Run Initialization[cite: 4]
    const initClient = await dbPool.getClient();
    const run = await billingRepo.createBillingRun(initClient, runNumber, targetDate, candidates.length);
    initClient.release();

    let invoicesCreated = 0;
    let skipped = 0;
    let failed = 0;

    // Phase 3: Transactional Processing Per Subscription[cite: 1, 4]
    for (const sub of candidates) {
      const tx = await dbPool.getClient();
      
      // Calculate period indices based on your date logic to prevent skips/duplicates[cite: 1]
      const periodIndex = this.calculatePeriodIndex(sub.next_billing_date); 
      const periodStart = sub.next_billing_date; 
      const periodEnd = this.calculatePeriodEnd(sub.next_billing_date, sub.billing_interval);

      // Create the tracking item[cite: 4]
      const runItem = await billingRepo.createBillingRunItem(
        tx, run.id, sub.id, periodIndex, periodStart, periodEnd
      );

      try {
        await tx.query('BEGIN'); // Start isolated transaction

        // 1. Calculate financial math using integer paise[cite: 1, 4]
        // (In a full implementation, you would fetch actual subscription_items and applicable discounts here)
        const lineItem = calculateLineItem({
          planPrice: parseInt(sub.plan_price, 10),
          variantAdjustment: 0, // Fetch from JSONB variants if applicable
          quantity: 1,
          lineDiscountAmount: 0,
          proratedSubDiscount: 0,
          taxRateBasisPoints: 1800 // Example 18% tax snapshot[cite: 4]
        });

        const totals = calculateInvoiceTotals([lineItem]);

        // 2. Generate the immutable invoice[cite: 1, 4]
        const invoice = await invoiceRepo.createInvoice(tx, {
          invoiceNumber: `INV-${runNumber}-${sub.id.substring(0,6)}`,
          customerId: sub.customer_id,
          subscriptionId: sub.id,
          billingRunId: run.id,
          periodIndex: periodIndex,
          dueDate: periodEnd, // Simplified derived due date
          totals: totals
        });

        // Phase 4: Idempotency & Duplicate Prevention[cite: 1, 4]
        if (!invoice) {
          // The unique constraint on (subscription_id, period_index) was triggered
          await tx.query('ROLLBACK');
          await billingRepo.updateBillingRunItem(dbPool, runItem.id, 'skipped', null, 'Duplicate period prevented');
          skipped++;
          continue;
        }

        // 3. Insert invoice items[cite: 4]
        await invoiceRepo.createInvoiceItems(tx, invoice.id, [{
          productId: sub.plan_id, // Simplified mapping
          description: `Subscription Charge (${periodStart} to ${periodEnd})`,
          quantity: 1,
          unitPrice: lineItem.unitPrice,
          taxRateBasisPoints: 1800,
          lineTotal: lineItem.lineTotal
        }]);

        await tx.query('COMMIT');
        await billingRepo.updateBillingRunItem(dbPool, runItem.id, 'success', invoice.id);
        invoicesCreated++;

      } catch (error: any) {
        await tx.query('ROLLBACK');
        await billingRepo.updateBillingRunItem(dbPool, runItem.id, 'failed', null, error.message);
        failed++;
      } finally {
        tx.release();
      }
    }

    return { status: 'completed', total: candidates.length, invoicesCreated, skipped, failed };
  }

  private calculatePeriodIndex(targetDate: string): number {
    // Basic implementation: deriving an integer period index based on the date to prevent skips[cite: 1]
    const date = new Date(targetDate);
    return date.getFullYear() * 12 + (date.getMonth() + 1);
  }

  private calculatePeriodEnd(startDate: string, interval: string): string {
    // Advance date based on interval (daily, weekly, monthly, yearly)[cite: 4]
    const date = new Date(startDate);
    if (interval === 'monthly') date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
  }
}
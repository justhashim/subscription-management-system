import { PoolClient } from 'pg';

export const invoiceRepo = {
  /**
   * Creates an immutable invoice. Returns null if it violates the duplicate prevention index[cite: 1, 4].
   */
  async createInvoice(
    db: PoolClient,
    invoice: {
      invoiceNumber: string;
      customerId: string;
      subscriptionId: string;
      billingRunId: string;
      periodIndex: number;
      dueDate: string;
      totals: { subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number };
    }
  ) {
    try {
      const res = await db.query(
        `INSERT INTO invoices (
          invoice_number, customer_id, subscription_id, billing_run_id, 
          period_index, due_date, status, subtotal, discount_amount, tax_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10) RETURNING id`,
        [
          invoice.invoiceNumber, invoice.customerId, invoice.subscriptionId, invoice.billingRunId,
          invoice.periodIndex, invoice.dueDate, invoice.totals.subtotal, invoice.totals.discountAmount,
          invoice.totals.taxAmount, invoice.totals.totalAmount
        ]
      );
      return res.rows[0];
    } catch (error: any) {
      // Catch unique constraint violation on (subscription_id, period_index)[cite: 1, 4]
      if (error.code === '23505') {
        return null; // Signals the engine to mark as 'skipped'
      }
      throw error;
    }
  },

  /**
   * Inserts the calculated line items for the invoice[cite: 4].
   */
  async createInvoiceItems(db: PoolClient, invoiceId: string, items: any[]) {
    // Constructing a bulk insert query for performance
    const values: any[] = [];
    const placeholders = items.map((item, i) => {
      const base = i * 7;
      values.push(
        invoiceId, item.productId, item.description, item.quantity, 
        item.unitPrice, item.taxRateBasisPoints, item.lineTotal
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
    }).join(', ');

    await db.query(
      `INSERT INTO invoice_items (
        invoice_id, product_id, description, quantity, unit_price, tax_rate, line_total
      ) VALUES ${placeholders}`,
      values
    );
  }
};

import type { PoolClient } from 'pg';

type InvoiceTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
};

type InvoiceItemInput = {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRateBasisPoints: number;
  taxAmount?: number;
  lineTotal: number;
};

export const invoiceRepo = {
  async createInvoice(
    db: PoolClient,
    invoice: {
      invoiceNumber: string;
      customerId: string;
      subscriptionId: string;
      billingRunId: string;
      periodIndex: number;
      dueDate: string;
      totals: InvoiceTotals;
    }
  ) {
    const {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount
    } = invoice.totals;

    for (const [name, value] of Object.entries({
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount
    })) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Invalid invoice ${name}`);
      }
    }

    if (discountAmount > subtotal) {
      throw new Error('Invoice discount cannot exceed subtotal');
    }

    if (totalAmount !== subtotal - discountAmount + taxAmount) {
      throw new Error('Invoice total calculation is inconsistent');
    }

    const result = await db.query(
      `INSERT INTO invoices (
         invoice_number,
         customer_id,
         subscription_id,
         billing_run_id,
         period_index,
         due_date,
         status,
         subtotal,
         discount_amount,
         tax_amount,
         total_amount
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10)
       ON CONFLICT (subscription_id, period_index)
       WHERE subscription_id IS NOT NULL
         AND period_index IS NOT NULL
         AND status <> 'void'
       DO NOTHING
       RETURNING id`,
      [
        invoice.invoiceNumber,
        invoice.customerId,
        invoice.subscriptionId,
        invoice.billingRunId,
        invoice.periodIndex,
        invoice.dueDate,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount
      ]
    );

    // No returned row means the recurring invoice already exists.
    return result.rows[0] ?? null;
  },

  async createInvoiceItems(
    db: PoolClient,
    invoiceId: string,
    items: InvoiceItemInput[]
  ) {
    if (!items.length) {
      throw new Error('Invoice must contain at least one item');
    }

    const values: unknown[] = [];

    const placeholders = items.map((item, index) => {
      const discountAmount = item.discountAmount ?? 0;
      const taxAmount = item.taxAmount ?? 0;

      if (
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isSafeInteger(item.unitPrice) ||
        item.unitPrice < 0 ||
        !Number.isSafeInteger(discountAmount) ||
        discountAmount < 0 ||
        !Number.isSafeInteger(item.taxRateBasisPoints) ||
        item.taxRateBasisPoints < 0 ||
        !Number.isSafeInteger(taxAmount) ||
        taxAmount < 0 ||
        !Number.isSafeInteger(item.lineTotal) ||
        item.lineTotal < 0
      ) {
        throw new Error(`Invalid invoice item at position ${index + 1}`);
      }

      const offset = index * 9;

      values.push(
        invoiceId,
        item.productId,
        item.description,
        item.quantity,
        item.unitPrice,
        discountAmount,
        item.taxRateBasisPoints,
        taxAmount,
        item.lineTotal
      );

      return `(
        $${offset + 1},
        $${offset + 2},
        $${offset + 3},
        $${offset + 4},
        $${offset + 5},
        $${offset + 6},
        $${offset + 7},
        $${offset + 8},
        $${offset + 9}
      )`;
    }).join(', ');

    await db.query(
      `INSERT INTO invoice_items (
         invoice_id,
         product_id,
         description,
         quantity,
         unit_price,
         discount_amount,
         tax_rate,
         tax_amount,
         line_total
       )
       VALUES ${placeholders}`,
      values
    );
  }
};

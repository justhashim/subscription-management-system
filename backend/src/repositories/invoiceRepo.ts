// src/repositories/invoiceRepo.ts
import type { PoolClient } from 'pg';
import type { InvoiceTotals } from '../utils/financialMath.js';

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

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';

const DATE = (column: string) => `to_char(${column}, 'YYYY-MM-DD')`;
const toInt = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));

export const invoiceRepo = {
  /**
   * Inserts a draft recurring invoice. A duplicate (subscription_id, period_index)
   * raises a unique violation (23505); the billing engine handles it inside a savepoint.
   */
  async createInvoice(
    db: PoolClient,
    invoice: {
      invoiceNumber: string;
      customerId: string;
      subscriptionId: string;
      billingRunId: string;
      periodIndex: number;
      periodStart: string;
      periodEnd: string;
      issueDate: string;
      dueDate: string;
      totals: InvoiceTotals;
    }
  ): Promise<{ id: string }> {
    const { subtotal, discountAmount, taxAmount, totalAmount } = invoice.totals;

    for (const [name, value] of Object.entries({ subtotal, discountAmount, taxAmount, totalAmount })) {
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
         invoice_number, customer_id, subscription_id, billing_run_id, period_index,
         billing_period_start, billing_period_end, issue_date, due_date, status,
         subtotal, discount_amount, tax_amount, total_amount
       )
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8::date, $9::date, 'draft', $10, $11, $12, $13)
       RETURNING id`,
      [
        invoice.invoiceNumber,
        invoice.customerId,
        invoice.subscriptionId,
        invoice.billingRunId,
        invoice.periodIndex,
        invoice.periodStart,
        invoice.periodEnd,
        invoice.issueDate,
        invoice.dueDate,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount
      ]
    );
    return result.rows[0];
  },

  async createInvoiceItems(db: PoolClient, invoiceId: string, items: InvoiceItemInput[]) {
    if (!items.length) {
      throw new Error('Invoice must contain at least one item');
    }

    const values: unknown[] = [];
    const placeholders = items
      .map((item, index) => {
        const discountAmount = item.discountAmount ?? 0;
        const taxAmount = item.taxAmount ?? 0;

        if (
          !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
          !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 ||
          !Number.isSafeInteger(discountAmount) || discountAmount < 0 ||
          discountAmount > item.quantity * item.unitPrice ||
          !Number.isSafeInteger(item.taxRateBasisPoints) ||
          item.taxRateBasisPoints < 0 || item.taxRateBasisPoints > 10000 ||
          !Number.isSafeInteger(taxAmount) || taxAmount < 0 ||
          !Number.isSafeInteger(item.lineTotal) || item.lineTotal < 0
        ) {
          throw new Error(`Invalid invoice item at position ${index + 1}`);
        }

        const o = index * 9;
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
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9})`;
      })
      .join(', ');

    await db.query(
      `INSERT INTO invoice_items (
         invoice_id, product_id, description, quantity, unit_price,
         discount_amount, tax_rate, tax_amount, line_total
       )
       VALUES ${placeholders}`,
      values
    );
  },

  async findActiveRecurringInvoice(db: PoolClient, subscriptionId: string, periodIndex: number) {
    const result = await db.query(
      `SELECT id FROM invoices
       WHERE subscription_id = $1 AND period_index = $2 AND status <> 'void'
       LIMIT 1`,
      [subscriptionId, periodIndex]
    );
    return result.rows[0] ?? null;
  },

  // Set of "subscriptionId:periodIndex" that already have a non-void invoice (preview).
  async getExistingPeriods(db: PoolClient, subscriptionIds: string[]): Promise<Set<string>> {
    const set = new Set<string>();
    if (subscriptionIds.length === 0) return set;

    const result = await db.query(
      `SELECT subscription_id, period_index
       FROM invoices
       WHERE subscription_id = ANY($1::uuid[])
         AND period_index IS NOT NULL
         AND status <> 'void'`,
      [subscriptionIds]
    );
    for (const row of result.rows) {
      set.add(`${row.subscription_id}:${row.period_index}`);
    }
    return set;
  },

  // customerIds is set only for customer logins: they see their own non-draft invoices.
  async listInvoices(
    db: PoolClient, status: InvoiceStatus | undefined, limit: number, offset: number, customerIds?: string[]
  ) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (customerIds) {
      params.push(customerIds);
      conditions.push(`i.customer_id = ANY($${params.length}::uuid[])`, `i.status <> 'draft'`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await db.query(
      `SELECT i.id, i.invoice_number, i.customer_id, c.customer_name, i.subscription_id,
              i.status, ${DATE('i.issue_date')} AS issue_date, ${DATE('i.due_date')} AS due_date,
              i.subtotal, i.discount_amount, i.tax_amount, i.total_amount
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       ${where}
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return result.rows.map((row: any) => ({
      ...row,
      subtotal: toInt(row.subtotal),
      discount_amount: toInt(row.discount_amount),
      tax_amount: toInt(row.tax_amount),
      total_amount: toInt(row.total_amount)
    }));
  },

  async getInvoiceWithItems(db: PoolClient, invoiceId: string) {
    const header = await db.query(
      `SELECT i.id, i.invoice_number, i.status, i.customer_id,
              c.customer_name, c.legal_name, c.email AS customer_email, c.tax_id,
              c.billing_address_line1, c.billing_address_line2, c.city, c.state,
              c.postal_code, c.country,
              i.subscription_id, s.subscription_number, i.period_index,
              ${DATE('i.billing_period_start')} AS billing_period_start,
              ${DATE('i.billing_period_end')} AS billing_period_end,
              ${DATE('i.issue_date')} AS issue_date, ${DATE('i.due_date')} AS due_date,
              i.subtotal, i.discount_amount, i.tax_amount, i.total_amount,
              i.notes, i.issued_at
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN subscriptions s ON s.id = i.subscription_id
       WHERE i.id = $1`,
      [invoiceId]
    );
    if (!header.rows[0]) return null;

    const items = await db.query(
      `SELECT id, product_id, description, quantity, unit_price,
              discount_amount, tax_rate, tax_amount, line_total
       FROM invoice_items
       WHERE invoice_id = $1
       ORDER BY description ASC, id ASC`,
      [invoiceId]
    );

    const h = header.rows[0];
    return {
      ...h,
      subtotal: toInt(h.subtotal),
      discount_amount: toInt(h.discount_amount),
      tax_amount: toInt(h.tax_amount),
      total_amount: toInt(h.total_amount),
      items: items.rows.map((row: any) => ({
        ...row,
        quantity: toInt(row.quantity),
        unit_price: toInt(row.unit_price),
        discount_amount: toInt(row.discount_amount),
        tax_rate: toInt(row.tax_rate),
        tax_amount: toInt(row.tax_amount),
        line_total: toInt(row.line_total)
      }))
    };
  },

  async getInvoiceForUpdate(db: PoolClient, invoiceId: string) {
    const result = await db.query(
      `SELECT id, status FROM invoices WHERE id = $1 FOR UPDATE`,
      [invoiceId]
    );
    return (result.rows[0] ?? null) as { id: string; status: InvoiceStatus } | null;
  },

  async hasConfirmedAllocations(db: PoolClient, invoiceId: string): Promise<boolean> {
    const result = await db.query(
      `SELECT EXISTS (
         SELECT 1
         FROM payment_allocations pa
         JOIN payments p ON p.id = pa.payment_id
         WHERE pa.invoice_id = $1 AND p.status = 'confirmed'
       ) AS found`,
      [invoiceId]
    );
    return result.rows[0].found === true;
  },

  // Only the status (and issued_at) ever change on an invoice after creation.
  async markIssued(db: PoolClient, invoiceId: string) {
    await db.query(
      `UPDATE invoices
       SET status = 'issued', issued_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'draft'`,
      [invoiceId]
    );
  },

  async markVoid(db: PoolClient, invoiceId: string) {
    await db.query(
      `UPDATE invoices
       SET status = 'void', updated_at = now()
       WHERE id = $1 AND status IN ('draft', 'issued')`,
      [invoiceId]
    );
  }
};

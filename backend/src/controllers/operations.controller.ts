import type { FastifyInstance, FastifyRequest } from 'fastify';
import { customerScope } from '../plugins/auth.plugin.js';

const money = (value: unknown) => Number(value ?? 0);
const date = (value: unknown) => value instanceof Date ? value.toISOString() : String(value ?? '');

export default async function operationsController(app: FastifyInstance) {
  app.get('/api/operations/snapshot', { preHandler: app.authenticate }, async (request: FastifyRequest) => {
    const scope = customerScope(request.user);
    const client = await app.db.getClient();
    try {
      const scopeClause = scope ? ' AND c.id = ANY($1::uuid[])' : '';
      const scopeParams = scope ? [scope] : [];
      const customers = await client.query(
        `SELECT c.id, c.customer_name, c.legal_name, c.email, c.phone, c.tax_id, c.status, c.created_at,
                (SELECT COUNT(*)::int FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') AS active_subscriptions,
                COALESCE((SELECT SUM(i.total_amount - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = i.id AND p.status = 'confirmed'), 0))
                  FROM invoices i WHERE i.customer_id = c.id AND i.status <> 'void'), 0) AS outstanding_amount
         FROM customers c
         WHERE true ${scopeClause}
         ORDER BY c.customer_name`, scopeParams,
      );

      const customerIds = scope ? scope : null;
      const filter = customerIds ? 'WHERE q.customer_id = ANY($1::uuid[]) AND q.status <> \'draft\'' : '';
      const params = customerIds ? [customerIds] : [];
      const quotes = await client.query(
        `SELECT q.id, q.quotation_number, q.customer_id, c.customer_name, q.template_name, q.status,
                q.valid_until, q.total_amount, q.items, q.created_at
         FROM quotations q JOIN customers c ON c.id = q.customer_id ${filter}
         ORDER BY q.created_at DESC LIMIT 100`, params,
      );
      const invoices = await client.query(
        `SELECT i.id, i.invoice_number, i.customer_id, c.customer_name, i.subscription_id, i.status,
                i.issue_date, i.due_date, i.subtotal, i.tax_amount, i.discount_amount, i.total_amount,
                COALESCE(pa.paid_amount, 0) AS paid_amount,
                COALESCE(json_agg(json_build_object('id', ii.id, 'description', ii.description, 'quantity', ii.quantity,
                  'unitPrice', ii.unit_price, 'taxRate', ii.tax_rate, 'taxAmount', ii.tax_amount, 'amount', ii.line_total))
                  FILTER (WHERE ii.id IS NOT NULL), '[]') AS lines
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
         LEFT JOIN LATERAL (SELECT SUM(amount) AS paid_amount FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = i.id AND p.status = 'confirmed') pa ON true
         ${customerIds ? 'WHERE i.customer_id = ANY($1::uuid[]) AND i.status <> \'draft\'' : ''}
         GROUP BY i.id, c.customer_name, pa.paid_amount ORDER BY i.created_at DESC LIMIT 100`, params,
      );
      const payments = await client.query(
        `SELECT p.id, p.payment_number, p.amount, p.method, p.payment_date, p.note, p.status,
                pa.invoice_id,
                i.invoice_number, c.customer_name
         FROM payments p JOIN customers c ON c.id = p.customer_id
         LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
         LEFT JOIN invoices i ON i.id = pa.invoice_id
         ${customerIds ? 'WHERE p.customer_id = ANY($1::uuid[])' : ''}
         ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 100`, params,
      );
      const discounts = scope ? { rows: [] as any[] } : await client.query(
        `SELECT d.id, d.name, d.code, d.discount_type, d.discount_value, d.minimum_purchase,
                d.minimum_quantity, d.starts_at, d.ends_at, d.max_redemptions, d.status,
                COUNT(dr.id)::int AS used_redemptions
         FROM discounts d LEFT JOIN discount_redemptions dr ON dr.discount_id = d.id
         GROUP BY d.id ORDER BY d.created_at DESC`,
      );
      const runs = scope ? { rows: [] as any[] } : await client.query(
        `SELECT id, run_number, billing_date, status, total_subscriptions, invoices_created,
                started_at, completed_at,
                COALESCE((SELECT SUM(total_amount) FROM invoices i WHERE i.billing_run_id = br.id AND i.status <> 'void'), 0) AS revenue
         FROM billing_runs br ORDER BY started_at DESC LIMIT 50`,
      );
      const recurring = await client.query(
        `SELECT COALESCE(SUM(CASE billing_interval
                  WHEN 'daily' THEN plan_price * 365.0 / 12
                  WHEN 'weekly' THEN plan_price * 52.0 / 12
                  WHEN 'yearly' THEN plan_price / 12.0
                  ELSE plan_price END), 0) AS mrr
         FROM subscriptions
         WHERE status IN ('active', 'paused') ${scope ? 'AND customer_id = ANY($1::uuid[])' : ''}`,
        params,
      );

      const invoiceRows = invoices.rows.map((row: any) => ({
        id: row.id, number: row.invoice_number, customerId: row.customer_id, customerName: row.customer_name,
        subscriptionId: row.subscription_id, status: String(row.status).toUpperCase(), issueDate: date(row.issue_date),
        dueDate: date(row.due_date), subtotal: money(row.subtotal), taxAmount: money(row.tax_amount),
        discountAmount: money(row.discount_amount), total: money(row.total_amount), paidAmount: money(row.paid_amount),
        lines: row.lines,
      }));
      const paid = invoiceRows.reduce((sum: number, row: any) => sum + row.paidAmount, 0);
      const outstanding = invoiceRows.reduce((sum: number, row: any) => sum + Math.max(row.total - row.paidAmount, 0), 0);
      return {
        customers: customers.rows.map((row: any) => ({ id: row.id, name: row.customer_name, legalName: row.legal_name, email: row.email, phone: row.phone, taxId: row.tax_id, status: String(row.status).toUpperCase(), createdAt: date(row.created_at), activeSubscriptions: Number(row.active_subscriptions), outstandingAmount: money(row.outstanding_amount) })),
        quotes: quotes.rows.map((row: any) => ({ id: row.id, number: row.quotation_number, customerId: row.customer_id, customerName: row.customer_name, templateName: row.template_name, status: String(row.status).toUpperCase(), validUntil: date(row.valid_until), total: money(row.total_amount), lines: row.items ?? [], createdAt: date(row.created_at) })),
        invoices: invoiceRows,
        payments: payments.rows.map((row: any) => ({ id: row.id, number: row.payment_number, invoiceId: row.invoice_id, invoiceNumber: row.invoice_number, customerName: row.customer_name, method: String(row.method).toUpperCase(), amount: money(row.amount), paymentDate: date(row.payment_date), note: row.note, status: String(row.status).toUpperCase() })),
        discounts: discounts.rows.map((row: any) => ({ id: row.id, name: row.name, code: row.code, type: String(row.discount_type).toUpperCase(), value: row.discount_type === 'percentage' ? money(row.discount_value) / 100 : money(row.discount_value), minimumPurchase: money(row.minimum_purchase), minimumQuantity: Number(row.minimum_quantity), startsAt: date(row.starts_at), endsAt: row.ends_at ? date(row.ends_at) : undefined, maxRedemptions: row.max_redemptions === null ? undefined : Number(row.max_redemptions), usedRedemptions: Number(row.used_redemptions), status: String(row.status).toUpperCase() })),
        billingRuns: runs.rows.map((row: any) => ({ id: row.id, number: row.run_number, billingDate: date(row.billing_date), status: String(row.status).toUpperCase(), subscriptions: Number(row.total_subscriptions), invoicesCreated: Number(row.invoices_created), revenue: money(row.revenue), startedAt: date(row.started_at), completedAt: row.completed_at ? date(row.completed_at) : undefined })),
        summary: {
          activeSubscriptions: customers.rows.reduce((sum: number, row: any) => sum + Number(row.active_subscriptions), 0),
          mrr: Math.round(money(recurring.rows[0]?.mrr)), arr: Math.round(money(recurring.rows[0]?.mrr) * 12), revenueCollected: paid, outstanding,
          overdue: invoiceRows.filter((row: any) => row.status === 'OVERDUE').reduce((sum: number, row: any) => sum + row.total - row.paidAmount, 0),
          overdueCount: invoiceRows.filter((row: any) => row.status === 'OVERDUE').length,
        },
      };
    } finally {
      client.release();
    }
  });
}

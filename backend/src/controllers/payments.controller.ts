import type { FastifyInstance, FastifyRequest } from 'fastify';
import { customerScope } from '../plugins/auth.plugin.js';
import { AppError, makeNumber } from '../utils/errors.js';

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export default async function paymentsController(app: FastifyInstance) {
  app.get('/api/payments', { preHandler: app.authenticate }, async (request: FastifyRequest) => {
    const scope = customerScope(request.user);
    const params = scope ? [scope] : [];
    const where = scope ? 'WHERE p.customer_id = ANY($1::uuid[])' : '';
    const result = await app.db.query(
      `SELECT p.id, p.payment_number, p.customer_id, c.customer_name, p.amount, p.method,
              p.payment_date, p.note, p.status, pa.invoice_id, i.invoice_number
       FROM payments p JOIN customers c ON c.id = p.customer_id
       LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
       LEFT JOIN invoices i ON i.id = pa.invoice_id
       ${where} ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 100`, params,
    );
    return { data: result.rows };
  });

  app.post('/api/payments', {
    preHandler: app.requireRole('admin', 'staff'),
    schema: {
      body: {
        type: 'object', required: ['invoice_id', 'amount', 'method'], additionalProperties: false,
        properties: {
          invoice_id: { type: 'string', pattern: UUID },
          amount: { type: 'integer', minimum: 1 },
          method: { type: 'string', enum: ['upi', 'card', 'cash', 'bank_transfer', 'cheque', 'online'] },
          payment_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          note: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request: FastifyRequest) => {
    const body = request.body as { invoice_id: string; amount: number; method: string; payment_date?: string; note?: string };
    const client = await app.db.getClient();
    try {
      await client.query('BEGIN');
      const invoice = await client.query(
        `SELECT id, customer_id, total_amount, status FROM invoices WHERE id = $1 FOR UPDATE`, [body.invoice_id],
      );
      if (!invoice.rows[0]) throw new AppError(404, 'Invoice not found');
      if (['void', 'draft'].includes(invoice.rows[0].status)) throw new AppError(409, 'Only issued invoices can receive payments');
      const allocated = await client.query(
        `SELECT COALESCE(SUM(pa.amount), 0) AS amount FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.invoice_id = $1 AND p.status = 'confirmed'`, [body.invoice_id],
      );
      const remaining = Number(invoice.rows[0].total_amount) - Number(allocated.rows[0].amount);
      if (body.amount > remaining) throw new AppError(422, 'Payment cannot exceed the invoice balance');
      const payment = await client.query(
        `INSERT INTO payments (payment_number, customer_id, amount, method, payment_date, status, note, created_by)
         VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), 'confirmed', $6, $7) RETURNING id, payment_number`,
        [makeNumber('PAY'), invoice.rows[0].customer_id, body.amount, body.method, body.payment_date ?? null, body.note ?? null, request.user.sub],
      );
      await client.query(`INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES ($1, $2, $3)`, [payment.rows[0].id, body.invoice_id, body.amount]);
      const paid = Number(allocated.rows[0].amount) + body.amount;
      await client.query(`UPDATE invoices SET status = $2, updated_at = now() WHERE id = $1`, [body.invoice_id, paid === Number(invoice.rows[0].total_amount) ? 'paid' : 'partially_paid']);
      await client.query('COMMIT');
      return { data: { ...payment.rows[0], invoice_id: body.invoice_id, amount: body.amount } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });
}

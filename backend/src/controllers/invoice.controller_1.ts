// src/controllers/invoice.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { invoiceRepo, type InvoiceStatus } from '../repositories/invoiceRepo.js';
import { InvoiceActionError, InvoiceLifecycle } from '../services/invoiceLifecycle.service.js';
import { renderInvoiceHtml } from '../templates/invoicePrint.js';
import { customerScope, type AuthUser } from '../plugins/auth.plugin.js';

const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: UUID_PATTERN } }
};

// Customers may only view their own invoices, and never drafts.
const hiddenFrom = (user: AuthUser, invoice: { customer_id: string; status: string }) =>
  user.role === 'customer' && (!user.customerIds.includes(invoice.customer_id) || invoice.status === 'draft');

export default async function invoicesController(fastify: FastifyInstance) {
  const lifecycle = new InvoiceLifecycle(fastify);
  const staff = fastify.requireRole('admin', 'staff');

  const handleError = (reply: FastifyReply, error: unknown, fallback: string) => {
    if (error instanceof InvoiceActionError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    fastify.log.error(error);
    return reply.status(500).send({ error: fallback });
  };

  const runAction = (action: 'confirm' | 'cancel' | 'void', fallback: string) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await lifecycle[action](id);
        return reply.send({ success: true, ...result });
      } catch (error) {
        return handleError(reply, error, fallback);
      }
    };

  /** Paginated invoice list (indexed filter + LIMIT keeps it fast). */
  fastify.get('/api/invoices', {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'issued', 'partially_paid', 'paid', 'void'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: InvoiceStatus; limit?: number; offset?: number;
    };

    const client = await fastify.db.getClient();
    try {
      const data = await invoiceRepo.listInvoices(client, status, limit, offset, customerScope(request.user));
      return reply.send({ data, limit, offset });
    } catch (error) {
      return handleError(reply, error, 'Failed to fetch invoices');
    } finally {
      client.release();
    }
  });

  /** One invoice with its line items. */
  fastify.get('/api/invoices/:id', { preHandler: fastify.authenticate, schema: { params: idParams } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = await fastify.db.getClient();
      try {
        const invoice = await invoiceRepo.getInvoiceWithItems(client, id);
        if (!invoice || hiddenFrom(request.user, invoice)) return reply.status(404).send({ error: 'Invoice not found' });
        return reply.send({ data: invoice });
      } catch (error) {
        return handleError(reply, error, 'Failed to fetch invoice');
      } finally {
        client.release();
      }
    });

  /** Printable invoice (HTML; use the browser's Print / Save as PDF). */
  fastify.get('/api/invoices/:id/print', { preHandler: fastify.authenticate, schema: { params: idParams } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = await fastify.db.getClient();
      try {
        const invoice = await invoiceRepo.getInvoiceWithItems(client, id);
        if (!invoice || hiddenFrom(request.user, invoice)) return reply.status(404).send({ error: 'Invoice not found' });
        return reply.type('text/html; charset=utf-8').send(renderInvoiceHtml(invoice));
      } catch (error) {
        return handleError(reply, error, 'Failed to render invoice');
      } finally {
        client.release();
      }
    });

  /** Draft -> issued. */
  fastify.post('/api/invoices/:id/confirm', { preHandler: staff, schema: { params: idParams } },
    runAction('confirm', 'Failed to confirm invoice'));

  /** Cancel a draft invoice. */
  fastify.post('/api/invoices/:id/cancel', { preHandler: staff, schema: { params: idParams } },
    runAction('cancel', 'Failed to cancel invoice'));

  /** Void an issued invoice (corrections use void and re-issue, never edits). */
  fastify.post('/api/invoices/:id/void', { preHandler: staff, schema: { params: idParams } },
    runAction('void', 'Failed to void invoice'));
}

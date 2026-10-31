// src/services/invoiceLifecycle.service.ts
import type { FastifyInstance } from 'fastify';
import { invoiceRepo } from '../repositories/invoiceRepo.js';

export class InvoiceActionError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

type Action = 'confirm' | 'cancel' | 'void';

export class InvoiceLifecycle {
  constructor(private readonly app: FastifyInstance) {}

  /** draft -> issued */
  confirm(invoiceId: string) {
    return this.transition(invoiceId, 'confirm');
  }

  /** Cancel a draft (stored as 'void': the schema has no separate cancelled status). */
  cancel(invoiceId: string) {
    return this.transition(invoiceId, 'cancel');
  }

  /** Void an issued invoice that has no payments against it. */
  void(invoiceId: string) {
    return this.transition(invoiceId, 'void');
  }

  private async transition(invoiceId: string, action: Action) {
    const client = await this.app.db.getClient();

    try {
      await client.query('BEGIN');

      const invoice = await invoiceRepo.getInvoiceForUpdate(client, invoiceId);
      if (!invoice) {
        throw new InvoiceActionError(404, 'Invoice not found');
      }

      let newStatus: 'issued' | 'void';

      if (action === 'confirm') {
        if (invoice.status !== 'draft') {
          throw new InvoiceActionError(409, `Only draft invoices can be confirmed (current status: ${invoice.status})`);
        }
        await invoiceRepo.markIssued(client, invoiceId);
        newStatus = 'issued';
      } else if (action === 'cancel') {
        if (invoice.status !== 'draft') {
          throw new InvoiceActionError(409, `Only draft invoices can be cancelled (current status: ${invoice.status})`);
        }
        await invoiceRepo.markVoid(client, invoiceId);
        newStatus = 'void';
      } else {
        if (invoice.status !== 'issued') {
          throw new InvoiceActionError(
            409,
            `Only issued invoices without payments can be voided (current status: ${invoice.status})`
          );
        }
        if (await invoiceRepo.hasConfirmedAllocations(client, invoiceId)) {
          throw new InvoiceActionError(409, 'Invoice has payments allocated and cannot be voided');
        }
        await invoiceRepo.markVoid(client, invoiceId);
        newStatus = 'void';
      }

      // Discount quota is released automatically: redemptions on void invoices are not counted.
      await client.query('COMMIT');
      return { id: invoiceId, status: newStatus };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

// src/controllers/billing.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { BillingEngine } from '../services/billingEngine.service.js';

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

export default async function billingController(fastify: FastifyInstance) {
  const billingEngine = new BillingEngine(fastify);

  /**
   * Billing Cockpit dry run: subscriptions due and the exact invoice amounts a run
   * would create. Writes nothing.
   */
  fastify.get('/api/billing/preview', {
    schema: {
      querystring: {
        type: 'object',
        required: ['targetDate'],
        properties: {
          targetDate: { type: 'string', pattern: DATE_PATTERN },
          discountCode: { type: 'string', maxLength: 50 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { targetDate, discountCode } = request.query as { targetDate: string; discountCode?: string };

    try {
      return reply.send(await billingEngine.preview(targetDate, discountCode));
    } catch (error) {
      fastify.log.error(error);
      const message = error instanceof Error && error.message.startsWith('Invalid date')
        ? error.message
        : 'Failed to generate billing preview';
      return reply.status(message.startsWith('Invalid date') ? 400 : 500).send({ error: message });
    }
  });

  /**
   * Commit a billing run. Each subscription is billed in its own transaction, so one
   * failure never blocks the others, and a period can never be invoiced twice.
   */
  fastify.post('/api/billing/run', {
    schema: {
      body: {
        type: 'object',
        required: ['targetDate', 'runNumber'],
        properties: {
          targetDate: { type: 'string', pattern: DATE_PATTERN },
          runNumber: { type: 'string', minLength: 1, maxLength: 50 },
          discountCode: { type: 'string', maxLength: 50 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { targetDate, runNumber, discountCode } = request.body as {
      targetDate: string; runNumber: string; discountCode?: string;
    };

    try {
      return reply.send(await billingEngine.runBillingBatch(targetDate, runNumber, discountCode));
    } catch (error: any) {
      fastify.log.error(error);
      if (error?.code === '23505') {
        return reply.status(409).send({ error: 'Billing run number already exists' });
      }
      if (error instanceof Error && error.message.startsWith('Invalid date')) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Billing run failed' });
    }
  });
}

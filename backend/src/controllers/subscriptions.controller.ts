// src/controllers/subscriptions.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SubscriptionService, type RequestedItem, type SubAction } from '../services/subscription.service.js';
import { DATE_PATTERN, UUID_PATTERN } from '../utils/errors.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: UUID_PATTERN } }
};

const ACTIONS: SubAction[] = ['quote', 'confirm', 'activate', 'pause', 'resume', 'close'];

export default async function subscriptionsController(fastify: FastifyInstance) {
  const service = new SubscriptionService(fastify);

  fastify.post('/api/subscriptions', {
    preHandler: fastify.requireRole('admin', 'staff'),
    schema: {
      body: {
        type: 'object',
        required: ['customer_id', 'plan_id', 'start_date'],
        additionalProperties: false,
        properties: {
          customer_id: { type: 'string', pattern: UUID_PATTERN },
          plan_id: { type: 'string', pattern: UUID_PATTERN },
          start_date: { type: 'string', pattern: DATE_PATTERN },
          end_date: { type: ['string', 'null'], pattern: DATE_PATTERN },
          auto_renew: { type: 'boolean' },
          // Optional: defaults to the plan's included products. Prices always come from the catalogue.
          items: {
            type: 'array',
            maxItems: 50,
            items: {
              type: 'object',
              required: ['product_id', 'quantity'],
              additionalProperties: false,
              properties: {
                product_id: { type: 'string', pattern: UUID_PATTERN },
                variant_name: { type: ['string', 'null'], maxLength: 100 },
                quantity: { type: 'integer', minimum: 1 }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await service.create(request.user, request.body as {
      customer_id: string; plan_id: string; start_date: string; end_date?: string | null;
      auto_renew?: boolean; items?: RequestedItem[];
    });
    return reply.status(201).send({ data });
  });

  fastify.get('/api/subscriptions', {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'quotation', 'confirmed', 'active', 'paused', 'closed'] },
          customer_id: { type: 'string', pattern: UUID_PATTERN },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { status?: string; customer_id?: string; limit?: number; offset?: number };
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const data = await service.list(request.user, { status: q.status, customer_id: q.customer_id, limit, offset });
    return reply.send({ data, limit, offset });
  });

  fastify.get('/api/subscriptions/:id', { preHandler: fastify.authenticate, schema: { params: idParams } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ data: await service.get(request.user, (request.params as { id: string }).id) });
    });

  fastify.patch('/api/subscriptions/:id', {
    preHandler: fastify.requireRole('admin', 'staff'),
    schema: {
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          start_date: { type: 'string', pattern: DATE_PATTERN },
          end_date: { type: ['string', 'null'], pattern: DATE_PATTERN },
          auto_renew: { type: 'boolean' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await service.update(
      request.user,
      (request.params as { id: string }).id,
      request.body as { start_date?: string; end_date?: string | null; auto_renew?: boolean }
    );
    return reply.send({ data });
  });

  // Lifecycle actions. Staff can do all; customers only pause/resume/close their own (checked in the service).
  for (const action of ACTIONS) {
    fastify.post(`/api/subscriptions/:id/${action}`, {
      preHandler: fastify.authenticate,
      schema: { params: idParams }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ data: await service.act(request.user, (request.params as { id: string }).id, action) });
    });
  }

  fastify.post('/api/subscriptions/:id/renew', { preHandler: fastify.authenticate, schema: { params: idParams } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ data: await service.renew(request.user, (request.params as { id: string }).id) });
    });

  /** Closes expired subscriptions of plans with auto_close (also runs hourly from server.ts). */
  fastify.post('/api/subscriptions/close-expired', { preHandler: fastify.requireRole('admin', 'staff') },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ closed: await service.closeExpired() });
    });
}

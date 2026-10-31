// src/controllers/quotations.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { QuotationService } from '../services/quotation.service.js';
import type { RequestedItem } from '../services/subscription.service.js';
import { DATE_PATTERN, UUID_PATTERN } from '../utils/errors.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: UUID_PATTERN } }
};

export default async function quotationsController(fastify: FastifyInstance) {
  const service = new QuotationService(fastify);
  const idOf = (request: FastifyRequest) => (request.params as { id: string }).id;

  fastify.post('/api/quotations', {
    preHandler: fastify.requireRole('admin', 'staff'),
    schema: {
      body: {
        type: 'object',
        required: ['customer_id'],
        additionalProperties: false,
        properties: {
          customer_id: { type: 'string', pattern: UUID_PATTERN },
          template_name: { type: 'string', minLength: 1, maxLength: 100 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          notes: { type: 'string', maxLength: 2000 },
          valid_days: { type: 'integer', minimum: 1, maximum: 365 },
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
      customer_id: string; template_name?: string; title?: string; notes?: string;
      valid_days?: number; items?: RequestedItem[];
    });
    return reply.status(201).send({ data });
  });

  fastify.get('/api/quotations', {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] },
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
    return reply.send({
      data: await service.list(request.user, { status: q.status, customer_id: q.customer_id, limit, offset }),
      limit,
      offset
    });
  });

  fastify.get('/api/quotations/:id', { preHandler: fastify.authenticate, schema: { params: idParams } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ data: await service.get(request.user, idOf(request)) });
    });

  for (const action of ['send', 'accept', 'reject'] as const) {
    fastify.post(`/api/quotations/:id/${action}`, { preHandler: fastify.authenticate, schema: { params: idParams } },
      async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({ data: await service.changeStatus(request.user, idOf(request), action) });
      });
  }

  fastify.post('/api/quotations/:id/convert', {
    preHandler: fastify.requireRole('admin', 'staff'),
    schema: {
      params: idParams,
      body: {
        type: 'object',
        required: ['plan_id', 'start_date'],
        additionalProperties: false,
        properties: {
          plan_id: { type: 'string', pattern: UUID_PATTERN },
          start_date: { type: 'string', pattern: DATE_PATTERN },
          end_date: { type: ['string', 'null'], pattern: DATE_PATTERN }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await service.convert(
      request.user,
      idOf(request),
      request.body as { plan_id: string; start_date: string; end_date?: string | null }
    );
    return reply.status(201).send({ data });
  });
}

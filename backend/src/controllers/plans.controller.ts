// src/controllers/plans.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { planRepo, type PlanInput } from '../repositories/planRepo.js';
import { productRepo } from '../repositories/productRepo.js';
import { AppError, DATE_PATTERN, UUID_PATTERN, type Db } from '../utils/errors.js';

const INTERVALS = ['daily', 'weekly', 'monthly', 'yearly'];

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: UUID_PATTERN } }
};

const fields = {
  name: { type: 'string', minLength: 1, maxLength: 150 },
  description: { type: ['string', 'null'] },
  billing_interval: { type: 'string', enum: INTERVALS },
  price: { type: 'integer', minimum: 0 },
  currency: { type: 'string', minLength: 3, maxLength: 3 },
  minimum_quantity: { type: 'integer', minimum: 1 },
  included_products: {
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
  },
  available_from: { type: ['string', 'null'], pattern: DATE_PATTERN },
  available_until: { type: ['string', 'null'], pattern: DATE_PATTERN },
  auto_close: { type: 'boolean' },
  allow_early_close: { type: 'boolean' },
  allow_pause: { type: 'boolean' },
  allow_renewal: { type: 'boolean' }
};

async function validateIncluded(db: Db, items: NonNullable<PlanInput['included_products']> | undefined) {
  if (!items?.length) return;
  const found = await productRepo.findByIds(db, [...new Set(items.map((i) => i.product_id))]);
  const byId = new Map(found.map((p: any) => [p.id, p]));
  for (const item of items) {
    const product: any = byId.get(item.product_id);
    if (!product || product.status !== 'active') {
      throw new AppError(422, `Product ${item.product_id} does not exist or is inactive`);
    }
    if (item.variant_name && !product.variants.some((v: any) => v.name === item.variant_name)) {
      throw new AppError(422, `Product "${product.name}" has no variant "${item.variant_name}"`);
    }
  }
}

function validateDates(from?: string | null, until?: string | null) {
  for (const value of [from, until]) {
    if (value && Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new AppError(400, `Invalid date: ${value}`);
  }
  if (from && until && until < from) throw new AppError(400, 'available_until cannot be before available_from');
}

export default async function plansController(fastify: FastifyInstance) {
  fastify.post('/api/plans', {
    preHandler: fastify.requireRole('admin'),
    schema: {
      body: {
        type: 'object',
        required: ['name', 'billing_interval', 'price'],
        additionalProperties: false,
        properties: fields
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as PlanInput;
    validateDates(body.available_from, body.available_until);
    await validateIncluded(fastify.db, body.included_products);
    return reply.status(201).send({ data: await planRepo.insert(fastify.db, body) });
  });

  fastify.get('/api/plans', {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'] },
          billing_interval: { type: 'string', enum: INTERVALS },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { status?: string; billing_interval?: string; limit?: number; offset?: number };
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const status = request.user.role === 'customer' ? 'active' : q.status;
    const data = await planRepo.list(fastify.db, { status, interval: q.billing_interval, limit, offset });
    return reply.send({ data, limit, offset });
  });

  fastify.get('/api/plans/:id', { preHandler: fastify.authenticate, schema: { params: idParams } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const plan = await planRepo.getById(fastify.db, (request.params as { id: string }).id);
      if (!plan || (request.user.role === 'customer' && plan.status !== 'active')) {
        throw new AppError(404, 'Plan not found');
      }
      return reply.send({ data: plan });
    });

  /** Editing a plan never changes existing subscriptions: they snapshot interval and price. */
  fastify.patch('/api/plans/:id', {
    preHandler: fastify.requireRole('admin'),
    schema: {
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: { ...fields, status: { type: 'string', enum: ['active', 'inactive'] } }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<PlanInput>;
    const current = await planRepo.getById(fastify.db, id);
    if (!current) throw new AppError(404, 'Plan not found');

    validateDates(
      body.available_from !== undefined ? body.available_from : current.available_from,
      body.available_until !== undefined ? body.available_until : current.available_until
    );
    await validateIncluded(fastify.db, body.included_products);
    return reply.send({ data: await planRepo.patch(fastify.db, id, body) });
  });

  /** Deactivate instead of deleting: subscriptions keep referencing the plan. */
  fastify.delete('/api/plans/:id', {
    preHandler: fastify.requireRole('admin'),
    schema: { params: idParams }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const updated = await planRepo.patch(fastify.db, (request.params as { id: string }).id, { status: 'inactive' });
    if (!updated) throw new AppError(404, 'Plan not found');
    return reply.send({ data: updated });
  });
}

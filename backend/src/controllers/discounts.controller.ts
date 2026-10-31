// src/controllers/discounts.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { discountRepo } from '../repositories/discountRepo.js';

export default async function discountsController(fastify: FastifyInstance) {
  /**
   * Create a discount rule (admin only: fixed paise amount or percentage in basis points).
   */
  fastify.post('/api/discounts', {
    preHandler: fastify.requireRole('admin'),
    schema: {
      body: {
        type: 'object',
        required: ['name', 'code', 'discountType', 'discountValue'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 150 },
          code: { type: 'string', minLength: 1, maxLength: 50 },
          discountType: { type: 'string', enum: ['fixed', 'percentage'] },
          discountValue: { type: 'integer', minimum: 1 },
          minimumPurchase: { type: 'integer', minimum: 0 },
          minimumQuantity: { type: 'integer', minimum: 1 },
          startsAt: { type: 'string' },
          endsAt: { type: 'string' },
          maxRedemptions: { type: 'integer', minimum: 1 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    const name = String(body.name).trim();
    const code = String(body.code).trim();
    if (!name || !code) {
      return reply.status(400).send({ error: 'Name and code are required' });
    }

    if (body.discountType === 'percentage' && body.discountValue > 10000) {
      return reply.status(400).send({ error: 'Percentage must be at most 10000 basis points (100%)' });
    }

    const startsAt: string | null = body.startsAt ?? null;
    const endsAt: string | null = body.endsAt ?? null;
    const startMs = startsAt ? Date.parse(startsAt) : null;
    const endMs = endsAt ? Date.parse(endsAt) : null;

    if ((startMs !== null && Number.isNaN(startMs)) || (endMs !== null && Number.isNaN(endMs))) {
      return reply.status(400).send({ error: 'startsAt and endsAt must be valid date-times' });
    }
    if (startMs !== null && endMs !== null && endMs <= startMs) {
      return reply.status(400).send({ error: 'endsAt must be later than startsAt' });
    }

    const client = await fastify.db.getClient();
    try {
      const discount = await discountRepo.createDiscount(client, {
        name,
        code,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minimumPurchase: body.minimumPurchase ?? 0,
        minimumQuantity: body.minimumQuantity ?? 1,
        startsAt,
        endsAt,
        maxRedemptions: body.maxRedemptions ?? null
      });
      return reply.status(201).send({ success: true, discount });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.code === '23505') {
        return reply.status(409).send({ error: 'Discount code must be unique' });
      }
      if (error.code === '23514') {
        return reply.status(400).send({ error: 'Discount values violate database constraints' });
      }
      return reply.status(500).send({ error: 'Failed to create discount' });
    } finally {
      client.release();
    }
  });

  /** List discount rules. */
  fastify.get('/api/discounts', { preHandler: fastify.requireRole('admin', 'staff') }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.db.getClient();
    try {
      return reply.send({ data: await discountRepo.listDiscounts(client) });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch discounts' });
    } finally {
      client.release();
    }
  });
}

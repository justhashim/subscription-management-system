// src/controllers/discounts.controller.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function discountsController(fastify: FastifyInstance) {
  
  /**
   * Create a new discount rule (Admin only)[cite: 8]
   */
 fastify.post('/api/discounts', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'code', 'discountType', 'discountValue'],
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          discountType: { type: 'string', enum: ['fixed', 'percentage'] },
          discountValue: { type: 'integer' },
          minimumPurchase: { type: 'integer' },
          minimumQuantity: { type: 'integer' },
          startsAt: { type: 'string' }, // e.g., "2026-10-01T00:00:00Z"
          endsAt: { type: 'string' },
          maxRedemptions: { type: 'integer' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { 
      name, code, discountType, discountValue, 
      minimumPurchase = 0, minimumQuantity = 1, 
      startsAt, endsAt, maxRedemptions 
    } = request.body as any;

    try {
      const res = await fastify.db.query(
        `INSERT INTO discounts (
          name, code, discount_type, discount_value, minimum_purchase, 
          minimum_quantity, starts_at, ends_at, max_redemptions, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active') RETURNING id, code`,
        [
          name, code, discountType, discountValue, minimumPurchase, 
          minimumQuantity, startsAt, endsAt, maxRedemptions
        ]
      );
      return reply.status(201).send({ success: true, discount: res.rows[0] });
    } catch (error: any) {
      fastify.log.error(error);
      if (error.code === '23505') {
        return reply.status(400).send({ error: 'Discount code must be unique' });
      }
      return reply.status(500).send({ error: 'Failed to create discount' });
    }
  });
  /**
   * List active discount rules[cite: 8]
   */
  fastify.get('/api/discounts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await fastify.db.query(
        `SELECT id, name, code, discount_type, discount_value, max_redemptions, status 
         FROM discounts ORDER BY created_at DESC`
      );
      return reply.send({ data: rows });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch discounts' });
    }
  });
}
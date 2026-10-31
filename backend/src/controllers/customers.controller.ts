// src/controllers/customers.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { userRepo } from '../repositories/userRepo.js';

export default async function customersController(fastify: FastifyInstance) {
  /** Read-only customer list for staff (customers are created by sign-up). */
  fastify.get('/api/customers', {
    preHandler: fastify.requireRole('admin', 'staff'),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', maxLength: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, limit = 50, offset = 0 } = request.query as { q?: string; limit?: number; offset?: number };
    return reply.send({ data: await userRepo.listCustomers(fastify.db, q, limit, offset), limit, offset });
  });
}

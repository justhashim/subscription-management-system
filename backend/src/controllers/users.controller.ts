// src/controllers/users.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { userRepo } from '../repositories/userRepo.js';

export default async function usersController(fastify: FastifyInstance) {
  const auth = new AuthService(fastify);

  /** Only the admin can add a member of staff. */
  fastify.post('/api/users/staff', {
    preHandler: fastify.requireRole('admin'),
    schema: {
      body: {
        type: 'object',
        required: ['fullName', 'email', 'password'],
        additionalProperties: false,
        properties: {
          fullName: { type: 'string', minLength: 1, maxLength: 150 },
          email: { type: 'string', format: 'email', maxLength: 255 },
          password: { type: 'string', minLength: 9, maxLength: 72 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await auth.addStaff(request.body as { fullName: string; email: string; password: string });
    return reply.status(201).send({ data: user });
  });

  fastify.get('/api/users/staff', { preHandler: fastify.requireRole('admin') },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ data: await userRepo.listStaff(fastify.db) });
    });
}

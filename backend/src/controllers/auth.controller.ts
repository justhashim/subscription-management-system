// src/controllers/auth.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, type RegisterInput } from '../services/auth.service.js';

const email = { type: 'string', format: 'email', maxLength: 255 };
const password = { type: 'string', minLength: 9, maxLength: 72 };

export default async function authController(fastify: FastifyInstance) {
  const auth = new AuthService(fastify);

  // Role is never read from the body: public sign-up is always a customer.
  fastify.post('/api/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['fullName', 'email', 'password'],
        additionalProperties: false,
        properties: {
          fullName: { type: 'string', minLength: 1, maxLength: 150 },
          email,
          password,
          customerName: { type: 'string', minLength: 1, maxLength: 200 },
          customerType: { type: 'string', enum: ['individual', 'business'] }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(await auth.register(request.body as RegisterInput));
  });

  fastify.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        additionalProperties: false,
        properties: { email, password: { type: 'string', minLength: 1, maxLength: 72 } }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email: e, password: p } = request.body as { email: string; password: string };
    return reply.send(await auth.login(e, p));
  });

  fastify.get('/api/auth/me', { preHandler: fastify.authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ data: await auth.me(request.user.sub) });
    });

  fastify.post('/api/auth/forgot-password', {
    schema: {
      body: { type: 'object', required: ['email'], additionalProperties: false, properties: { email } }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    await auth.forgotPassword((request.body as { email: string }).email);
    return reply.send({ message: 'If that email is registered, a reset link has been sent' });
  });

  fastify.post('/api/auth/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'password'],
        additionalProperties: false,
        properties: { token: { type: 'string', minLength: 10, maxLength: 200 }, password }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, password: p } = request.body as { token: string; password: string };
    await auth.resetPassword(token, p);
    return reply.send({ message: 'Password updated' });
  });
}

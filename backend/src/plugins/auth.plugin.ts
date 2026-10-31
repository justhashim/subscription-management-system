// src/plugins/auth.plugin.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../utils/errors.js';

export type Role = 'admin' | 'staff' | 'customer';

export interface AuthUser {
  sub: string;
  role: Role;
  customerIds: string[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Customer ids a customer login may see; undefined for admin/staff (no restriction). */
export function customerScope(user: AuthUser): string[] | undefined {
  return user.role === 'customer' ? user.customerIds : undefined;
}

/** Customers may only touch their own customer account. 404 so other ids are not revealed. */
export function assertCustomerAccess(user: AuthUser, customerId: string): void {
  if (user.role === 'customer' && !user.customerIds.includes(customerId)) {
    throw new AppError(404, 'Not found');
  }
}

export default fp(async (app) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set to at least 16 characters');
  }

  await app.register(jwt, {
    secret,
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '1d' }
  });

  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, 'Authentication required');
    }
  });

  app.decorate('requireRole', (...roles: Role[]) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(request, reply);
      if (!roles.includes(request.user.role)) {
        throw new AppError(403, 'You do not have permission to do this');
      }
    });
}, { name: 'auth' });

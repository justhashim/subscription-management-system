// src/controllers/products.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { productRepo, type ProductInput } from '../repositories/productRepo.js';
import { AppError, UUID_PATTERN } from '../utils/errors.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: UUID_PATTERN } }
};

// e.g. [{ "name": "Odoo", "price_adjustment": 56000 }]  (paise)
const variants = {
  type: 'array',
  maxItems: 50,
  items: {
    type: 'object',
    required: ['name', 'price_adjustment'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      price_adjustment: { type: 'integer' }
    }
  }
};

const fields = {
  name: { type: 'string', minLength: 1, maxLength: 150 },
  description: { type: ['string', 'null'] },
  product_type: { type: 'string', minLength: 1, maxLength: 30 },
  sales_price: { type: 'integer', minimum: 0 },
  cost_price: { type: 'integer', minimum: 0 },
  variants,
  notes: { type: ['string', 'null'] }
};

function assertVariants(list: { name: string; price_adjustment: number }[] | undefined, salesPrice: number) {
  if (!list) return;
  const names = new Set<string>();
  for (const variant of list) {
    const key = variant.name.trim().toLowerCase();
    if (names.has(key)) throw new AppError(400, `Duplicate variant name: ${variant.name}`);
    names.add(key);
    if (salesPrice + variant.price_adjustment < 0) {
      throw new AppError(400, `Variant "${variant.name}" would make the price negative`);
    }
  }
}

export default async function productsController(fastify: FastifyInstance) {
  // Customers never see internal cost or notes.
  const present = (request: FastifyRequest, product: any) => {
    if (request.user.role !== 'customer') return product;
    const { cost_price, notes, ...rest } = product;
    return rest;
  };

  fastify.post('/api/products', {
    preHandler: fastify.requireRole('admin'),
    schema: {
      body: {
        type: 'object',
        required: ['name', 'product_type', 'sales_price'],
        additionalProperties: false,
        properties: fields
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ProductInput;
    assertVariants(body.variants, body.sales_price);
    return reply.status(201).send({ data: await productRepo.insert(fastify.db, body) });
  });

  fastify.get('/api/products', {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'] },
          q: { type: 'string', maxLength: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { status?: string; q?: string; limit?: number; offset?: number };
    const status = request.user.role === 'customer' ? 'active' : q.status;
    const rows = await productRepo.list(fastify.db, { status, q: q.q, limit: q.limit ?? 50, offset: q.offset ?? 0 });
    return reply.send({ data: rows.map((row: any) => present(request, row)), limit: q.limit ?? 50, offset: q.offset ?? 0 });
  });

  fastify.get('/api/products/:id', { preHandler: fastify.authenticate, schema: { params: idParams } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const product = await productRepo.getById(fastify.db, (request.params as { id: string }).id);
      if (!product || (request.user.role === 'customer' && product.status !== 'active')) {
        throw new AppError(404, 'Product not found');
      }
      return reply.send({ data: present(request, product) });
    });

  fastify.patch('/api/products/:id', {
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
    const body = request.body as Partial<ProductInput>;
    if (body.variants !== undefined || body.sales_price !== undefined) {
      const current = await productRepo.getById(fastify.db, id);
      if (!current) throw new AppError(404, 'Product not found');
      assertVariants(body.variants ?? current.variants, body.sales_price ?? current.sales_price);
    }
    const updated = await productRepo.patch(fastify.db, id, body);
    if (!updated) throw new AppError(404, 'Product not found');
    return reply.send({ data: updated });
  });

  /** Deactivate instead of deleting: subscriptions and invoices keep referencing the product. */
  fastify.delete('/api/products/:id', {
    preHandler: fastify.requireRole('admin'),
    schema: { params: idParams }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const updated = await productRepo.patch(fastify.db, (request.params as { id: string }).id, { status: 'inactive' });
    if (!updated) throw new AppError(404, 'Product not found');
    return reply.send({ data: updated });
  });
}

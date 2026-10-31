// src/services/quotation.service.ts
import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { productRepo } from '../repositories/productRepo.js';
import { quotationRepo } from '../repositories/quotationRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { assertCustomerAccess, customerScope, type AuthUser } from '../plugins/auth.plugin.js';
import { addDays } from '../utils/billingPeriod.js';
import { AppError, makeNumber, withTransaction, type Db } from '../utils/errors.js';
import { createSubscriptionTx, priceItems, todayUtc, type RequestedItem } from './subscription.service.js';

interface Template {
  name: string;
  title: string;
  valid_days: number;
  notes?: string;
  lines?: { product_name: string; variant_name?: string | null; quantity: number }[];
}

type QuoteAction = 'send' | 'accept' | 'reject';

const ACTIONS: Record<QuoteAction, { from: string[]; to: string }> = {
  send: { from: ['draft'], to: 'sent' },
  accept: { from: ['sent'], to: 'accepted' },
  reject: { from: ['sent'], to: 'rejected' }
};

// Templates are plain JSON files in the repository (src/templates/quotations), not database rows.
async function loadTemplate(name: string): Promise<Template> {
  if (!/^[a-z0-9_-]+$/i.test(name)) throw new AppError(400, 'Invalid template name');
  try {
    const file = path.resolve(process.cwd(), 'src', 'templates', 'quotations', `${name}.json`);
    return JSON.parse(await readFile(file, 'utf8')) as Template;
  } catch {
    throw new AppError(404, `Quotation template "${name}" not found`);
  }
}

async function linesFromTemplate(db: Db, lines: NonNullable<Template['lines']>): Promise<RequestedItem[]> {
  if (!lines.length) return [];
  const products = await productRepo.findActiveByNames(db, lines.map((l) => l.product_name));
  const byName = new Map(products.map((p: any) => [p.name.toLowerCase(), p]));
  return lines.map((line) => {
    const product: any = byName.get(line.product_name.toLowerCase());
    if (!product) throw new AppError(422, `Template product "${line.product_name}" was not found in the catalogue`);
    return { product_id: product.id, variant_name: line.variant_name ?? null, quantity: line.quantity };
  });
}

export class QuotationService {
  constructor(private readonly app: FastifyInstance) {}

  /** Builds a quotation from a template. Prices and totals are calculated here, never taken from the client. */
  async create(user: AuthUser, body: {
    customer_id: string; template_name?: string; title?: string; notes?: string;
    valid_days?: number; items?: RequestedItem[];
  }) {
    const templateName = body.template_name ?? 'standard';
    const template = await loadTemplate(templateName);

    const id = await withTransaction(this.app, async (tx) => {
      const customer = await userRepo.getCustomer(tx, body.customer_id);
      if (!customer) throw new AppError(404, 'Customer not found');
      if (customer.status !== 'active') throw new AppError(422, 'Customer is not active');

      const requested = body.items?.length ? body.items : await linesFromTemplate(tx, template.lines ?? []);
      const priced = await priceItems(tx, requested);
      const items = priced.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        variant: item.variant_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.unit_price * item.quantity
      }));

      return quotationRepo.insert(tx, {
        number: makeNumber('QT'),
        customerId: body.customer_id,
        createdBy: user.sub,
        templateName,
        title: body.title ?? template.title,
        items,
        subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
        validUntil: addDays(todayUtc(), body.valid_days ?? template.valid_days),
        notes: body.notes ?? template.notes ?? null
      });
    });
    return this.get(user, id);
  }

  async get(user: AuthUser, id: string) {
    const quotation = await quotationRepo.getById(this.app.db, id);
    if (!quotation) throw new AppError(404, 'Quotation not found');
    assertCustomerAccess(user, quotation.customer_id);
    if (user.role === 'customer' && quotation.status === 'draft') throw new AppError(404, 'Quotation not found');
    return quotation;
  }

  list(user: AuthUser, f: { status?: string; customer_id?: string; limit: number; offset: number }) {
    return quotationRepo.list(this.app.db, {
      status: f.status,
      customerId: user.role === 'customer' ? undefined : f.customer_id,
      customerIds: customerScope(user),
      limit: f.limit,
      offset: f.offset
    });
  }

  /** send (staff) / accept / reject (staff or the customer). Expired quotations cannot be sent or accepted. */
  async changeStatus(user: AuthUser, id: string, action: QuoteAction) {
    if (user.role === 'customer' && action === 'send') {
      throw new AppError(403, 'You do not have permission to do this');
    }

    const outcome = await withTransaction(this.app, async (tx) => {
      const quotation = await quotationRepo.getById(tx, id, true);
      if (!quotation) throw new AppError(404, 'Quotation not found');
      assertCustomerAccess(user, quotation.customer_id);

      const rule = ACTIONS[action];
      if (!rule.from.includes(quotation.status)) {
        throw new AppError(409, `Cannot ${action} a quotation that is ${quotation.status}`);
      }
      if (action !== 'reject' && quotation.valid_until && quotation.valid_until < todayUtc()) {
        await quotationRepo.setStatus(tx, id, 'expired');
        return { expired: true };
      }
      await quotationRepo.setStatus(tx, id, rule.to);
      return { expired: false };
    });

    if (outcome.expired) throw new AppError(409, 'Quotation has expired');
    return this.get(user, id);
  }

  /**
   * accepted quotation -> subscription (status "quotation") + its items + quotation "converted",
   * in one transaction. Quotations have no plan column, so the plan is chosen here.
   */
  async convert(user: AuthUser, id: string, body: { plan_id: string; start_date: string; end_date?: string | null }) {
    const subscriptionId = await withTransaction(this.app, async (tx) => {
      const quotation = await quotationRepo.getById(tx, id, true);
      if (!quotation) throw new AppError(404, 'Quotation not found');
      if (quotation.status !== 'accepted') {
        throw new AppError(409, `Only accepted quotations can be converted (current status: ${quotation.status})`);
      }

      const newId = await createSubscriptionTx(tx, {
        customerId: quotation.customer_id,
        planId: body.plan_id,
        startDate: body.start_date,
        endDate: body.end_date,
        quotationId: quotation.id,
        status: 'quotation',
        createdBy: user.sub,
        pricedItems: (quotation.items as any[]).map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          variant_name: item.variant ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      });
      await quotationRepo.setStatus(tx, id, 'converted');
      return newId;
    });
    return { subscription_id: subscriptionId };
  }
}

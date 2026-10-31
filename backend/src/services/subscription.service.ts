// src/services/subscription.service.ts
import type { FastifyInstance } from 'fastify';
import { planRepo } from '../repositories/planRepo.js';
import { productRepo } from '../repositories/productRepo.js';
import { subscriptionRepo, type SubscriptionItemSnapshot } from '../repositories/subscriptionRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { assertCustomerAccess, customerScope, type AuthUser } from '../plugins/auth.plugin.js';
import { addDays, assertDateString, getPeriodForDate, getResumeBillingDate } from '../utils/billingPeriod.js';
import { AppError, makeNumber, withTransaction, type Db } from '../utils/errors.js';

export type SubStatus = 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'closed';
export type SubAction = 'quote' | 'confirm' | 'activate' | 'pause' | 'resume' | 'close';

/** Draft -> Quotation -> Confirmed -> Active <-> Paused, and any open state -> Closed. */
const ACTIONS: Record<SubAction, { from: SubStatus[]; to: SubStatus }> = {
  quote: { from: ['draft'], to: 'quotation' },
  confirm: { from: ['quotation'], to: 'confirmed' },
  activate: { from: ['confirmed'], to: 'active' },
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  close: { from: ['draft', 'quotation', 'confirmed', 'active', 'paused'], to: 'closed' }
};

/** What a customer may do to their own subscription without contacting staff. */
const CUSTOMER_ACTIONS: SubAction[] = ['pause', 'resume', 'close'];

export const todayUtc = () => new Date().toISOString().slice(0, 10);

export function assertValidDate(value: string, label: string) {
  try {
    assertDateString(value);
  } catch {
    throw new AppError(400, `${label} must be a valid date (YYYY-MM-DD)`);
  }
}

export interface RequestedItem {
  product_id: string;
  variant_name?: string | null;
  quantity: number;
}

/** Prices items from the catalogue (base price + variant adjustment). Client prices are never trusted. */
export async function priceItems(db: Db, requested: RequestedItem[]): Promise<SubscriptionItemSnapshot[]> {
  if (!requested.length) throw new AppError(400, 'At least one item is required');
  const products = await productRepo.findByIds(db, [...new Set(requested.map((r) => r.product_id))]);
  const byId = new Map(products.map((p: any) => [p.id, p]));

  return requested.map((item) => {
    const product: any = byId.get(item.product_id);
    if (!product || product.status !== 'active') {
      throw new AppError(422, `Product ${item.product_id} does not exist or is inactive`);
    }
    let adjustment = 0;
    if (item.variant_name) {
      const variant = product.variants.find((v: any) => v.name === item.variant_name);
      if (!variant) throw new AppError(422, `Product "${product.name}" has no variant "${item.variant_name}"`);
      adjustment = Number(variant.price_adjustment);
    }
    const unitPrice = product.sales_price + adjustment;
    if (unitPrice < 0) throw new AppError(422, `Price for "${product.name}" is negative`);
    return {
      product_id: product.id,
      product_name: product.name,
      variant_name: item.variant_name ?? null,
      quantity: item.quantity,
      unit_price: unitPrice
    };
  });
}

export interface NewSubscription {
  customerId: string;
  planId: string;
  startDate: string;
  endDate?: string | null;
  autoRenew?: boolean;
  quotationId?: string | null;
  status: 'draft' | 'quotation';
  createdBy: string;
  requestedItems?: RequestedItem[];   // priced here from the catalogue
  pricedItems?: SubscriptionItemSnapshot[]; // already priced (converted quotation)
}

/** Creates a subscription and its items. Must run inside a transaction. Returns the new id. */
export async function createSubscriptionTx(db: Db, input: NewSubscription): Promise<string> {
  assertValidDate(input.startDate, 'start_date');
  if (input.endDate) {
    assertValidDate(input.endDate, 'end_date');
    if (input.endDate < input.startDate) throw new AppError(400, 'end_date cannot be before start_date');
  }

  const customer = await userRepo.getCustomer(db, input.customerId);
  if (!customer) throw new AppError(404, 'Customer not found');
  if (customer.status !== 'active') throw new AppError(422, 'Customer is not active');

  const plan = await planRepo.getById(db, input.planId);
  if (!plan) throw new AppError(404, 'Plan not found');
  if (plan.status !== 'active') throw new AppError(422, 'Plan is not active');
  const today = todayUtc();
  if ((plan.available_from && today < plan.available_from) || (plan.available_until && today > plan.available_until)) {
    throw new AppError(422, 'Plan is not available on this date');
  }

  const items = input.pricedItems?.length
    ? input.pricedItems
    : await priceItems(db, input.requestedItems?.length ? input.requestedItems : plan.included_products);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity < plan.minimum_quantity) {
    throw new AppError(422, `This plan requires a minimum quantity of ${plan.minimum_quantity}`);
  }

  const id = await subscriptionRepo.insert(db, {
    number: makeNumber('SUB'),
    customerId: input.customerId,
    quotationId: input.quotationId ?? null,
    planId: plan.id,
    createdBy: input.createdBy,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    billingInterval: plan.billing_interval,   // snapshot
    planPrice: plan.price,                    // snapshot
    status: input.status,
    autoRenew: input.autoRenew ?? true
  });
  await subscriptionRepo.insertItems(db, id, items);
  return id;
}

export class SubscriptionService {
  constructor(private readonly app: FastifyInstance) {}

  async create(user: AuthUser, body: {
    customer_id: string; plan_id: string; start_date: string; end_date?: string | null;
    auto_renew?: boolean; items?: RequestedItem[];
  }) {
    const id = await withTransaction(this.app, (tx) =>
      createSubscriptionTx(tx, {
        customerId: body.customer_id,
        planId: body.plan_id,
        startDate: body.start_date,
        endDate: body.end_date,
        autoRenew: body.auto_renew,
        status: 'draft',
        createdBy: user.sub,
        requestedItems: body.items
      })
    );
    return this.get(user, id);
  }

  async get(user: AuthUser, id: string) {
    const subscription = await subscriptionRepo.getById(this.app.db, id);
    if (!subscription) throw new AppError(404, 'Subscription not found');
    assertCustomerAccess(user, subscription.customer_id);
    return { ...subscription, items: await subscriptionRepo.getItems(this.app.db, id) };
  }

  list(user: AuthUser, f: { status?: string; customer_id?: string; limit: number; offset: number }) {
    return subscriptionRepo.list(this.app.db, {
      status: f.status,
      customerId: user.role === 'customer' ? undefined : f.customer_id,
      customerIds: customerScope(user),
      limit: f.limit,
      offset: f.offset
    });
  }

  /** Dates and auto-renew only. Billing anchor (start_date) is frozen once the subscription is active. */
  async update(user: AuthUser, id: string, body: { start_date?: string; end_date?: string | null; auto_renew?: boolean }) {
    await withTransaction(this.app, async (tx) => {
      const sub = await subscriptionRepo.getById(tx, id, true);
      if (!sub) throw new AppError(404, 'Subscription not found');
      if (sub.status === 'closed') throw new AppError(409, 'A closed subscription cannot be changed');
      if (body.start_date !== undefined && !['draft', 'quotation', 'confirmed'].includes(sub.status)) {
        throw new AppError(409, 'Start date can only be changed before the subscription is active');
      }

      const start = body.start_date ?? sub.start_date;
      const end = body.end_date !== undefined ? body.end_date : sub.end_date;
      assertValidDate(start, 'start_date');
      if (end) {
        assertValidDate(end, 'end_date');
        if (end < start) throw new AppError(400, 'end_date cannot be before start_date');
      }
      await subscriptionRepo.update(tx, id, {
        start_date: body.start_date, end_date: body.end_date, auto_renew: body.auto_renew
      });
    });
    return this.get(user, id);
  }

  /** quote / confirm / activate / pause / resume / close, each validated against ACTIONS. */
  async act(user: AuthUser, id: string, action: SubAction) {
    if (user.role === 'customer' && !CUSTOMER_ACTIONS.includes(action)) {
      throw new AppError(403, 'You do not have permission to do this');
    }

    await withTransaction(this.app, async (tx) => {
      const sub = await subscriptionRepo.getById(tx, id, true);
      if (!sub) throw new AppError(404, 'Subscription not found');
      assertCustomerAccess(user, sub.customer_id);

      const rule = ACTIONS[action];
      if (!rule.from.includes(sub.status)) {
        throw new AppError(409, `Cannot ${action} a subscription that is ${sub.status}`);
      }

      const today = todayUtc();
      const changes: Record<string, unknown> = { status: rule.to };

      if (action === 'activate') {
        if (sub.end_date && sub.end_date < today) throw new AppError(422, 'The subscription end date has already passed');
        changes.next_billing_date = sub.start_date; // makes it visible to the billing engine
      } else if (action === 'pause') {
        if (!sub.allow_pause) throw new AppError(409, 'This plan does not allow pausing');
        changes.paused_at = new Date().toISOString();
      } else if (action === 'resume') {
        changes.next_billing_date = getResumeBillingDate(sub.start_date, sub.billing_interval, today, sub.next_billing_date);
        changes.paused_at = null;
      } else if (action === 'close') {
        const isEarly = !sub.end_date || sub.end_date > today;
        if (['confirmed', 'active', 'paused'].includes(sub.status) && isEarly && !sub.allow_early_close) {
          throw new AppError(409, 'This plan does not allow closing before its end date');
        }
        changes.closed_at = new Date().toISOString();
        changes.next_billing_date = null;
      }

      await subscriptionRepo.update(tx, id, changes);
    });
    return this.get(user, id);
  }

  /** Extends end_date by one billing period (needs allow_renewal on the plan and an end date). */
  async renew(user: AuthUser, id: string) {
    await withTransaction(this.app, async (tx) => {
      const sub = await subscriptionRepo.getById(tx, id, true);
      if (!sub) throw new AppError(404, 'Subscription not found');
      assertCustomerAccess(user, sub.customer_id);
      if (!['active', 'paused'].includes(sub.status)) throw new AppError(409, `Cannot renew a subscription that is ${sub.status}`);
      if (!sub.allow_renewal) throw new AppError(409, 'This plan does not allow renewal');
      if (!sub.end_date) throw new AppError(409, 'This subscription has no end date to extend');

      const nextEnd = getPeriodForDate(sub.start_date, sub.billing_interval, addDays(sub.end_date, 1)).periodEnd;
      await subscriptionRepo.update(tx, id, { end_date: nextEnd });
    });
    return this.get(user, id);
  }

  closeExpired() {
    return subscriptionRepo.closeExpired(this.app.db);
  }
}

/* Backend responses use snake_case while the UI uses domain-shaped camelCase records. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiError } from "./error";
import type { ApiClient } from "./types";
import type {
  AuthUser,
  CreatePlanInput,
  CreateProductInput,
  CreateSubscriptionInput,
  CreateUserInput,
  LoginInput,
  PlanWithProduct,
  Product,
  RegisterInput,
  SubscriptionWithRelations,
  UpdatePlanInput,
  UpdateProductInput,
  UpdateSubscriptionInput,
  UpdateUserInput,
  User,
  OperationsSnapshot,
  ProductVariant,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function unwrapList<T>(value: T[] | { data: T[] }) {
  return Array.isArray(value) ? value : value.data;
}

function unwrapResource<T>(value: T | { data: T }) {
  return value && typeof value === "object" && "data" in value ? value.data : value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiPath = path.startsWith("/api/") ? path : `/api${path}`;
  const response = await fetch(`${API_URL}${apiPath}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? "The request could not be completed.",
      response.status,
      body?.error?.code,
    );
  }

  return body as T;
}

function body(value: unknown) {
  return JSON.stringify(value);
}

function toProduct(value: any = {}): Product {
  return {
    ...value,
    description: value.description ?? "",
    status: String(value.status ?? "active").toUpperCase() === "ACTIVE" ? "ACTIVE" : "ARCHIVED",
    createdAt: value.createdAt ?? value.created_at,
    type: String(value.type ?? value.product_type ?? "SERVICE").toUpperCase() as Product["type"],
    salesPrice: Number(value.salesPrice ?? value.sales_price ?? 0),
    costPrice: Number(value.costPrice ?? value.cost_price ?? 0),
    taxRate: value.tax_rate_bps !== undefined ? Number(value.tax_rate_bps) / 100 : Number(value.taxRate ?? value.tax_rate ?? 0),
    variants: (value.variants ?? []).map((variant: any): ProductVariant => ({
      name: variant.name,
      priceAdjustment: Number(variant.priceAdjustment ?? variant.price_adjustment ?? 0),
    })),
  };
}

function toPlan(value: any): PlanWithProduct {
  return {
    ...value,
    product: toProduct(value.product ?? value.included_products?.[0]?.product),
    productId: value.productId ?? value.product_id,
    createdAt: value.createdAt ?? value.created_at,
    price: Number(value.price ?? 0),
    interval: String(value.interval ?? value.billing_interval ?? "MONTHLY").toUpperCase() as PlanWithProduct["interval"],
    status: String(value.status ?? "active").toUpperCase() === "ACTIVE" ? "ACTIVE" : "ARCHIVED",
    minimumQuantity: Number(value.minimumQuantity ?? value.minimum_quantity ?? 1),
    availableFrom: value.availableFrom ?? value.available_from ?? undefined,
    availableUntil: value.availableUntil ?? value.available_until ?? undefined,
    canPause: value.canPause ?? value.allow_pause,
    canCloseEarly: value.canCloseEarly ?? value.allow_early_close,
    autoClose: value.autoClose ?? value.auto_close,
    canRenew: value.canRenew ?? value.allow_renewal,
  };
}

function toSubscription(value: any): SubscriptionWithRelations {
  return {
    ...value,
    user: value.user,
    plan: toPlan(value.plan),
    product: toProduct(value.product ?? value.plan?.product),
    userId: value.userId ?? value.customer_id ?? value.user_id,
    planId: value.planId ?? value.plan_id,
    currentPeriodStart: value.currentPeriodStart ?? value.start_date,
    currentPeriodEnd: value.currentPeriodEnd ?? value.end_date ?? value.next_billing_date,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd ?? !value.auto_renew,
    createdAt: value.createdAt ?? value.created_at,
    status: String(value.status ?? "draft").toUpperCase() as SubscriptionWithRelations["status"],
  };
}

function normalizeAuthUser(value: AuthUser | { user: AuthUser }) {
  const raw = "user" in value ? value.user : value;
  return "data" in (raw as AuthUser & { data?: AuthUser })
    ? (raw as AuthUser & { data: AuthUser }).data
    : raw;
}

export const httpApi: ApiClient = {
  auth: {
    async login(input: LoginInput) {
      const result = await request<AuthUser | { user: AuthUser }>(
        "/auth/login",
        { method: "POST", body: body(input) },
      );
      return normalizeAuthUser(result);
    },

    async register(input: RegisterInput) {
      const result = await request<AuthUser | { user: AuthUser }>(
        "/auth/register",
        { method: "POST", body: body(input) },
      );
      return normalizeAuthUser(result);
    },

    async logout() {
      await request("/auth/logout", { method: "POST" });
    },

    async me() {
      try {
        const result = await request<AuthUser | { user: AuthUser }>("/auth/me");
        return normalizeAuthUser(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }

        throw error;
      }
    },
  },

  users: {
    async list() {
      return unwrapList(await request<User[]>("/users"));
    },
    async create(input: CreateUserInput) {
      return request<User>("/users", { method: "POST", body: body(input) });
    },
    async update(id: string, input: UpdateUserInput) {
      return request<User>(`/users/${id}`, {
        method: "PATCH",
        body: body(input),
      });
    },
    async remove(id: string) {
      await request(`/users/${id}`, { method: "DELETE" });
    },
  },

  products: {
    async list() {
      return unwrapList(await request<any[]>("/products")).map(toProduct);
    },
    async create(input: CreateProductInput) {
    return toProduct(unwrapResource(await request<any>("/products", {
        method: "POST",
        body: body({
          name: input.name, description: input.description, product_type: input.type?.toLowerCase() ?? "service",
          sales_price: input.salesPrice ?? 0, cost_price: input.costPrice ?? 0,
          tax_rate_bps: Math.round((input.taxRate ?? 0) * 100), notes: input.notes ?? null, variants: input.variants?.map((v) => ({ name: v.name, price_adjustment: v.priceAdjustment })) ?? [],
        }),
      }))) as Product;
    },
    async update(id: string, input: UpdateProductInput) {
      return toProduct(unwrapResource(await request<any>(`/products/${id}`, {
        method: "PATCH",
        body: body(Object.fromEntries(Object.entries({
          name: input.name, description: input.description, product_type: input.type?.toLowerCase(),
          sales_price: input.salesPrice, cost_price: input.costPrice, tax_rate_bps: input.taxRate === undefined ? undefined : Math.round(input.taxRate * 100), notes: input.notes,
          status: input.status?.toLowerCase(), variants: input.variants?.map((v) => ({ name: v.name, price_adjustment: v.priceAdjustment })),
        }).filter(([, value]) => value !== undefined))),
      }))) as Product;
    },
    async remove(id: string) {
      await request(`/products/${id}`, { method: "DELETE" });
    },
  },

  plans: {
    async list() {
      return unwrapList(await request<any[]>("/plans")).map(toPlan);
    },
    async create(input: CreatePlanInput) {
      return toPlan(unwrapResource(await request<any>("/plans", {
        method: "POST",
        body: body({
          name: input.name, description: input.description, billing_interval: input.interval.toLowerCase(), price: input.price,
          currency: input.currency, minimum_quantity: input.minimumQuantity ?? 1,
          included_products: input.includedProducts?.map((item) => ({ product_id: item.productId, variant_name: item.variantName ?? null, quantity: item.quantity })) ?? [],
          available_from: input.availableFrom ?? null, available_until: input.availableUntil ?? null,
          auto_close: input.autoClose ?? false, allow_early_close: input.canCloseEarly ?? true,
          allow_pause: input.canPause ?? true, allow_renewal: input.canRenew ?? true,
        }),
      })));
    },
    async update(id: string, input: UpdatePlanInput) {
      return toPlan(unwrapResource(await request<any>(`/plans/${id}`, {
        method: "PATCH",
        body: body(Object.fromEntries(Object.entries({
          name: input.name, description: input.description, billing_interval: input.interval?.toLowerCase(), price: input.price,
          currency: input.currency, minimum_quantity: input.minimumQuantity, available_from: input.availableFrom,
          available_until: input.availableUntil, auto_close: input.autoClose, allow_early_close: input.canCloseEarly,
          allow_pause: input.canPause, allow_renewal: input.canRenew, status: input.status?.toLowerCase(),
          included_products: input.includedProducts?.map((item) => ({ product_id: item.productId, variant_name: item.variantName ?? null, quantity: item.quantity })),
        }).filter(([, value]) => value !== undefined))),
      })));
    },
    async remove(id: string) {
      await request(`/plans/${id}`, { method: "DELETE" });
    },
  },

  subscriptions: {
    async list() {
      return unwrapList(await request<any[]>("/subscriptions")).map(toSubscription);
    },
    async get(id: string) {
      return toSubscription(unwrapResource(await request<any>(`/subscriptions/${id}`)));
    },
    async create(input: CreateSubscriptionInput) {
      return toSubscription(unwrapResource(await request<any>("/subscriptions", {
        method: "POST",
        body: body({ customer_id: input.customerId, plan_id: input.planId, start_date: input.startDate, end_date: input.endDate ?? null, auto_renew: input.autoRenew ?? true }),
      })));
    },
    async update(id: string, input: UpdateSubscriptionInput) {
      return toSubscription(unwrapResource(await request<any>(`/subscriptions/${id}`, {
        method: "PATCH",
        body: body({ start_date: input.startDate, end_date: input.endDate, auto_renew: input.autoRenew }),
      })));
    },
  },

  operations: {
    async snapshot() {
      return request<OperationsSnapshot>("/operations/snapshot");
    },
  },
};

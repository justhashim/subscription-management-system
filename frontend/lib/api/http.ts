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
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function unwrapList<T>(value: T[] | { data: T[] }) {
  return Array.isArray(value) ? value : value.data;
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
      return unwrapList(await request<Product[]>("/products"));
    },
    async create(input: CreateProductInput) {
      return request<Product>("/products", {
        method: "POST",
        body: body(input),
      });
    },
    async update(id: string, input: UpdateProductInput) {
      return request<Product>(`/products/${id}`, {
        method: "PATCH",
        body: body(input),
      });
    },
    async remove(id: string) {
      await request(`/products/${id}`, { method: "DELETE" });
    },
  },

  plans: {
    async list() {
      return unwrapList(await request<PlanWithProduct[]>("/plans"));
    },
    async create(input: CreatePlanInput) {
      return request<PlanWithProduct>("/plans", {
        method: "POST",
        body: body(input),
      });
    },
    async update(id: string, input: UpdatePlanInput) {
      return request<PlanWithProduct>(`/plans/${id}`, {
        method: "PATCH",
        body: body(input),
      });
    },
    async remove(id: string) {
      await request(`/plans/${id}`, { method: "DELETE" });
    },
  },

  subscriptions: {
    async list() {
      return unwrapList(
        await request<SubscriptionWithRelations[]>("/subscriptions"),
      );
    },
    async get(id: string) {
      return request<SubscriptionWithRelations>(`/subscriptions/${id}`);
    },
    async create(input: CreateSubscriptionInput) {
      return request<SubscriptionWithRelations>("/subscriptions", {
        method: "POST",
        body: body(input),
      });
    },
    async update(id: string, input: UpdateSubscriptionInput) {
      return request<SubscriptionWithRelations>(`/subscriptions/${id}`, {
        method: "PATCH",
        body: body(input),
      });
    },
  },

  operations: {
    async snapshot() {
      return request<OperationsSnapshot>("/operations/snapshot");
    },
  },
};

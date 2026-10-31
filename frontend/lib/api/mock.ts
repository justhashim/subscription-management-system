import { ApiError } from "./error";
import type { ApiClient } from "./types";
import { getClientSession } from "@/lib/auth/session";
import {
  createId,
  loadMockData,
  saveMockData,
  wait,
} from "@/lib/mock/store";
import {
  nextPeriodEnd,
  type MockUser,
} from "@/lib/mock/seed";
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

function getRelations(data = loadMockData()) {
  return {
    data,
    userById: new Map(data.users.map((user) => [user.id, user])),
    productById: new Map(data.products.map((product) => [product.id, product])),
    planById: new Map(data.plans.map((plan) => [plan.id, plan])),
  };
}

function toPublicUser(user: MockUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function requireRelation<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new ApiError(`${label} was not found.`, 404, "NOT_FOUND");
  }

  return value;
}

function toPlanWithProduct(
  planId: string,
  data = loadMockData(),
): PlanWithProduct {
  const { planById, productById } = getRelations(data);
  const plan = requireRelation(planById.get(planId), "Plan");
  const product = requireRelation(productById.get(plan.productId), "Product");

  return { ...plan, product };
}

function toSubscriptionWithRelations(
  subscriptionId: string,
  data = loadMockData(),
): SubscriptionWithRelations {
  const { data: current, userById, planById, productById } =
    getRelations(data);
  const subscription = requireRelation(
    current.subscriptions.find((item) => item.id === subscriptionId),
    "Subscription",
  );
  const user = requireRelation(userById.get(subscription.userId), "User");
  const plan = requireRelation(planById.get(subscription.planId), "Plan");
  const product = requireRelation(productById.get(plan.productId), "Product");

  return { ...subscription, user, plan, product };
}

export const mockApi: ApiClient = {
  auth: {
    async login({ email, password }: LoginInput) {
      await wait();
      const data = loadMockData();
      const user = data.users.find(
        (item) => item.email.toLowerCase() === email.toLowerCase(),
      );

      if (!user || user.password !== password) {
        throw new ApiError(
          "Email or password is incorrect.",
          401,
          "INVALID_CREDENTIALS",
        );
      }

      if (user.status !== "ACTIVE") {
        throw new ApiError(
          "This account is not active. Contact an administrator.",
          403,
          "ACCOUNT_INACTIVE",
        );
      }

      return toPublicUser(user) as AuthUser;
    },

    async register({ name, email, password }: RegisterInput) {
      await wait();
      const data = loadMockData();

      if (
        data.users.some(
          (item) => item.email.toLowerCase() === email.toLowerCase(),
        )
      ) {
        throw new ApiError(
          "An account with this email already exists.",
          409,
          "EMAIL_IN_USE",
        );
      }

      const user = {
        id: createId("usr"),
        name,
        email,
        role: "CUSTOMER" as const,
        status: "ACTIVE" as const,
        createdAt: new Date().toISOString(),
        password,
      };

      data.users.push(user);
      saveMockData(data);
      return toPublicUser(user) as AuthUser;
    },

    async logout() {
      await wait(80);
    },

    async me() {
      await wait(80);
      return getClientSession();
    },
  },

  users: {
    async list() {
      await wait();
      return loadMockData().users.map(toPublicUser);
    },

    async create(input: CreateUserInput) {
      await wait();
      const data = loadMockData();

      if (
        data.users.some(
          (item) => item.email.toLowerCase() === input.email.toLowerCase(),
        )
      ) {
        throw new ApiError(
          "A user with this email already exists.",
          409,
          "EMAIL_IN_USE",
        );
      }

      const user = {
        ...input,
        id: createId("usr"),
        createdAt: new Date().toISOString(),
        password: "password",
      };

      data.users.push(user);
      saveMockData(data);
      return toPublicUser(user);
    },

    async update(id: string, input: UpdateUserInput) {
      await wait();
      const data = loadMockData();
      const index = data.users.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new ApiError("User was not found.", 404, "NOT_FOUND");
      }

      if (
        input.email &&
        data.users.some(
          (item) =>
            item.id !== id &&
            item.email.toLowerCase() === input.email!.toLowerCase(),
        )
      ) {
        throw new ApiError(
          "A user with this email already exists.",
          409,
          "EMAIL_IN_USE",
        );
      }

      data.users[index] = { ...data.users[index], ...input };
      saveMockData(data);
      return toPublicUser(data.users[index]);
    },

    async remove(id: string) {
      await wait();
      const data = loadMockData();
      const user = data.users.find((item) => item.id === id);

      if (!user) {
        throw new ApiError("User was not found.", 404, "NOT_FOUND");
      }

      if (data.subscriptions.some((item) => item.userId === id)) {
        throw new ApiError(
          "This user has subscriptions. Cancel or remove them first.",
          409,
          "USER_HAS_SUBSCRIPTIONS",
        );
      }

      data.users = data.users.filter((item) => item.id !== id);
      saveMockData(data);
    },
  },

  products: {
    async list() {
      await wait();
      return loadMockData().products;
    },

    async create(input: CreateProductInput) {
      await wait();
      const data = loadMockData();
      const product: Product = {
        ...input,
        id: createId("prd"),
        createdAt: new Date().toISOString(),
      };

      data.products.push(product);
      saveMockData(data);
      return product;
    },

    async update(id: string, input: UpdateProductInput) {
      await wait();
      const data = loadMockData();
      const index = data.products.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new ApiError("Product was not found.", 404, "NOT_FOUND");
      }

      data.products[index] = { ...data.products[index], ...input };
      saveMockData(data);
      return data.products[index];
    },

    async remove(id: string) {
      await wait();
      const data = loadMockData();

      if (data.plans.some((item) => item.productId === id)) {
        throw new ApiError(
          "This product still has plans. Archive the product instead.",
          409,
          "PRODUCT_HAS_PLANS",
        );
      }

      data.products = data.products.filter((item) => item.id !== id);
      saveMockData(data);
    },
  },

  plans: {
    async list() {
      await wait();
      const data = loadMockData();
      return data.plans.map((plan) => toPlanWithProduct(plan.id, data));
    },

    async create(input: CreatePlanInput) {
      await wait();
      const data = loadMockData();
      const product = requireRelation(
        data.products.find((item) => item.id === input.productId),
        "Product",
      );

      const plan = {
        ...input,
        id: createId("pln"),
        createdAt: new Date().toISOString(),
      };

      data.plans.push(plan);
      saveMockData(data);
      return { ...plan, product };
    },

    async update(id: string, input: UpdatePlanInput) {
      await wait();
      const data = loadMockData();
      const index = data.plans.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new ApiError("Plan was not found.", 404, "NOT_FOUND");
      }

      if (
        input.productId &&
        !data.products.some((item) => item.id === input.productId)
      ) {
        throw new ApiError("Product was not found.", 404, "NOT_FOUND");
      }

      data.plans[index] = { ...data.plans[index], ...input };
      saveMockData(data);
      return toPlanWithProduct(id, data);
    },

    async remove(id: string) {
      await wait();
      const data = loadMockData();

      if (data.subscriptions.some((item) => item.planId === id)) {
        throw new ApiError(
          "This plan has subscriptions. Archive the plan instead.",
          409,
          "PLAN_HAS_SUBSCRIPTIONS",
        );
      }

      data.plans = data.plans.filter((item) => item.id !== id);
      saveMockData(data);
    },
  },

  subscriptions: {
    async list() {
      await wait();
      const data = loadMockData();
      return [...data.subscriptions]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .map((subscription) =>
          toSubscriptionWithRelations(subscription.id, data),
        );
    },

    async get(id: string) {
      await wait();
      return toSubscriptionWithRelations(id);
    },

    async create(input: CreateSubscriptionInput) {
      await wait();
      const data = loadMockData();
      const user = requireRelation(
        data.users.find((item) => item.id === input.userId),
        "User",
      );
      const plan = requireRelation(
        data.plans.find((item) => item.id === input.planId),
        "Plan",
      );
      const product = requireRelation(
        data.products.find((item) => item.id === plan.productId),
        "Product",
      );
      const start = new Date();
      const subscription = {
        id: createId("sub"),
        userId: user.id,
        planId: plan.id,
        status: input.status,
        currentPeriodStart: start.toISOString(),
        currentPeriodEnd: nextPeriodEnd(start, plan.interval),
        cancelAtPeriodEnd: false,
        createdAt: start.toISOString(),
      };

      data.subscriptions.push(subscription);
      saveMockData(data);

      return { ...subscription, user: toPublicUser(user), plan, product };
    },

    async update(id: string, input: UpdateSubscriptionInput) {
      await wait();
      const data = loadMockData();
      const index = data.subscriptions.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new ApiError("Subscription was not found.", 404, "NOT_FOUND");
      }

      data.subscriptions[index] = { ...data.subscriptions[index], ...input };
      saveMockData(data);
      return toSubscriptionWithRelations(id, data);
    },
  },

  operations: {
    async snapshot(): Promise<OperationsSnapshot> {
      await wait();
      const data = loadMockData();
      const revenueCollected = data.invoices.reduce(
        (total, invoice) => total + invoice.paidAmount,
        0,
      );
      const outstanding = data.invoices.reduce(
        (total, invoice) => total + Math.max(invoice.total - invoice.paidAmount, 0),
        0,
      );
      const monthly = data.subscriptions
        .filter((subscription) =>
          ["ACTIVE", "TRIALING"].includes(subscription.status),
        )
        .reduce((total, subscription) => {
          const plan = data.plans.find((item) => item.id === subscription.planId);
          if (!plan) return total;
          if (plan.interval === "YEARLY") return total + plan.price / 12;
          if (plan.interval === "WEEKLY") return total + plan.price * 52 / 12;
          if (plan.interval === "DAILY") return total + plan.price * 365 / 12;
          return total + plan.price;
        }, 0);

      return {
        customers: data.customers,
        quotes: data.quotes,
        invoices: data.invoices,
        payments: data.payments,
        discounts: data.discounts,
        billingRuns: data.billingRuns,
        summary: {
          activeSubscriptions: data.subscriptions.filter(
            (subscription) => subscription.status === "ACTIVE",
          ).length,
          mrr: Math.round(monthly),
          arr: Math.round(monthly * 12),
          revenueCollected,
          outstanding,
          overdue: data.invoices
            .filter((invoice) => invoice.status === "OVERDUE")
            .reduce((total, invoice) => total + invoice.total - invoice.paidAmount, 0),
          overdueCount: data.invoices.filter(
            (invoice) => invoice.status === "OVERDUE",
          ).length,
        },
      };
    },
  },
};

export type Role = "ADMIN" | "MEMBER";

export type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED";

export type ProductStatus = "ACTIVE" | "ARCHIVED";

export type PlanStatus = "ACTIVE" | "ARCHIVED";

export type BillingInterval = "MONTHLY" | "YEARLY";

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED";

export type Currency = "USD" | "EUR" | "GBP";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  status: ProductStatus;
  createdAt: string;
}

export interface Plan {
  id: string;
  productId: string;
  name: string;
  description: string;
  price: number;
  currency: Currency;
  interval: BillingInterval;
  features: string[];
  status: PlanStatus;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export interface PlanWithProduct extends Plan {
  product: Product;
}

export interface SubscriptionWithRelations extends Subscription {
  user: User;
  plan: Plan;
  product: Product;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export type UpdateUserInput = Partial<CreateUserInput>;

export interface CreateProductInput {
  name: string;
  description: string;
  status: ProductStatus;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface CreatePlanInput {
  productId: string;
  name: string;
  description: string;
  price: number;
  currency: Currency;
  interval: BillingInterval;
  features: string[];
  status: PlanStatus;
}

export type UpdatePlanInput = Partial<CreatePlanInput>;

export interface CreateSubscriptionInput {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
}

export type UpdateSubscriptionInput = Partial<
  Pick<Subscription, "status" | "cancelAtPeriodEnd">
>;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

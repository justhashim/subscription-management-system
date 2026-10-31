export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED";

export type ProductStatus = "ACTIVE" | "ARCHIVED";

export type PlanStatus = "ACTIVE" | "ARCHIVED";

export type BillingInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

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
  type?: "SERVICE" | "GOODS";
  salesPrice?: number;
  costPrice?: number;
  notes?: string;
  taxRate?: number;
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
  minimumQuantity?: number;
  availableFrom?: string;
  availableUntil?: string;
  canPause?: boolean;
  canCloseEarly?: boolean;
  autoClose?: boolean;
  canRenew?: boolean;
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

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";

export interface Customer {
  id: string;
  name: string;
  legalName?: string;
  email: string;
  phone?: string;
  taxId?: string;
  status: CustomerStatus;
  createdAt: string;
  activeSubscriptions: number;
  outstandingAmount: number;
}

export type QuoteStatus = "DRAFT" | "QUOTATION" | "ACCEPTED" | "EXPIRED" | "CANCELED";

export interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface Quote {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  templateName?: string;
  status: QuoteStatus;
  validUntil: string;
  total: number;
  lines: QuoteLine[];
  createdAt: string;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELED";

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  subscriptionId?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  lines: InvoiceLine[];
}

export type PaymentMethod = "UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "CHEQUE" | "ONLINE";

export interface Payment {
  id: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  method: PaymentMethod;
  amount: number;
  paymentDate: string;
  note?: string;
  status: "CONFIRMED" | "PENDING";
}

export interface Discount {
  id: string;
  name: string;
  code: string;
  type: "FIXED" | "PERCENTAGE";
  value: number;
  minimumPurchase: number;
  minimumQuantity: number;
  startsAt: string;
  endsAt?: string;
  maxRedemptions?: number;
  usedRedemptions: number;
  status: "ACTIVE" | "EXPIRED" | "PAUSED";
}

export interface BillingRun {
  id: string;
  number: string;
  billingDate: string;
  status: "COMPLETED" | "PROCESSING" | "PARTIALLY_FAILED" | "FAILED";
  subscriptions: number;
  invoicesCreated: number;
  revenue: number;
  startedAt: string;
  completedAt?: string;
}

export interface ReportSummary {
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  revenueCollected: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
}

export interface OperationsSnapshot {
  customers: Customer[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  discounts: Discount[];
  billingRuns: BillingRun[];
  summary: ReportSummary;
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
  type?: "SERVICE" | "GOODS";
  salesPrice?: number;
  costPrice?: number;
  notes?: string;
  taxRate?: number;
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
  minimumQuantity?: number;
  availableFrom?: string;
  availableUntil?: string;
  canPause?: boolean;
  canCloseEarly?: boolean;
  autoClose?: boolean;
  canRenew?: boolean;
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

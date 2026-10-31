import { addDays, addMonths, addWeeks, addYears, subDays, subMonths } from "date-fns";
import type {
  BillingRun,
  Customer,
  Discount,
  Invoice,
  Plan,
  Payment,
  Product,
  Quote,
  Subscription,
  User,
} from "@/types/api";

export interface MockUser extends User {
  password: string;
}

export interface MockData {
  users: MockUser[];
  products: Product[];
  plans: Plan[];
  subscriptions: Subscription[];
  customers: Customer[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  discounts: Discount[];
  billingRuns: BillingRun[];
}

function isoMonthsAgo(months: number) {
  return subMonths(new Date(), months).toISOString();
}

function isoDaysAgo(days: number) {
  return subDays(new Date(), days).toISOString();
}

function periodDays(days: number) {
  return addDays(new Date(), days).toISOString();
}

export function createSeedData(): MockData {
  const admin: MockUser = {
    id: "usr_admin",
    name: "Amina Khan",
    email: "admin@example.com",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: isoMonthsAgo(10),
    password: "password",
  };

  const staff: MockUser = {
    id: "usr_member",
    name: "Jordan Lee",
    email: "staff@example.com",
    role: "STAFF",
    status: "ACTIVE",
    createdAt: isoMonthsAgo(7),
    password: "password",
  };

  const users: MockUser[] = [
    admin,
    staff,
    {
      id: "usr_sofia",
      name: "Sofia Martinez",
      email: "sofia@acme.io",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(5),
      password: "password",
    },
    {
      id: "usr_noah",
      name: "Noah Williams",
      email: "noah@northstar.dev",
      role: "CUSTOMER",
      status: "INVITED",
      createdAt: isoDaysAgo(12),
      password: "password",
    },
    {
      id: "usr_priya",
      name: "Priya Patel",
      email: "priya@lumen.co",
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(3),
      password: "password",
    },
    {
      id: "usr_marcus",
      name: "Marcus Chen",
      email: "marcus@vertex.io",
      role: "CUSTOMER",
      status: "SUSPENDED",
      createdAt: isoMonthsAgo(8),
      password: "password",
    },
  ];

  const products: Product[] = [
    {
      id: "prd_atlas",
      name: "Atlas Analytics",
      description:
        "Product analytics and customer insights for growing teams.",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(12),
      type: "SERVICE",
      salesPrice: 2900,
      costPrice: 700,
      notes: "Analytics workspace for product teams.",
      taxRate: 18,
    },
    {
      id: "prd_relay",
      name: "Relay API",
      description:
        "Managed messaging, webhooks, and event delivery infrastructure.",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(9),
      type: "SERVICE",
      salesPrice: 14900,
      costPrice: 3200,
      notes: "Event delivery and managed webhooks.",
      taxRate: 18,
    },
    {
      id: "prd_canvas",
      name: "Canvas Studio",
      description:
        "A collaborative workspace for product design and research teams.",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(6),
      type: "SERVICE",
      salesPrice: 4900,
      costPrice: 900,
      notes: "Collaborative workspace for design teams.",
      taxRate: 18,
    },
    {
      id: "prd_legacy",
      name: "Legacy Connect",
      description:
        "Sunset self-hosted integration suite retained for existing accounts.",
      status: "ARCHIVED",
      createdAt: isoMonthsAgo(24),
      type: "SERVICE",
      salesPrice: 7900,
      costPrice: 1500,
      notes: "Maintained for existing customers only.",
      taxRate: 18,
    },
  ];

  const plans: Plan[] = [
    {
      id: "pln_atlas_starter",
      productId: "prd_atlas",
      name: "Starter",
      description: "Core analytics for small teams getting started.",
      price: 2900,
      currency: "USD",
      interval: "MONTHLY",
      features: ["Up to 3 seats", "30-day data retention", "Email support"],
      status: "ACTIVE",
      createdAt: isoMonthsAgo(11),
      minimumQuantity: 1,
      canPause: true,
      canCloseEarly: true,
      canRenew: true,
    },
    {
      id: "pln_atlas_scale",
      productId: "prd_atlas",
      name: "Scale",
      description: "Advanced insights and collaboration for growing teams.",
      price: 9900,
      currency: "USD",
      interval: "MONTHLY",
      features: [
        "Unlimited seats",
        "12-month data retention",
        "Custom dashboards",
        "Priority support",
      ],
      status: "ACTIVE",
      createdAt: isoMonthsAgo(11),
      minimumQuantity: 1,
      canPause: true,
      canCloseEarly: true,
      canRenew: true,
    },
    {
      id: "pln_atlas_annual",
      productId: "prd_atlas",
      name: "Scale Annual",
      description: "Annual access to Atlas Scale with a simplified renewal.",
      price: 99000,
      currency: "USD",
      interval: "YEARLY",
      features: [
        "Everything in Scale",
        "Annual billing",
        "Quarterly business review",
      ],
      status: "ACTIVE",
      createdAt: isoMonthsAgo(4),
      minimumQuantity: 1,
      canPause: false,
      canCloseEarly: false,
      canRenew: true,
    },
    {
      id: "pln_relay_dev",
      productId: "prd_relay",
      name: "Developer",
      description: "A free sandbox for prototypes and early integrations.",
      price: 0,
      currency: "USD",
      interval: "MONTHLY",
      features: ["10k events / month", "1 project", "Community support"],
      status: "ACTIVE",
      createdAt: isoMonthsAgo(8),
      minimumQuantity: 1,
      canPause: true,
      canCloseEarly: true,
      canRenew: true,
    },
    {
      id: "pln_relay_growth",
      productId: "prd_relay",
      name: "Growth",
      description: "Production messaging with higher limits and support.",
      price: 14900,
      currency: "USD",
      interval: "MONTHLY",
      features: [
        "1M events / month",
        "Unlimited projects",
        "Webhook replay",
        "Priority support",
      ],
      status: "ACTIVE",
      createdAt: isoMonthsAgo(8),
      minimumQuantity: 5,
      canPause: true,
      canCloseEarly: true,
      canRenew: true,
    },
    {
      id: "pln_canvas_team",
      productId: "prd_canvas",
      name: "Team",
      description: "Shared design spaces for small product teams.",
      price: 4900,
      currency: "USD",
      interval: "MONTHLY",
      features: ["10 editors", "Shared libraries", "Version history"],
      status: "ACTIVE",
      createdAt: isoMonthsAgo(5),
      minimumQuantity: 1,
      canPause: true,
      canCloseEarly: true,
      canRenew: true,
    },
    {
      id: "pln_canvas_business",
      productId: "prd_canvas",
      name: "Business",
      description: "Advanced governance and collaboration at scale.",
      price: 19900,
      currency: "USD",
      interval: "MONTHLY",
      features: [
        "Unlimited editors",
        "SSO and audit logs",
        "Design system governance",
        "Dedicated support",
      ],
      status: "ACTIVE",
      createdAt: isoMonthsAgo(5),
      minimumQuantity: 10,
      canPause: false,
      canCloseEarly: true,
      canRenew: true,
    },
    {
      id: "pln_legacy_pro",
      productId: "prd_legacy",
      name: "Legacy Pro",
      description: "Maintenance plan for existing Legacy Connect deployments.",
      price: 7900,
      currency: "USD",
      interval: "MONTHLY",
      features: ["Legacy connectors", "Maintenance releases", "Email support"],
      status: "ARCHIVED",
      createdAt: isoMonthsAgo(20),
      minimumQuantity: 1,
      canPause: false,
      canCloseEarly: false,
      canRenew: false,
    },
  ];

  const subscriptions: Subscription[] = [
    {
      id: "sub_1001",
      userId: "usr_member",
      planId: "pln_atlas_starter",
      status: "ACTIVE",
      currentPeriodStart: isoDaysAgo(10),
      currentPeriodEnd: periodDays(20),
      cancelAtPeriodEnd: false,
      createdAt: isoMonthsAgo(6),
    },
    {
      id: "sub_1002",
      userId: "usr_member",
      planId: "pln_relay_dev",
      status: "ACTIVE",
      currentPeriodStart: isoDaysAgo(22),
      currentPeriodEnd: periodDays(8),
      cancelAtPeriodEnd: false,
      createdAt: isoDaysAgo(80),
    },
    {
      id: "sub_1003",
      userId: "usr_sofia",
      planId: "pln_atlas_scale",
      status: "ACTIVE",
      currentPeriodStart: isoDaysAgo(3),
      currentPeriodEnd: periodDays(27),
      cancelAtPeriodEnd: false,
      createdAt: isoMonthsAgo(4),
    },
    {
      id: "sub_1004",
      userId: "usr_priya",
      planId: "pln_relay_growth",
      status: "PAST_DUE",
      currentPeriodStart: isoDaysAgo(12),
      currentPeriodEnd: periodDays(18),
      cancelAtPeriodEnd: false,
      createdAt: isoMonthsAgo(3),
    },
    {
      id: "sub_1005",
      userId: "usr_noah",
      planId: "pln_canvas_team",
      status: "TRIALING",
      currentPeriodStart: isoDaysAgo(5),
      currentPeriodEnd: periodDays(9),
      cancelAtPeriodEnd: false,
      createdAt: isoDaysAgo(5),
    },
    {
      id: "sub_1006",
      userId: "usr_marcus",
      planId: "pln_canvas_business",
      status: "CANCELED",
      currentPeriodStart: isoDaysAgo(20),
      currentPeriodEnd: periodDays(10),
      cancelAtPeriodEnd: true,
      createdAt: isoMonthsAgo(7),
    },
    {
      id: "sub_1007",
      userId: "usr_sofia",
      planId: "pln_canvas_team",
      status: "ACTIVE",
      currentPeriodStart: isoDaysAgo(8),
      currentPeriodEnd: periodDays(22),
      cancelAtPeriodEnd: false,
      createdAt: isoMonthsAgo(2),
    },
    {
      id: "sub_1008",
      userId: "usr_admin",
      planId: "pln_atlas_scale",
      status: "ACTIVE",
      currentPeriodStart: isoDaysAgo(1),
      currentPeriodEnd: periodDays(29),
      cancelAtPeriodEnd: false,
      createdAt: isoMonthsAgo(9),
    },
  ];

  const customers: Customer[] = users
    .filter((user) => user.role !== "ADMIN")
    .map((user) => ({
      id: `cus_${user.id.replace("usr_", "")}`,
      name: user.name,
      legalName: `${user.name} LLC`,
      email: user.email,
      phone: "+1 (555) 010-2040",
      taxId: "BLP-" + user.id.slice(-4).toUpperCase(),
      status: user.status === "SUSPENDED" ? "INACTIVE" : "ACTIVE",
      createdAt: user.createdAt,
      activeSubscriptions: subscriptions.filter(
        (subscription) =>
          subscription.userId === user.id && subscription.status === "ACTIVE",
      ).length,
      outstandingAmount: user.id === "usr_priya" ? 17682 : user.id === "usr_member" ? 2900 : 0,
    }));

  const invoices: Invoice[] = [
    {
      id: "inv_26001",
      number: "INV/26-27/000001",
      customerId: "cus_member",
      customerName: "Jordan Lee",
      subscriptionId: "sub_1001",
      status: "PAID",
      issueDate: isoDaysAgo(10),
      dueDate: isoDaysAgo(3),
      subtotal: 2900,
      taxAmount: 522,
      discountAmount: 0,
      total: 3422,
      paidAmount: 3422,
      lines: [{ id: "line_1", description: "Atlas Analytics · Starter", quantity: 1, unitPrice: 2900, taxRate: 18, taxAmount: 522, amount: 3422 }],
    },
    {
      id: "inv_26002",
      number: "INV/26-27/000002",
      customerId: "cus_priya",
      customerName: "Priya Patel",
      subscriptionId: "sub_1004",
      status: "OVERDUE",
      issueDate: isoDaysAgo(22),
      dueDate: isoDaysAgo(8),
      subtotal: 14900,
      taxAmount: 2682,
      discountAmount: 0,
      total: 17582,
      paidAmount: 0,
      lines: [{ id: "line_2", description: "Relay API · Growth", quantity: 1, unitPrice: 14900, taxRate: 18, taxAmount: 2682, amount: 17582 }],
    },
    {
      id: "inv_26003",
      number: "INV/26-27/000003",
      customerId: "cus_sofia",
      customerName: "Sofia Martinez",
      subscriptionId: "sub_1003",
      status: "PARTIALLY_PAID",
      issueDate: isoDaysAgo(4),
      dueDate: periodDays(10),
      subtotal: 9900,
      taxAmount: 1782,
      discountAmount: 990,
      total: 10692,
      paidAmount: 5000,
      lines: [{ id: "line_3", description: "Atlas Analytics · Scale", quantity: 1, unitPrice: 9900, taxRate: 18, taxAmount: 1782, amount: 10692 }],
    },
    {
      id: "inv_26004",
      number: "INV/26-27/000004",
      customerId: "cus_member",
      customerName: "Jordan Lee",
      subscriptionId: "sub_1002",
      status: "CONFIRMED",
      issueDate: isoDaysAgo(2),
      dueDate: periodDays(12),
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      paidAmount: 0,
      lines: [{ id: "line_4", description: "Relay API · Developer", quantity: 1, unitPrice: 0, taxRate: 18, taxAmount: 0, amount: 0 }],
    },
  ];

  const payments: Payment[] = [
    { id: "pay_1", number: "PAY/26-27/000014", invoiceId: "inv_26001", invoiceNumber: "INV/26-27/000001", customerName: "Jordan Lee", method: "CARD", amount: 3422, paymentDate: isoDaysAgo(8), note: "Automatic card payment", status: "CONFIRMED" },
    { id: "pay_2", number: "PAY/26-27/000015", invoiceId: "inv_26003", invoiceNumber: "INV/26-27/000003", customerName: "Sofia Martinez", method: "BANK_TRANSFER", amount: 5000, paymentDate: isoDaysAgo(2), note: "Reference SOF-APR", status: "CONFIRMED" },
  ];

  const quotes: Quote[] = [
    { id: "quo_1", number: "QUO/26-27/000007", customerId: "cus_sofia", customerName: "Sofia Martinez", templateName: "Scale onboarding", status: "QUOTATION", validUntil: periodDays(12), total: 11682, createdAt: isoDaysAgo(3), lines: [{ id: "ql_1", description: "Atlas Analytics · Scale", quantity: 1, unitPrice: 9900, taxRate: 18, amount: 11682 }] },
    { id: "quo_2", number: "QUO/26-27/000006", customerId: "cus_priya", customerName: "Priya Patel", templateName: "Growth annual", status: "ACCEPTED", validUntil: isoDaysAgo(4), total: 17582, createdAt: isoDaysAgo(16), lines: [{ id: "ql_2", description: "Relay API · Growth", quantity: 1, unitPrice: 14900, taxRate: 18, amount: 17582 }] },
  ];

  const discounts: Discount[] = [
    { id: "dsc_seat10", name: "Seat expansion", code: "SEAT10", type: "PERCENTAGE", value: 10, minimumPurchase: 10000, minimumQuantity: 5, startsAt: isoMonthsAgo(1), maxRedemptions: 100, usedRedemptions: 24, status: "ACTIVE" },
    { id: "dsc_welcome", name: "Welcome credit", code: "WELCOME500", type: "FIXED", value: 500, minimumPurchase: 2500, minimumQuantity: 1, startsAt: isoMonthsAgo(5), endsAt: periodDays(20), maxRedemptions: 50, usedRedemptions: 48, status: "ACTIVE" },
  ];

  const billingRuns: BillingRun[] = [
    { id: "run_1", number: "RUN/26-27/000004", billingDate: isoDaysAgo(1), status: "COMPLETED", subscriptions: 128, invoicesCreated: 128, revenue: 1849200, startedAt: isoDaysAgo(1), completedAt: isoDaysAgo(1) },
    { id: "run_2", number: "RUN/26-27/000003", billingDate: isoDaysAgo(8), status: "PARTIALLY_FAILED", subscriptions: 96, invoicesCreated: 94, revenue: 1294500, startedAt: isoDaysAgo(8), completedAt: isoDaysAgo(8) },
  ];

  return { users, products, plans, subscriptions, customers, quotes, invoices, payments, discounts, billingRuns };
}

export function nextPeriodEnd(
  start: Date,
  interval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
) {
  if (interval === "DAILY") return addDays(start, 1).toISOString();
  if (interval === "WEEKLY") return addWeeks(start, 1).toISOString();
  return interval === "MONTHLY"
    ? addMonths(start, 1).toISOString()
    : addYears(start, 1).toISOString();
}

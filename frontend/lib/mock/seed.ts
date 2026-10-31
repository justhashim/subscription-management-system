import { addDays, addMonths, addYears, subDays, subMonths } from "date-fns";
import type {
  Plan,
  Product,
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

  const member: MockUser = {
    id: "usr_member",
    name: "Jordan Lee",
    email: "member@example.com",
    role: "MEMBER",
    status: "ACTIVE",
    createdAt: isoMonthsAgo(7),
    password: "password",
  };

  const users: MockUser[] = [
    admin,
    member,
    {
      id: "usr_sofia",
      name: "Sofia Martinez",
      email: "sofia@acme.io",
      role: "MEMBER",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(5),
      password: "password",
    },
    {
      id: "usr_noah",
      name: "Noah Williams",
      email: "noah@northstar.dev",
      role: "MEMBER",
      status: "INVITED",
      createdAt: isoDaysAgo(12),
      password: "password",
    },
    {
      id: "usr_priya",
      name: "Priya Patel",
      email: "priya@lumen.co",
      role: "MEMBER",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(3),
      password: "password",
    },
    {
      id: "usr_marcus",
      name: "Marcus Chen",
      email: "marcus@vertex.io",
      role: "MEMBER",
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
    },
    {
      id: "prd_relay",
      name: "Relay API",
      description:
        "Managed messaging, webhooks, and event delivery infrastructure.",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(9),
    },
    {
      id: "prd_canvas",
      name: "Canvas Studio",
      description:
        "A collaborative workspace for product design and research teams.",
      status: "ACTIVE",
      createdAt: isoMonthsAgo(6),
    },
    {
      id: "prd_legacy",
      name: "Legacy Connect",
      description:
        "Sunset self-hosted integration suite retained for existing accounts.",
      status: "ARCHIVED",
      createdAt: isoMonthsAgo(24),
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

  return { users, products, plans, subscriptions };
}

export function nextPeriodEnd(
  start: Date,
  interval: "MONTHLY" | "YEARLY",
) {
  return interval === "MONTHLY"
    ? addMonths(start, 1).toISOString()
    : addYears(start, 1).toISOString();
}

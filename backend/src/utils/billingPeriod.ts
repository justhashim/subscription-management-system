// src/utils/billingPeriod.ts
// Deterministic billing-period maths. All dates are 'YYYY-MM-DD' strings handled in UTC,
// so the server timezone can never shift a date. Every period is derived from the
// subscription's start_date (the anchor), so month-end dates never drift.

export type BillingInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface BillingPeriod {
  periodIndex: number;      // 1-based, matches billing_run_items / invoices.period_index
  periodStart: string;
  periodEnd: string;        // inclusive
  nextBillingDate: string;  // start of the following period
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

function parse(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function assertDateString(value: string): void {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new Error(`Invalid date (expected YYYY-MM-DD): ${value}`);
  }
  const date = parse(value);
  if (Number.isNaN(date.getTime()) || format(date) !== value) {
    throw new Error(`Invalid date: ${value}`);
  }
}

export function addDays(value: string, days: number): string {
  const date = parse(value);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

// Adds months to the anchor date, clamping to the last day of the target month
// (e.g. 31 Jan + 1 month = 28/29 Feb, but 31 Jan + 2 months = 31 Mar).
function addMonthsClamped(anchor: Date, months: number): Date {
  const total = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay)));
}

// Start date of the n-th period (n is zero-based).
function periodStartAt(anchor: Date, interval: BillingInterval, n: number): Date {
  switch (interval) {
    case 'daily':
      return new Date(anchor.getTime() + n * DAY_MS);
    case 'weekly':
      return new Date(anchor.getTime() + n * 7 * DAY_MS);
    case 'monthly':
      return addMonthsClamped(anchor, n);
    case 'yearly':
      return addMonthsClamped(anchor, n * 12);
    default:
      throw new Error(`Unsupported billing interval: ${interval as string}`);
  }
}

/**
 * Returns the billing period that contains `billingDate` for a subscription
 * that started on `startDate`.
 */
export function getPeriodForDate(
  startDate: string,
  interval: string,
  billingDate: string
): BillingPeriod {
  assertDateString(startDate);
  assertDateString(billingDate);

  const billingInterval = interval as BillingInterval;
  const anchor = parse(startDate);
  const current = parse(billingDate);

  if (current.getTime() < anchor.getTime()) {
    throw new Error('Billing date cannot be before subscription start date');
  }

  const dayDiff = Math.floor((current.getTime() - anchor.getTime()) / DAY_MS);
  let n: number;

  switch (billingInterval) {
    case 'daily':
      n = dayDiff;
      break;
    case 'weekly':
      n = Math.floor(dayDiff / 7);
      break;
    case 'monthly':
      n =
        (current.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
        (current.getUTCMonth() - anchor.getUTCMonth());
      if (periodStartAt(anchor, billingInterval, n).getTime() > current.getTime()) n -= 1;
      break;
    case 'yearly':
      n = current.getUTCFullYear() - anchor.getUTCFullYear();
      if (periodStartAt(anchor, billingInterval, n).getTime() > current.getTime()) n -= 1;
      break;
    default:
      throw new Error(`Unsupported billing interval: ${interval}`);
  }

  const start = format(periodStartAt(anchor, billingInterval, n));
  const next = format(periodStartAt(anchor, billingInterval, n + 1));

  return {
    periodIndex: n + 1,
    periodStart: start,
    periodEnd: addDays(next, -1),
    nextBillingDate: next
  };
}

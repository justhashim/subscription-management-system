import { format, formatDistanceToNow } from "date-fns";
import type { BillingInterval, Currency } from "@/types/api";

export function formatCurrency(
  amountInMinorUnits: number,
  currency: Currency,
) {
  const amount = amountInMinorUnits / 100;
  const hasCents = amountInMinorUnits % 100 !== 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

export function formatPrice(
  amountInMinorUnits: number,
  currency: Currency,
  interval: BillingInterval,
) {
  if (amountInMinorUnits === 0) {
    return "Free";
  }

  const suffix =
    interval === "DAILY"
      ? "/day"
      : interval === "WEEKLY"
        ? "/wk"
        : interval === "MONTHLY"
          ? "/mo"
          : "/yr";
  return `${formatCurrency(amountInMinorUnits, currency)}${suffix}`;
}

export function formatDate(value: string) {
  return format(new Date(value), "MMM d, yyyy");
}

export function formatDateTime(value: string) {
  return format(new Date(value), "MMM d, yyyy 'at' h:mm a");
}

export function formatRelative(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

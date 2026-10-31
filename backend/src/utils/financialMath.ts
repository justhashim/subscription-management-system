// src/utils/financialMath.ts
// All amounts are integer paise; tax rates and percentage discounts are basis points.
// One rounding policy everywhere: half-up, applied per line.

export interface LineItemInput {
  unitPrice: number;           // paise
  quantity: number;
  discountAmount: number;      // paise, this line's share of any discount
  taxRateBasisPoints: number;  // e.g. 1800 = 18%
}

export interface LineItemResult {
  unitPrice: number;
  quantity: number;
  subtotal: number;        // quantity * unitPrice
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;       // subtotal - discount + tax
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

const TWO = BigInt(2);

function assertInt(name: string, value: number, min = 0): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
}

/** round_half_up(amount * multiplier / divisor) using exact integer arithmetic. */
export function mulDivHalfUp(amount: number, multiplier: number, divisor: number): number {
  assertInt('amount', amount);
  assertInt('multiplier', multiplier);
  assertInt('divisor', divisor, 1);

  const a = BigInt(amount);
  const m = BigInt(multiplier);
  const d = BigInt(divisor);
  const result = Number((TWO * a * m + d) / (TWO * d));

  if (!Number.isSafeInteger(result)) {
    throw new Error('Calculated amount exceeds safe integer range');
  }
  return result;
}

/**
 * Splits `total` across lines in proportion to `weights` (largest-remainder),
 * so the shares always add up to exactly `total`.
 */
export function allocateDiscount(weights: number[], total: number): number[] {
  assertInt('discount', total);
  weights.forEach((w) => assertInt('line subtotal', w));

  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (total > sum) {
    throw new Error('Discount cannot exceed subtotal');
  }
  if (total === 0 || sum === 0) {
    return weights.map(() => 0);
  }

  const bigTotal = BigInt(total);
  const bigSum = BigInt(sum);

  const shares = weights.map((w) => Number((bigTotal * BigInt(w)) / bigSum));
  const remainders = weights.map((w) => Number((bigTotal * BigInt(w)) % bigSum));

  let leftover = total - shares.reduce((acc, s) => acc + s, 0);
  const order = weights
    .map((_, index) => index)
    .sort((a, b) => remainders[b] - remainders[a] || a - b);

  for (const index of order) {
    if (leftover <= 0) break;
    shares[index] += 1;
    leftover -= 1;
  }

  return shares;
}

/** Calculates one invoice line: discount first, then tax on the discounted amount. */
export function calculateLineItem(input: LineItemInput): LineItemResult {
  assertInt('unitPrice', input.unitPrice);
  assertInt('quantity', input.quantity, 1);
  assertInt('discountAmount', input.discountAmount);
  assertInt('taxRateBasisPoints', input.taxRateBasisPoints);

  if (input.taxRateBasisPoints > 10000) {
    throw new Error('Tax rate must be between 0 and 10000 basis points');
  }

  const subtotal = input.unitPrice * input.quantity;
  if (!Number.isSafeInteger(subtotal)) {
    throw new Error('Line subtotal exceeds safe integer range');
  }

  // Discount can never exceed the line's own subtotal.
  const discountAmount = Math.min(subtotal, input.discountAmount);
  const taxable = subtotal - discountAmount;
  const taxAmount = mulDivHalfUp(taxable, input.taxRateBasisPoints, 10000);

  return {
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    subtotal,
    discountAmount,
    taxAmount,
    lineTotal: taxable + taxAmount
  };
}

/** Invoice totals are the sum of the rounded lines: total = subtotal - discount + tax. */
export function calculateInvoiceTotals(lines: LineItemResult[]): InvoiceTotals {
  const totals = lines.reduce(
    (acc, line) => {
      acc.subtotal += line.subtotal;
      acc.discountAmount += line.discountAmount;
      acc.taxAmount += line.taxAmount;
      acc.totalAmount += line.lineTotal;
      return acc;
    },
    { subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0 }
  );

  if (totals.totalAmount !== totals.subtotal - totals.discountAmount + totals.taxAmount) {
    throw new Error('Invoice total calculation is inconsistent');
  }

  return totals;
}

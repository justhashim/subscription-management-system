

export interface LineItemInput {
  planPrice: number;           // in paise
  variantAdjustment: number;   // in paise
  quantity: number;
  lineDiscountAmount: number;  // in paise
  proratedSubDiscount: number; // in paise
  taxRateBasisPoints: number;  // e.g., 1800 for 18%
}

export interface LineItemResult {
  unitPrice: number;
  subtotal: number;
  totalDiscount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Calculates a single invoice line item safely using integer math.
 */
export function calculateLineItem(input: LineItemInput): LineItemResult {
  // 1. Plan price + variant adjustment[cite: 1]
  const unitPrice = input.planPrice + input.variantAdjustment;

  // 2. Quantity[cite: 1]
  const subtotal = unitPrice * input.quantity;

  // 3 & 4. Line discount -> prorated subscription discount[cite: 1]
  // Discount cannot exceed the line's subtotal[cite: 4]
  const totalDiscount = Math.min(
    subtotal, 
    input.lineDiscountAmount + input.proratedSubDiscount
  );
  
  const taxableAmount = subtotal - totalDiscount;

  // 5. Tax using flat rates in basis points[cite: 1, 4]
  const rawTax = taxableAmount * (input.taxRateBasisPoints / 10000);

  // 6. Rounding: half-up per line[cite: 1]
  const taxAmount = Math.round(rawTax);
  const lineTotal = taxableAmount + taxAmount;

  return {
    unitPrice,
    subtotal,
    totalDiscount,
    taxAmount,
    lineTotal
  };
}

/**
 * Aggregates the calculated lines. Invoice totals must equal the sum of rounded lines[cite: 1].
 * Validates the core rule: total_amount = subtotal - discount_amount + tax_amount[cite: 4].
 */
export function calculateInvoiceTotals(lines: LineItemResult[]): InvoiceTotals {
  return lines.reduce(
    (acc, line) => {
      acc.subtotal += line.subtotal;
      acc.discountAmount += line.totalDiscount;
      acc.taxAmount += line.taxAmount;
      acc.totalAmount += line.lineTotal;
      return acc;
    },
    { subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0 }
  );
}
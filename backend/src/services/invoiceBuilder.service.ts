// src/services/invoiceBuilder.service.ts
import {
  allocateDiscount,
  calculateInvoiceTotals,
  calculateLineItem,
  type InvoiceTotals
} from '../utils/financialMath.js';

export type BillingItem = {
  product_id: string | null;
  product_name: string;
  variant_name?: string | null;
  quantity: number | string;
  unit_price: number | string;
};

export type InvoiceLine = {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRateBasisPoints: number;
  taxAmount: number;
  lineTotal: number;
};

type PreparedItem = {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export class InvoiceBuilder {
  private prepare(items: BillingItem[]): PreparedItem[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one subscription item is required');
    }

    return items.map((item) => {
      const unitPrice = Number(item.unit_price);
      const quantity = Number(item.quantity);

      if (!item.product_name?.trim()) {
        throw new Error('Subscription item is missing product information');
      }
      if (
        !Number.isSafeInteger(unitPrice) || unitPrice < 0 ||
        !Number.isSafeInteger(quantity) || quantity <= 0
      ) {
        throw new Error(`Invalid price or quantity for ${item.product_name}`);
      }

      return {
        productId: item.product_id ?? null,
        description: item.variant_name
          ? `${item.product_name} - ${item.variant_name}`
          : item.product_name,
        quantity,
        unitPrice
      };
    });
  }

  /** Pre-discount subtotal and total quantity, used to check discount eligibility. */
  summarize(items: BillingItem[]): { subtotal: number; quantity: number } {
    const prepared = this.prepare(items);
    return {
      subtotal: prepared.reduce((acc, p) => acc + p.unitPrice * p.quantity, 0),
      quantity: prepared.reduce((acc, p) => acc + p.quantity, 0)
    };
  }

  /**
   * Builds invoice lines and totals. An invoice-level discount is split across
   * the lines first, then tax is calculated on each discounted line.
   */
  build(
    items: BillingItem[],
    taxRateBasisPoints: number,
    discountAmount = 0
  ): { lines: InvoiceLine[]; totals: InvoiceTotals } {
    const prepared = this.prepare(items);
    const shares = allocateDiscount(
      prepared.map((p) => p.unitPrice * p.quantity),
      discountAmount
    );

    const results = prepared.map((p, index) =>
      calculateLineItem({
        unitPrice: p.unitPrice,
        quantity: p.quantity,
        discountAmount: shares[index],
        taxRateBasisPoints
      })
    );

    const lines: InvoiceLine[] = prepared.map((p, index) => ({
      productId: p.productId,
      description: p.description,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      discountAmount: results[index].discountAmount,
      taxRateBasisPoints,
      taxAmount: results[index].taxAmount,
      lineTotal: results[index].lineTotal
    }));

    return { lines, totals: calculateInvoiceTotals(results) };
  }
}

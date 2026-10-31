
import {
  calculateLineItem,
  type LineItemInput,
  type LineItemResult
} from '../utils/financialMath.js';

type SubscriptionItem = {
  product_id: string;
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number | string;
  variant_adjustment?: number | string;
};

type InvoiceLine = {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRateBasisPoints: number;
  taxAmount: number;
  lineTotal: number;
};

export class InvoiceBuilder {
  buildInvoiceItems(
    subscriptionItems: SubscriptionItem[],
    applicableDiscounts: unknown[] = [],
    taxRateBasisPoints = 0
  ): {
    lines: InvoiceLine[];
    calculatedResults: LineItemResult[];
  } {
    // Discount codes are validated and claimed by DiscountManager.
    // They are not product-specific rules in the current database schema.
    void applicableDiscounts;

    if (!Array.isArray(subscriptionItems) || subscriptionItems.length === 0) {
      throw new Error('At least one subscription item is required');
    }

    if (
      !Number.isSafeInteger(taxRateBasisPoints) ||
      taxRateBasisPoints < 0 ||
      taxRateBasisPoints > 10000
    ) {
      throw new Error('Tax rate must be between 0 and 10000 basis points');
    }

    const lines: InvoiceLine[] = [];
    const calculatedResults: LineItemResult[] = [];

    for (const item of subscriptionItems) {
      const unitPrice = Number(item.unit_price);
      const quantity = Number(item.quantity);
      const variantAdjustment = Number(item.variant_adjustment ?? 0);

      if (!item.product_id || !item.product_name?.trim()) {
        throw new Error('Subscription item is missing product information');
      }

      if (
        !Number.isSafeInteger(unitPrice) ||
        unitPrice < 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        !Number.isSafeInteger(variantAdjustment)
      ) {
        throw new Error(`Invalid price or quantity for ${item.product_name}`);
      }

      const input: LineItemInput = {
        planPrice: unitPrice,
        variantAdjustment,
        quantity,
        lineDiscountAmount: 0,
        proratedSubDiscount: 0,
        taxRateBasisPoints
      };

      const result = calculateLineItem(input);
      calculatedResults.push(result);

      const description = item.variant_name
        ? `${item.product_name} - ${item.variant_name}`
        : item.product_name;

      lines.push({
        productId: item.product_id,
        description,
        quantity,
        unitPrice: result.unitPrice,
        discountAmount: 0,
        taxRateBasisPoints,
        taxAmount: result.taxAmount,
        lineTotal: result.lineTotal
      });
    }

    return {
      lines,
      calculatedResults
    };
  }
}

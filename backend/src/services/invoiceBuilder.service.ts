// src/services/invoiceBuilder.service.ts
import { calculateLineItem, LineItemInput, LineItemResult } from '../utils/financialMath.js';

export class InvoiceBuilder {
  /**
   * Maps active subscription items to immutable invoice lines[cite: 4].
   * It extracts the agreed snapshot price and the selected JSONB variant adjustment.
   */
  buildInvoiceItems(
    subscriptionItems: any[], 
    applicableDiscounts: any[], 
    taxRateBasisPoints: number = 1800 // Flat administrator-defined rate[cite: 1]
  ): { lines: any[]; calculatedResults: LineItemResult[] } {
    const lines: any[] = [];
    const calculatedResults: LineItemResult[] = [];

    for (const item of subscriptionItems) {
      // Extract variant adjustment if a variant was snapshotted[cite: 4]
      let variantAdjustment = 0;
      if (item.variant_name && item.product_variants) {
        const variants = typeof item.product_variants === 'string' 
          ? JSON.parse(item.product_variants) 
          : item.product_variants;
        
        const selectedVariant = variants.find((v: any) => v.name === item.variant_name);
        if (selectedVariant) {
          variantAdjustment = selectedVariant.price_adjustment || 0;
        }
      }

      // Calculate specific line discounts (most specific rule wins)[cite: 2]
      const lineDiscountAmount = this.calculateApplicableDiscount(item.product_id, applicableDiscounts, item.unit_price);

      const mathInput: LineItemInput = {
        planPrice: parseInt(item.unit_price, 10),
        variantAdjustment,
        quantity: item.quantity,
        lineDiscountAmount,
        proratedSubDiscount: 0, // Assume 0 unless a subscription-wide discount is applied
        taxRateBasisPoints
      };

      const result = calculateLineItem(mathInput);
      calculatedResults.push(result);

      // Preserve product description and agreed price as an immutable snapshot[cite: 4]
      lines.push({
        productId: item.product_id,
        description: `${item.product_name}${item.variant_name ? ` - ${item.variant_name}` : ''}`,
        quantity: item.quantity,
        unitPrice: result.unitPrice,
        taxRateBasisPoints,
        lineTotal: result.lineTotal
      });
    }

    return { lines, calculatedResults };
  }

  private calculateApplicableDiscount(productId: string, discounts: any[], unitPrice: number): number {
    // Only one rule applies per scope; the most specific rule wins[cite: 2]
    const productSpecific = discounts.find(d => d.scope === 'product' && d.product_id === productId);
    if (productSpecific) return this.applyDiscountLogic(productSpecific, unitPrice);
    
    return 0; // Return 0 if no specific discount applies
  }

  private applyDiscountLogic(discount: any, baseAmount: number): number {
    if (discount.discount_type === 'fixed') {
      return parseInt(discount.discount_value, 10);
    }
    if (discount.discount_type === 'percentage') {
      return Math.round(baseAmount * (parseInt(discount.discount_value, 10) / 10000));
    }
    return 0;
  }
}
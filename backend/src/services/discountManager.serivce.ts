// src/services/discountManager.serivce.ts
import type { PoolClient } from 'pg';
import { discountRepo } from '../repositories/discountRepo.js';
import { mulDivHalfUp } from '../utils/financialMath.js';

export type DiscountEvaluation = {
  discountId: string | null;
  appliedAmount: number;
  reason?: string;
};

const notApplied = (reason: string): DiscountEvaluation => ({
  discountId: null,
  appliedAmount: 0,
  reason
});

export class DiscountManager {
  /**
   * Validates a discount code against an invoice (active, date window, minimum
   * purchase, minimum quantity, redemption limit) and works out the amount.
   * The discount row stays locked until the surrounding transaction ends, so the
   * limit cannot be exceeded by concurrent invoices.
   *
   * `pendingRedemptions` counts redemptions already granted in the same preview
   * that are not yet stored in the database.
   */
  async evaluate(
    db: PoolClient,
    code: string,
    subtotal: number,
    quantity: number,
    pendingRedemptions = 0
  ): Promise<DiscountEvaluation> {
    const trimmed = code.trim();
    if (!trimmed) return notApplied('Discount code is required');

    if (!Number.isSafeInteger(subtotal) || subtotal <= 0) {
      return notApplied('Purchase amount must be a positive integer in paise');
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return notApplied('Quantity must be a positive integer');
    }

    const discount = await discountRepo.getDiscountForUpdate(db, trimmed);
    if (!discount) return notApplied('Discount invalid, expired, or inactive');

    const minimumPurchase = Number(discount.minimum_purchase ?? 0);
    const minimumQuantity = Number(discount.minimum_quantity ?? 1);
    const discountValue = Number(discount.discount_value);

    if (
      !Number.isSafeInteger(minimumPurchase) ||
      !Number.isSafeInteger(minimumQuantity) ||
      !Number.isSafeInteger(discountValue)
    ) {
      throw new Error('Invalid discount configuration in database');
    }

    if (subtotal < minimumPurchase) return notApplied('Minimum purchase amount not met');
    if (quantity < minimumQuantity) return notApplied('Minimum quantity not met');

    if (discount.max_redemptions !== null) {
      const used = await discountRepo.getRedemptionCount(db, discount.id);
      if (used + pendingRedemptions >= Number(discount.max_redemptions)) {
        return notApplied('Discount redemption limit reached');
      }
    }

    let appliedAmount: number;
    if (discount.discount_type === 'fixed') {
      appliedAmount = Math.min(discountValue, subtotal);
    } else if (discount.discount_type === 'percentage') {
      if (discountValue < 0 || discountValue > 10000) {
        throw new Error('Percentage discount must be between 0 and 10000 basis points');
      }
      appliedAmount = Math.min(mulDivHalfUp(subtotal, discountValue, 10000), subtotal);
    } else {
      throw new Error('Unsupported discount type');
    }

    if (appliedAmount <= 0) return notApplied('Discount amount is zero');

    return { discountId: discount.id, appliedAmount };
  }

  /** Stores the redemption once the invoice exists (same transaction as the invoice). */
  async redeem(
    db: PoolClient,
    discountId: string,
    invoiceId: string,
    customerId: string,
    appliedAmount: number
  ) {
    return discountRepo.recordRedemption(db, discountId, invoiceId, customerId, appliedAmount);
  }
}


import type { PoolClient } from 'pg';
import { discountRepo } from '../repositories/discountRepo.js';

type DiscountResult = {
  appliedAmount: number;
  discountId: string | null;
  error?: string;
};

export class DiscountManager {
  async claimDiscountAtomic(
    tx: PoolClient,
    code: string,
    invoiceId: string,
    customerId: string,
    purchaseAmount: number,
    quantity: number
  ): Promise<DiscountResult> {
    if (!code.trim()) {
      return {
        appliedAmount: 0,
        discountId: null,
        error: 'Discount code is required'
      };
    }

    if (!Number.isSafeInteger(purchaseAmount) || purchaseAmount <= 0) {
      return {
        appliedAmount: 0,
        discountId: null,
        error: 'Purchase amount must be a positive integer in paise'
      };
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return {
        appliedAmount: 0,
        discountId: null,
        error: 'Quantity must be a positive integer'
      };
    }

    // The discount row is locked until the surrounding transaction ends.
    const discount = await discountRepo.getDiscountForUpdate(
      tx,
      code.trim()
    );

    if (!discount) {
      return {
        appliedAmount: 0,
        discountId: null,
        error: 'Discount invalid, expired, or inactive'
      };
    }

    const minimumPurchase = Number(discount.minimum_purchase);
    const minimumQuantity = Number(discount.minimum_quantity);
    const discountValue = Number(discount.discount_value);

    if (
      !Number.isSafeInteger(minimumPurchase) ||
      !Number.isSafeInteger(minimumQuantity) ||
      !Number.isSafeInteger(discountValue)
    ) {
      throw new Error('Invalid discount configuration in database');
    }

    if (purchaseAmount < minimumPurchase) {
      return {
        appliedAmount: 0,
        discountId: null,
        error: 'Minimum purchase amount not met'
      };
    }

    if (quantity < minimumQuantity) {
      return {
        appliedAmount: 0,
        discountId: null,
        error: 'Minimum quantity not met'
      };
    }

    if (discount.max_redemptions !== null) {
      const currentRedemptions =
        await discountRepo.getRedemptionCount(tx, discount.id);

      if (currentRedemptions >= Number(discount.max_redemptions)) {
        return {
          appliedAmount: 0,
          discountId: null,
          error: 'Discount redemption limit reached'
        };
      }
    }

    let appliedAmount = 0;

    if (discount.discount_type === 'fixed') {
      appliedAmount = Math.min(discountValue, purchaseAmount);
    } else if (discount.discount_type === 'percentage') {
      if (discountValue < 0 || discountValue > 10000) {
        throw new Error('Percentage discount must be between 0 and 10000 basis points');
      }

      // Integer arithmetic with half-up rounding.
      appliedAmount = Math.floor(
        (purchaseAmount * discountValue + 5000) / 10000
      );
      appliedAmount = Math.min(appliedAmount, purchaseAmount);
    } else {
      throw new Error('Unsupported discount type');
    }

    if (!Number.isSafeInteger(appliedAmount)) {
      throw new Error('Calculated discount exceeds safe integer range');
    }

    // Do not create a redemption if the discount has no monetary value.
    if (appliedAmount <= 0) {
      return {
        appliedAmount: 0,
        discountId: null,
        error: 'Discount amount is zero'
      };
    }

    await discountRepo.recordRedemption(
      tx,
      discount.id,
      invoiceId,
      customerId,
      appliedAmount
    );

    return {
      appliedAmount,
      discountId: discount.id
    };
  }
}

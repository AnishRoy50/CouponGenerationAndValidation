/**
 * Generates a random alphanumeric coupon code
 * @param length Length of the code (default: 10)
 * @param prefix Optional prefix for the code
 * @returns Generated coupon code
 */
export function generateCouponCode(length: number = 10, prefix?: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return prefix ? `${prefix}${code}` : code;
}

/**
 * Generates a unique coupon code with timestamp
 * @param prefix Optional prefix
 * @returns Unique coupon code
 */
export function generateUniqueCouponCode(prefix?: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const code = `${timestamp}${random}`;
  
  return prefix ? `${prefix}-${code}` : code;
}

/**
 * Calculates discount amount based on discount type
 * @param orderValue Order value
 * @param discountType Type of discount (percentage or fixed)
 * @param discountValue Discount value
 * @param maxDiscountAmount Maximum discount cap for percentage discounts
 * @returns Calculated discount amount
 */
export function calculateDiscount(
  orderValue: number,
  discountType: string,
  discountValue: number,
  maxDiscountAmount?: number
): number {
  let discount = 0;
  
  if (discountType === 'percentage') {
    discount = (orderValue * discountValue) / 100;
    if (maxDiscountAmount && discount > maxDiscountAmount) {
      discount = maxDiscountAmount;
    }
  } else if (discountType === 'fixed') {
    discount = Math.min(discountValue, orderValue);
  }
  
  return Math.round(discount * 100) / 100; // Round to 2 decimal places
}

/**
 * Validates if a date is within a valid range
 * @param validFrom Start date
 * @param validUntil End date
 * @returns Boolean indicating if current time is within range
 */
export function isWithinValidDateRange(validFrom?: Date, validUntil?: Date): boolean {
  if (!validFrom || !validUntil) {
    return false;
  }
  
  const now = new Date();
  return now >= validFrom && now <= validUntil;
}

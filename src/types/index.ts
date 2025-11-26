export enum CouponType {
  USER_SPECIFIC = 'user_specific',
  TIME_SPECIFIC = 'time_specific',
}

export enum CouponStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  EXHAUSTED = 'exhausted',
  INACTIVE = 'inactive',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue: number;
  description?: string;
  status: CouponStatus;
  userId?: string;
  validFrom?: Date;
  validUntil?: Date;
  maxUsesPerUser?: number;
  maxTotalUses?: number;
  currentTotalUses: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CouponUsage {
  id: string;
  couponId: string;
  userId: string;
  orderId: string;
  orderValue: number;
  discountApplied: number;
  usedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateUserSpecificCouponDto {
  userId: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue?: number;
  description?: string;
  createdBy?: string;
}

export interface CreateTimeSpecificCouponDto {
  code?: string; // Optional, will be generated if not provided
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue?: number;
  description?: string;
  validFrom: Date;
  validUntil: Date;
  maxUsesPerUser: number;
  maxTotalUses?: number;
  createdBy?: string;
}

export interface ValidateCouponDto {
  code: string;
  userId: string;
  orderId?: string;
  orderValue: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  finalAmount?: number;
  reason?: string;
}

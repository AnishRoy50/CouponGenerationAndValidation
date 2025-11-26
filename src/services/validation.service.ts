import { db } from '../database';
import { CouponService } from './coupon.service';
import { 
  ValidateCouponDto, 
  ValidationResult, 
  CouponType, 
  CouponStatus,
  CouponUsage 
} from '../types';
import { calculateDiscount, isWithinValidDateRange } from '../utils/helpers';
import { logger } from '../utils/logger';
import { ValidationLogService } from './validationLog.service';

export class ValidationService {
  private couponService: CouponService;
  private validationLogService: ValidationLogService;

  constructor(validationLogService: ValidationLogService) {
    this.couponService = new CouponService();
    this.validationLogService = validationLogService;
  }

  async validateCoupon(dto: ValidateCouponDto): Promise<ValidationResult> {
    const startTime = Date.now();
    let result: ValidationResult = { valid: false, reason: 'Unknown error' };
    let couponId: string | undefined;
    
    try {
      const coupon = await this.couponService.getCouponByCode(dto.code);
      couponId = coupon?.id;
      if (!coupon) {
        result = { valid: false, reason: 'Coupon not found' };
        return result;
      }

      if (coupon.status !== CouponStatus.ACTIVE) {
        result = { valid: false, reason: `Coupon is ${coupon.status}` };
        return result;
      }

      if (dto.orderValue < coupon.minOrderValue) {
        result = { 
          valid: false, 
          reason: `Minimum order value of ${coupon.minOrderValue} not met` 
        };
        return result;
      }

      if (dto.orderId) {
        const orderAlreadyUsed = await this.isOrderAlreadyUsed(dto.orderId);
        if (orderAlreadyUsed) {
          result = { valid: false, reason: 'This order has already used a coupon' };
          return result;
        }
      }

      let validationResult: ValidationResult;
      
      if (coupon.type === CouponType.USER_SPECIFIC) {
        validationResult = await this.validateUserSpecificCoupon(coupon, dto);
      } else {
        validationResult = await this.validateTimeSpecificCoupon(coupon, dto);
      }

      if (validationResult.valid) {
        const discountAmount = calculateDiscount(
          dto.orderValue,
          coupon.discountType,
          coupon.discountValue,
          coupon.maxDiscountAmount
        );

        const finalAmount = dto.orderValue - discountAmount;

        // Record usage in transaction
        await db.transaction(async (client) => {
          // Insert usage record
          await client.query(
            `INSERT INTO coupon_usage 
             (coupon_id, user_id, order_id, order_value, discount_applied, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [coupon.id, dto.userId, dto.orderId, dto.orderValue, discountAmount, dto.ipAddress, dto.userAgent]
          );

          // Increment usage count
          await client.query(
            'UPDATE coupons SET current_total_uses = current_total_uses + 1 WHERE id = $1',
            [coupon.id]
          );

          // Check if coupon is exhausted
          if (coupon.maxTotalUses && coupon.currentTotalUses + 1 >= coupon.maxTotalUses) {
            await client.query(
              'UPDATE coupons SET status = $1 WHERE id = $2',
              [CouponStatus.EXHAUSTED, coupon.id]
            );
          }
        });

        logger.info('Coupon validated and applied', { 
          code: dto.code, 
          userId: dto.userId, 
          orderId: dto.orderId,
          discountAmount 
        });

        result = {
          valid: true,
          coupon,
          discountAmount,
          finalAmount,
        };
        return result;
      }

      result = validationResult;
      return result;
    } catch (error) {
      logger.error('Error validating coupon', { error, dto });
      result = { valid: false, reason: 'Validation failed' };
      throw new Error('Failed to validate coupon');
    } finally {
      // Log asynchronously (non-blocking)
      const responseTime = Date.now() - startTime;
      this.validationLogService.logValidationAttempt({
        couponCode: dto.code,
        userId: dto.userId,
        orderId: dto.orderId,
        orderValue: dto.orderValue,
        isValid: result?.valid || false,
        validationReason: result?.valid ? undefined : result?.reason,
        discountApplied: result?.discountAmount,
        finalAmount: result?.finalAmount,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        responseTimeMs: responseTime,
        couponId
      });
    }
  }

  private async validateUserSpecificCoupon(
    coupon: any,
    dto: ValidateCouponDto
  ): Promise<ValidationResult> {
    if (coupon.userId !== dto.userId) {
      return { valid: false, reason: 'This coupon is not assigned to you' };
    }

    const usageCount = await this.getUserCouponUsageCount(coupon.id, dto.userId);
    if (usageCount > 0) {
      return { valid: false, reason: 'You have already used this coupon' };
    }

    return { valid: true };
  }

  private async validateTimeSpecificCoupon(
    coupon: any,
    dto: ValidateCouponDto
  ): Promise<ValidationResult> {
    if (!isWithinValidDateRange(coupon.validFrom, coupon.validUntil)) {
      if (coupon.validUntil && new Date() > coupon.validUntil) {
        await this.couponService.updateCouponStatus(coupon.id, CouponStatus.EXPIRED);
      }
      return { valid: false, reason: 'Coupon has expired or is not yet valid' };
    }

    if (coupon.maxTotalUses && coupon.currentTotalUses >= coupon.maxTotalUses) {
      await this.couponService.updateCouponStatus(coupon.id, CouponStatus.EXHAUSTED);
      return { valid: false, reason: 'Coupon usage limit reached' };
    }

    if (coupon.maxUsesPerUser) {
      const userUsageCount = await this.getUserCouponUsageCount(coupon.id, dto.userId);
      if (userUsageCount >= coupon.maxUsesPerUser) {
        return { 
          valid: false, 
          reason: `You have reached the maximum usage limit (${coupon.maxUsesPerUser}) for this coupon` 
        };
      }
    }

    return { valid: true };
  }

  private async getUserCouponUsageCount(couponId: string, userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM coupon_usage 
      WHERE coupon_id = $1 AND user_id = $2
    `;
    
    try {
      const result = await db.query(query, [couponId, userId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error getting user coupon usage count', { error, couponId, userId });
      throw new Error('Failed to check usage count');
    }
  }

  private async isOrderAlreadyUsed(orderId: string): Promise<boolean> {
    const query = 'SELECT COUNT(*) as count FROM coupon_usage WHERE order_id = $1';
    
    try {
      const result = await db.query(query, [orderId]);
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('Error checking order usage', { error, orderId });
      throw new Error('Failed to check order usage');
    }
  }

  async getCouponUsageHistory(couponId: string): Promise<CouponUsage[]> {
    const query = `
      SELECT * FROM coupon_usage 
      WHERE coupon_id = $1 
      ORDER BY used_at DESC
    `;
    
    try {
      const result = await db.query(query, [couponId]);
      return result.rows.map((row: any) => ({
        id: row.id,
        couponId: row.coupon_id,
        userId: row.user_id,
        orderId: row.order_id,
        orderValue: parseFloat(row.order_value),
        discountApplied: parseFloat(row.discount_applied),
        usedAt: new Date(row.used_at),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      }));
    } catch (error) {
      logger.error('Error getting coupon usage history', { error, couponId });
      throw new Error('Failed to get usage history');
    }
  }

  async getUserUsageHistory(userId: string): Promise<CouponUsage[]> {
    const query = `
      SELECT * FROM coupon_usage 
      WHERE user_id = $1 
      ORDER BY used_at DESC
    `;
    
    try {
      const result = await db.query(query, [userId]);
      return result.rows.map((row: any) => ({
        id: row.id,
        couponId: row.coupon_id,
        userId: row.user_id,
        orderId: row.order_id,
        orderValue: parseFloat(row.order_value),
        discountApplied: parseFloat(row.discount_applied),
        usedAt: new Date(row.used_at),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      }));
    } catch (error) {
      logger.error('Error getting user usage history', { error, userId });
      throw new Error('Failed to get usage history');
    }
  }
}

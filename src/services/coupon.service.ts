import { db } from '../database';
import { 
  Coupon, 
  CouponType, 
  CouponStatus, 
  CreateUserSpecificCouponDto, 
  CreateTimeSpecificCouponDto 
} from '../types';
import { generateCouponCode, generateUniqueCouponCode } from '../utils/helpers';
import { logger } from '../utils/logger';

export class CouponService {
  /**
   * Generate a user-specific coupon
   */
  async generateUserSpecificCoupon(dto: CreateUserSpecificCouponDto): Promise<Coupon> {
    const code = generateUniqueCouponCode('USER');
    
    const query = `
      INSERT INTO coupons (
        code, type, discount_type, discount_value, max_discount_amount, 
        min_order_value, description, user_id, created_by, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      code,
      CouponType.USER_SPECIFIC,
      dto.discountType,
      dto.discountValue,
      dto.maxDiscountAmount || null,
      dto.minOrderValue || 0,
      dto.description || null,
      dto.userId,
      dto.createdBy || 'system',
      CouponStatus.ACTIVE,
    ];
    
    try {
      const result = await db.query(query, values);
      logger.info('User-specific coupon created', { code, userId: dto.userId });
      return this.mapRowToCoupon(result.rows[0]);
    } catch (error) {
      logger.error('Error creating user-specific coupon', { error, dto });
      throw new Error('Failed to create user-specific coupon');
    }
  }

  /**
   * Generate a time-specific coupon
   */
  async generateTimeSpecificCoupon(dto: CreateTimeSpecificCouponDto): Promise<Coupon> {
    const code = dto.code || generateCouponCode(12, 'PROMO');
    
    // Check if code already exists
    const existingCoupon = await this.getCouponByCode(code);
    if (existingCoupon) {
      throw new Error('Coupon code already exists');
    }
    
    const query = `
      INSERT INTO coupons (
        code, type, discount_type, discount_value, max_discount_amount,
        min_order_value, description, valid_from, valid_until,
        max_uses_per_user, max_total_uses, created_by, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      code,
      CouponType.TIME_SPECIFIC,
      dto.discountType,
      dto.discountValue,
      dto.maxDiscountAmount || null,
      dto.minOrderValue || 0,
      dto.description || null,
      dto.validFrom,
      dto.validUntil,
      dto.maxUsesPerUser,
      dto.maxTotalUses || null,
      dto.createdBy || 'system',
      CouponStatus.ACTIVE,
    ];
    
    try {
      const result = await db.query(query, values);
      logger.info('Time-specific coupon created', { code, validFrom: dto.validFrom, validUntil: dto.validUntil });
      return this.mapRowToCoupon(result.rows[0]);
    } catch (error) {
      logger.error('Error creating time-specific coupon', { error, dto });
      throw new Error('Failed to create time-specific coupon');
    }
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    // Optimized query using composite index (code, status, type)
    const query = `
      SELECT id, code, type, discount_type, discount_value, max_discount_amount,
             min_order_value, description, user_id, status, created_by,
             valid_from, valid_until, max_total_uses, current_total_uses,
             created_at, updated_at
      FROM coupons 
      WHERE code = $1
    `;
    
    try {
      const result = await db.query(query, [code]);
      return result.rows.length > 0 ? this.mapRowToCoupon(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error fetching coupon by code', { error, code });
      throw new Error('Failed to fetch coupon');
    }
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(id: string): Promise<Coupon | null> {
    const query = 'SELECT * FROM coupons WHERE id = $1';
    
    try {
      const result = await db.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToCoupon(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error fetching coupon by ID', { error, id });
      throw new Error('Failed to fetch coupon');
    }
  }

  /**
   * Get all coupons for a user
   */
  async getUserCoupons(userId: string): Promise<Coupon[]> {
    const query = `
      SELECT * FROM coupons 
      WHERE user_id = $1 AND status = $2
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await db.query(query, [userId, CouponStatus.ACTIVE]);
      return result.rows.map(row => this.mapRowToCoupon(row));
    } catch (error) {
      logger.error('Error fetching user coupons', { error, userId });
      throw new Error('Failed to fetch user coupons');
    }
  }

  /**
   * Get all active time-specific coupons
   */
  async getActiveTimeSpecificCoupons(): Promise<Coupon[]> {
    const query = `
      SELECT * FROM coupons 
      WHERE type = $1 AND status = $2 
        AND valid_from <= NOW() 
        AND valid_until >= NOW()
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await db.query(query, [CouponType.TIME_SPECIFIC, CouponStatus.ACTIVE]);
      return result.rows.map(row => this.mapRowToCoupon(row));
    } catch (error) {
      logger.error('Error fetching active time-specific coupons', error);
      throw new Error('Failed to fetch coupons');
    }
  }

  /**
   * Update coupon status
   */
  async updateCouponStatus(id: string, status: CouponStatus): Promise<void> {
    const query = 'UPDATE coupons SET status = $1 WHERE id = $2';
    
    try {
      await db.query(query, [status, id]);
      logger.info('Coupon status updated', { id, status });
    } catch (error) {
      logger.error('Error updating coupon status', { error, id, status });
      throw new Error('Failed to update coupon status');
    }
  }

  /**
   * Increment coupon usage count
   */
  async incrementUsageCount(id: string): Promise<void> {
    const query = 'UPDATE coupons SET current_total_uses = current_total_uses + 1 WHERE id = $1';
    
    try {
      await db.query(query, [id]);
    } catch (error) {
      logger.error('Error incrementing usage count', { error, id });
      throw new Error('Failed to increment usage count');
    }
  }

  /**
   * Map database row to Coupon object
   */
  private mapRowToCoupon(row: any): Coupon {
    return {
      id: row.id,
      code: row.code,
      type: row.type as CouponType,
      discountType: row.discount_type,
      discountValue: parseFloat(row.discount_value),
      maxDiscountAmount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : undefined,
      minOrderValue: parseFloat(row.min_order_value),
      description: row.description,
      status: row.status as CouponStatus,
      userId: row.user_id,
      validFrom: row.valid_from ? new Date(row.valid_from) : undefined,
      validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
      maxUsesPerUser: row.max_uses_per_user,
      maxTotalUses: row.max_total_uses,
      currentTotalUses: row.current_total_uses,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
    };
  }
}

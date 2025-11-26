import { Router, Request, Response } from 'express';
import { CouponService } from '../services/coupon.service';
import { ValidationService } from '../services/validation.service';
import { ValidationLogService } from '../services/validationLog.service';
import {
  createUserSpecificCouponSchema,
  createTimeSpecificCouponSchema,
  validateCouponSchema,
} from '../validators/coupon.validator';
import { validateRequest, asyncHandler } from '../middleware/error.middleware';
import { CreateUserSpecificCouponDto, CreateTimeSpecificCouponDto, ValidateCouponDto } from '../types';
import { db } from '../database';

const router = Router();
const couponService = new CouponService();
const validationLogService = new ValidationLogService(db.pool);
const validationService = new ValidationService(validationLogService);

export function getValidationLogService() {
  return validationLogService;
}

/**
 * POST /api/coupons/user-specific
 * Create a user-specific coupon
 */
router.post(
  '/user-specific',
  validateRequest(createUserSpecificCouponSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateUserSpecificCouponDto = req.body;
    const coupon = await couponService.generateUserSpecificCoupon(dto);
    
    res.status(201).json({
      success: true,
      data: coupon,
      message: 'User-specific coupon created successfully',
    });
  })
);

/**
 * POST /api/coupons/time-specific
 * Create a time-specific coupon
 */
router.post(
  '/time-specific',
  validateRequest(createTimeSpecificCouponSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateTimeSpecificCouponDto = {
      ...req.body,
      validFrom: new Date(req.body.validFrom),
      validUntil: new Date(req.body.validUntil),
    };
    const coupon = await couponService.generateTimeSpecificCoupon(dto);
    
    res.status(201).json({
      success: true,
      data: coupon,
      message: 'Time-specific coupon created successfully',
    });
  })
);

/**
 * POST /api/coupons/validate
 * Validate and apply a coupon
 */
router.post(
  '/validate',
  validateRequest(validateCouponSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dto: ValidateCouponDto = {
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };
    
    const result = await validationService.validateCoupon(dto);
    
    if (result.valid) {
      res.status(200).json({
        success: true,
        data: {
          coupon: result.coupon,
          discountAmount: result.discountAmount,
          finalAmount: result.finalAmount,
        },
        message: 'Coupon applied successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.reason,
      });
    }
  })
);

/**
  *GET /api/coupons/:code
  *Get coupon details by code
 */
router.get(
  '/:code',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { code } = req.params;
    const coupon = await couponService.getCouponByCode(code);
    
    if (!coupon) {
      res.status(404).json({
        success: false,
        error: 'Coupon not found',
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: coupon,
    });
  })
);

/**
 * GET /api/coupons/user/:userId
 * Get all coupons for a specific user
 */
router.get(
  '/user/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const coupons = await couponService.getUserCoupons(userId);
    
    res.status(200).json({
      success: true,
      data: coupons,
      count: coupons.length,
    });
  })
);

/**
 * GET /api/coupons/active/time-specific
 * Get all active time-specific coupons
 */
router.get(
  '/active/time-specific',
  asyncHandler(async (_req: Request, res: Response) => {
    const coupons = await couponService.getActiveTimeSpecificCoupons();
    
    res.status(200).json({
      success: true,
      data: coupons,
      count: coupons.length,
    });
  })
);

/**
 * GET /api/coupons/:couponId/usage-history
 * Get usage history for a coupon
 */
router.get(
  '/:couponId/usage-history',
  asyncHandler(async (req: Request, res: Response) => {
    const { couponId } = req.params;
    const history = await validationService.getCouponUsageHistory(couponId);
    
    res.status(200).json({
      success: true,
      data: history,
      count: history.length,
    });
  })
);

/**
 * GET /api/coupons/user/:userId/usage-history
 * Get usage history for a user
 */
router.get(
  '/user/:userId/usage-history',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const history = await validationService.getUserUsageHistory(userId);
    
    res.status(200).json({
      success: true,
      data: history,
      count: history.length,
    });
  })
);

export default router;

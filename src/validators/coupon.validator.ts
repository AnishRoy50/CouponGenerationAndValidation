import Joi from 'joi';
import { DiscountType } from '../types';

export const createUserSpecificCouponSchema = Joi.object({
  userId: Joi.string().required().min(1).max(100),
  discountType: Joi.string().valid(DiscountType.PERCENTAGE, DiscountType.FIXED).required(),
  discountValue: Joi.number().positive().required(),
  maxDiscountAmount: Joi.number().positive().optional(),
  minOrderValue: Joi.number().min(0).optional(),
  description: Joi.string().max(500).optional(),
  createdBy: Joi.string().max(100).optional(),
});

export const createTimeSpecificCouponSchema = Joi.object({
  code: Joi.string().min(4).max(50).optional(),
  discountType: Joi.string().valid(DiscountType.PERCENTAGE, DiscountType.FIXED).required(),
  discountValue: Joi.number().positive().required(),
  maxDiscountAmount: Joi.number().positive().optional(),
  minOrderValue: Joi.number().min(0).optional(),
  description: Joi.string().max(500).optional(),
  validFrom: Joi.date().iso().required(),
  validUntil: Joi.date().iso().greater(Joi.ref('validFrom')).required(),
  maxUsesPerUser: Joi.number().integer().positive().required(),
  maxTotalUses: Joi.number().integer().positive().optional(),
  createdBy: Joi.string().max(100).optional(),
});

export const validateCouponSchema = Joi.object({
  code: Joi.string().required().min(1).max(50),
  userId: Joi.string().required().min(1).max(100),
  orderId: Joi.string().optional().min(1).max(100),
  orderValue: Joi.number().positive().required(),
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional(),
  userAgent: Joi.string().max(500).optional(),
});

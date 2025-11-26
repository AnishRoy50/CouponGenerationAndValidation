-- Migration: Make order_id optional in coupon_usage table
-- This allows validating coupons without requiring an orderId for testing purposes

-- Drop the existing UNIQUE constraint on order_id
ALTER TABLE coupon_usage DROP CONSTRAINT IF EXISTS coupon_usage_order_id_key;

-- Make order_id nullable
ALTER TABLE coupon_usage ALTER COLUMN order_id DROP NOT NULL;

-- Add a unique constraint that only applies when order_id is not null
-- This still prevents duplicate order usage when orderId is provided
CREATE UNIQUE INDEX idx_coupon_usage_order_id_unique 
ON coupon_usage(order_id) 
WHERE order_id IS NOT NULL;

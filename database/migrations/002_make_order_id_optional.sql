-- Migration: Make order_id optional in coupon_usage table
ALTER TABLE coupon_usage DROP CONSTRAINT IF EXISTS coupon_usage_order_id_key;

ALTER TABLE coupon_usage ALTER COLUMN order_id DROP NOT NULL;
CREATE UNIQUE INDEX idx_coupon_usage_order_id_unique 
ON coupon_usage(order_id) 
WHERE order_id IS NOT NULL;

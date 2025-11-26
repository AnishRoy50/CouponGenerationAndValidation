-- Performance optimization indexes
-- These indexes are crucial for achieving <100ms response time

-- Composite index for coupon lookup and validation in one query
CREATE INDEX IF NOT EXISTS idx_coupons_code_status_type 
ON coupons(code, status, type) 
INCLUDE (discount_type, discount_value, max_discount_amount, min_order_value, user_id, valid_from, valid_until, max_total_uses, current_total_uses);

-- Composite index for user-specific coupon validation
CREATE INDEX IF NOT EXISTS idx_coupons_code_user_status 
ON coupons(code, user_id, status) 
WHERE type = 'user_specific';

-- Composite index for time-specific coupon validation  
CREATE INDEX IF NOT EXISTS idx_coupons_code_dates_status 
ON coupons(code, status, valid_from, valid_until) 
WHERE type = 'time_specific';

-- Optimize coupon usage queries
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_user 
ON coupon_usage(coupon_id, user_id);

-- Optimize order lookup
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_lookup 
ON coupon_usage(order_id) 
WHERE order_id IS NOT NULL;

-- Add statistics for query planner
ANALYZE coupons;
ANALYZE coupon_usage;

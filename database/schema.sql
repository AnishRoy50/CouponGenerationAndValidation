-- Database Schema for Coupon System
-- This schema supports both user-specific and time-specific coupons

-- Enum for coupon types
CREATE TYPE coupon_type AS ENUM ('user_specific', 'time_specific');

-- Enum for coupon status
CREATE TYPE coupon_status AS ENUM ('active', 'expired', 'exhausted', 'inactive');

-- Main coupons table
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type coupon_type NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'percentage' or 'fixed'
    discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
    max_discount_amount DECIMAL(10, 2), -- For percentage discounts
    min_order_value DECIMAL(10, 2) DEFAULT 0,
    description TEXT,
    status coupon_status DEFAULT 'active',
    
    -- For user-specific coupons
    user_id VARCHAR(100), -- Reference to user in main system
    
    -- For time-specific coupons
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    max_uses_per_user INTEGER, 
    max_total_uses INTEGER, 
    current_total_uses INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100), 
    
    
    CONSTRAINT valid_date_range CHECK (
        (type = 'time_specific' AND valid_from IS NOT NULL AND valid_until IS NOT NULL AND valid_from < valid_until)
        OR type = 'user_specific'
    ),
    CONSTRAINT user_specific_has_user CHECK (
        (type = 'user_specific' AND user_id IS NOT NULL)
        OR type = 'time_specific'
    )
);

-- Coupon usage tracking table
CREATE TABLE coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    order_id VARCHAR(100) NOT NULL UNIQUE, -- Prevent duplicate usage for same order
    order_value DECIMAL(10, 2) NOT NULL,
    discount_applied DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata for auditing
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Indexes for performance
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_type ON coupons(type);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_user_id ON coupons(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_coupons_valid_dates ON coupons(valid_from, valid_until) WHERE type = 'time_specific';

CREATE INDEX idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX idx_coupon_usage_order_id ON coupon_usage(order_id);
CREATE INDEX idx_coupon_usage_used_at ON coupon_usage(used_at);

-- Composite index for checking user usage count
CREATE INDEX idx_coupon_usage_coupon_user ON coupon_usage(coupon_id, user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for active coupons with usage stats
CREATE VIEW active_coupons_stats AS
SELECT 
    c.id,
    c.code,
    c.type,
    c.discount_type,
    c.discount_value,
    c.status,
    c.user_id,
    c.valid_from,
    c.valid_until,
    c.max_uses_per_user,
    c.max_total_uses,
    c.current_total_uses,
    COUNT(cu.id) as actual_usage_count,
    c.created_at
FROM coupons c
LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
WHERE c.status = 'active'
GROUP BY c.id;

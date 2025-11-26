-- Validation logs table for asynchronous logging
CREATE TABLE IF NOT EXISTS validation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request details
    coupon_code VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    order_id VARCHAR(100),
    order_value DECIMAL(10, 2),
    
    -- Validation result
    is_valid BOOLEAN NOT NULL,
    validation_reason TEXT, -- Reason for failure if invalid
    discount_applied DECIMAL(10, 2),
    final_amount DECIMAL(10, 2),
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER, -- Track response time
    
    -- Audit trail
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL
);

-- Indexes for querying logs
CREATE INDEX IF NOT EXISTS idx_validation_logs_coupon_code ON validation_logs(coupon_code);
CREATE INDEX IF NOT EXISTS idx_validation_logs_user_id ON validation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_logs_validated_at ON validation_logs(validated_at);
CREATE INDEX IF NOT EXISTS idx_validation_logs_is_valid ON validation_logs(is_valid);
CREATE INDEX IF NOT EXISTS idx_validation_logs_coupon_id ON validation_logs(coupon_id);

-- Composite index for analytics
CREATE INDEX IF NOT EXISTS idx_validation_logs_analytics 
ON validation_logs(coupon_code, is_valid, validated_at);

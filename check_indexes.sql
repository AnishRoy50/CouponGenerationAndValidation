SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'coupon_usage'
ORDER BY indexname;

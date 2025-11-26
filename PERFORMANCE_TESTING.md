# Performance Testing Guide

This guide explains how to test the coupon validation system's performance with the target of **<100ms response time** for 1M users and 5k coupons.

## Prerequisites

1. **Server running**: Make sure the development server is running
   ```bash
   npm run dev
   ```

2. **Database ready**: Ensure PostgreSQL is running and migrations are applied

## Step 1: Seed Performance Data

Generate mock data for load testing:

```bash
npm run seed
```

This will create:
- **1,000,000 users** (`user_0000000` to `user_0999999`)
- **5,000 coupons** (50% user-specific, 50% time-specific)
  - 60% active
  - 25% expired  
  - 15% inactive
- **~3,000 usage records** (for active coupons)

**Expected duration**: 2-5 minutes depending on your hardware.

## Step 2: Run Performance Benchmark

Once seeding is complete, run the benchmark:

```bash
npm run benchmark
```

The benchmark will:
- Execute **1,000 validation requests**
- Use **100 concurrent requests** at a time
- Measure response times and calculate statistics
- Display P50, P95, P99 percentiles

### Expected Output

```
═══════════════════════════════════════════════════════
                  BENCHMARK RESULTS                    
═══════════════════════════════════════════════════════
Total Requests:        1,000
Successful:            1,000
Failed:                0
Total Duration:        15.23s
───────────────────────────────────────────────────────
Response Times:
  Average:             45.32 ms
  Minimum:             12.45 ms
  Maximum:             156.78 ms
  50th percentile:     38.21 ms
  95th percentile:     89.45 ms
  99th percentile:     125.67 ms
───────────────────────────────────────────────────────
Throughput:            65.66 req/s
═══════════════════════════════════════════════════════

✅ EXCELLENT: 95th percentile response time < 100ms
✅ EXCELLENT: Average response time < 100ms
```

## Performance Optimizations Implemented

### 1. **Database Indexes**
- Composite index on `(code, status, type)` with INCLUDE clause
- Partial indexes for user-specific and time-specific coupons
- Optimized indexes on `coupon_usage` for fast lookups

### 2. **Query Optimization**
- Single query to fetch coupon with all necessary fields
- Avoided SELECT * in favor of explicit column selection
- Used prepared statements to leverage query plan caching

### 3. **Asynchronous Logging**
- Non-blocking validation log writes
- Batched inserts every 5 seconds or 100 records
- In-memory queue to prevent I/O blocking validation

### 4. **Connection Pooling**
- Configured PostgreSQL connection pool with optimal size
- Reused connections across requests
- Proper connection lifecycle management

## Monitoring Validation Logs

Check the async logging queue status:

```bash
curl http://localhost:3000/api/health
```

Response includes:
```json
{
  "status": "healthy",
  "validationLogQueueSize": 23
}
```

## Troubleshooting

### High Response Times (>100ms)

1. **Check database indexes**:
   ```sql
   SELECT schemaname, tablename, indexname 
   FROM pg_indexes 
   WHERE tablename IN ('coupons', 'coupon_usage');
   ```

2. **Analyze query performance**:
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM coupons WHERE code = 'USER-TEST123';
   ```

3. **Check connection pool**:
   - Increase `DB_MAX_CONNECTIONS` in `.env` if needed
   - Monitor active connections

### Seeding Issues

- **Out of memory**: Reduce batch size in `seed-performance-data.ts`
- **Connection timeout**: Check PostgreSQL `max_connections` setting
- **Slow inserts**: Temporarily disable indexes, then rebuild after seeding

## Architecture Notes

### Asynchronous Logging Flow

```
Validation Request
       ↓
  Validate Coupon (< 100ms)
       ↓
  Return Response
       ↓
  Add to Log Queue (non-blocking)
       ↓
  Queue flush (every 5s or 100 records)
       ↓
  Batch INSERT to validation_logs
```

This ensures validation response time is not affected by logging I/O.

## Performance Metrics

Target metrics for **1M users** and **5k coupons**:

| Metric | Target | Status |
|--------|--------|--------|
| Average Response Time | < 100ms | ✅ |
| P95 Response Time | < 100ms | ✅ |
| P99 Response Time | < 150ms | ✅ |
| Throughput | > 50 req/s | ✅ |
| Concurrent Users | 100+ | ✅ |

## Next Steps

1. **Stress Testing**: Increase concurrent requests to 500+
2. **Load Testing**: Run benchmark for 10,000+ requests
3. **Caching Layer**: Add Redis for frequently accessed coupons
4. **Rate Limiting**: Implement per-user rate limits
5. **CDN**: Deploy static assets through CDN
6. **Horizontal Scaling**: Test with multiple server instances

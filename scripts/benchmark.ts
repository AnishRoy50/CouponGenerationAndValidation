import axios from 'axios';
import { performance } from 'perf_hooks';

const API_URL = 'http://localhost:3000/api/coupons';
const CONCURRENT_REQUESTS = 100;
const TOTAL_REQUESTS = 1000;

interface BenchmarkResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  requestsPerSecond: number;
  totalDuration: number;
}

// Sample validation requests with random users and coupons
function generateValidationRequest() {
  const userIndex = Math.floor(Math.random() * 1_000_000);
  const couponIndex = Math.floor(Math.random() * 5000);
  const isUserCoupon = couponIndex < 2500;
  
  return {
    code: isUserCoupon ? `USER-${couponIndex}` : `TIME-${couponIndex}`,
    userId: `user_${String(userIndex).padStart(7, '0')}`,
    orderValue: Math.floor(Math.random() * 5000) + 500,
    orderId: `bench_order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  };
}

async function makeValidationRequest(): Promise<number> {
  const request = generateValidationRequest();
  const start = performance.now();
  
  try {
    await axios.post(`${API_URL}/validate`, request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return performance.now() - start;
  } catch (error: any) {
    // Still count response time even for validation failures (expected)
    return performance.now() - start;
  }
}

async function runBenchmark(): Promise<BenchmarkResult> {
  console.log(`\n🚀 Starting benchmark...`);
  console.log(`Total requests: ${TOTAL_REQUESTS}`);
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}\n`);

  const responseTimes: number[] = [];
  let successCount = 0;
  let failCount = 0;
  
  const startTime = performance.now();

  // Run requests in batches
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    const batch = Array(batchSize).fill(null).map(() => makeValidationRequest());
    
    try {
      const results = await Promise.allSettled(batch);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          responseTimes.push(result.value);
          successCount++;
        } else {
          failCount++;
        }
      });

      // Progress update
      const progress = ((i + batchSize) / TOTAL_REQUESTS * 100).toFixed(1);
      const avgTime = responseTimes.length > 0 
        ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2)
        : '0';
      process.stdout.write(`\rProgress: ${progress}% | Avg: ${avgTime}ms | Completed: ${i + batchSize}/${TOTAL_REQUESTS}`);
    } catch (error) {
      failCount += batchSize;
    }
  }

  const totalDuration = performance.now() - startTime;
  console.log('\n');

  // Calculate statistics
  responseTimes.sort((a, b) => a - b);
  
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const minResponseTime = responseTimes[0];
  const maxResponseTime = responseTimes[responseTimes.length - 1];
  
  const p50Index = Math.floor(responseTimes.length * 0.5);
  const p95Index = Math.floor(responseTimes.length * 0.95);
  const p99Index = Math.floor(responseTimes.length * 0.99);
  
  const p50 = responseTimes[p50Index];
  const p95 = responseTimes[p95Index];
  const p99 = responseTimes[p99Index];
  
  const requestsPerSecond = (TOTAL_REQUESTS / totalDuration) * 1000;

  return {
    totalRequests: TOTAL_REQUESTS,
    successfulRequests: successCount,
    failedRequests: failCount,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    p50,
    p95,
    p99,
    requestsPerSecond,
    totalDuration: totalDuration / 1000
  };
}

async function main() {
  console.log('📊 Coupon Validation Performance Benchmark\n');
  console.log('Warming up server...');
  
  // Warm-up requests
  try {
    await Promise.all([
      makeValidationRequest(),
      makeValidationRequest(),
      makeValidationRequest()
    ]);
    console.log('✓ Warm-up complete\n');
  } catch (error) {
    console.error('Failed to connect to server. Make sure it is running on', API_URL);
    process.exit(1);
  }

  // Run benchmark
  const results = await runBenchmark();

  // Display results
  console.log('═══════════════════════════════════════════════════════');
  console.log('                  BENCHMARK RESULTS                    ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Requests:        ${results.totalRequests.toLocaleString()}`);
  console.log(`Successful:            ${results.successfulRequests.toLocaleString()}`);
  console.log(`Failed:                ${results.failedRequests.toLocaleString()}`);
  console.log(`Total Duration:        ${results.totalDuration.toFixed(2)}s`);
  console.log('───────────────────────────────────────────────────────');
  console.log('Response Times:');
  console.log(`  Average:             ${results.avgResponseTime.toFixed(2)} ms`);
  console.log(`  Minimum:             ${results.minResponseTime.toFixed(2)} ms`);
  console.log(`  Maximum:             ${results.maxResponseTime.toFixed(2)} ms`);
  console.log(`  50th percentile:     ${results.p50.toFixed(2)} ms`);
  console.log(`  95th percentile:     ${results.p95.toFixed(2)} ms`);
  console.log(`  99th percentile:     ${results.p99.toFixed(2)} ms`);
  console.log('───────────────────────────────────────────────────────');
  console.log(`Throughput:            ${results.requestsPerSecond.toFixed(2)} req/s`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Performance assessment
  if (results.p95 < 100) {
    console.log('✅ EXCELLENT: 95th percentile response time < 100ms');
  } else if (results.p95 < 200) {
    console.log('⚠️  GOOD: 95th percentile response time < 200ms');
  } else {
    console.log('❌ NEEDS IMPROVEMENT: 95th percentile response time > 200ms');
  }

  if (results.avgResponseTime < 100) {
    console.log('✅ EXCELLENT: Average response time < 100ms\n');
  } else if (results.avgResponseTime < 200) {
    console.log('⚠️  GOOD: Average response time < 200ms\n');
  } else {
    console.log('❌ NEEDS IMPROVEMENT: Average response time > 200ms\n');
  }
}

main().catch(console.error);

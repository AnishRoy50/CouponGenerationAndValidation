import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 50, // Increased pool size for bulk inserts
});

// Generate random string for user IDs
function generateUserId(index: number): string {
  return `user_${String(index).padStart(7, '0')}`;
}

// Generate coupon code
function generateCouponCode(index: number, type: 'USER' | 'TIME'): string {
  const prefix = type === 'USER' ? 'USER' : 'TIME';
  const random = Math.random().toString(36).substring(2, 15).toUpperCase();
  return `${prefix}-${random}-${index}`;
}

// Generate random date within range
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedUsers(batchSize: number = 10000): Promise<number> {
  console.log('Seeding 1M users...');
  const totalUsers = 1_000_000;
  let inserted = 0;

  for (let i = 0; i < totalUsers; i += batchSize) {
    const values: string[] = [];
    const params: string[] = [];
    
    for (let j = 0; j < batchSize && (i + j) < totalUsers; j++) {
      const userId = generateUserId(i + j);
      const paramIndex = j + 1;
      params.push(`($${paramIndex})`);
      values.push(userId);
    }

    const query = `
      INSERT INTO users (id) VALUES ${params.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `;

    await pool.query(query, values);
    inserted += values.length;
    
    if (inserted % 100000 === 0) {
      console.log(`  Inserted ${inserted} users...`);
    }
  }

  console.log(`✓ Completed: ${inserted} users`);
  return inserted;
}

async function seedCoupons(): Promise<number> {
  console.log('Seeding 5k coupons (mixed status)...');
  const totalCoupons = 5000;
  const batchSize = 500;
  let inserted = 0;

  const now = new Date();
  const pastDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
  const futureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days ahead

  for (let i = 0; i < totalCoupons; i += batchSize) {
    // Split queries for user-specific and time-specific due to different column counts
    const userSpecificValues: any[] = [];
    const timeSpecificValues: any[] = [];
    const userSpecificPlaceholders: string[] = [];
    const timeSpecificPlaceholders: string[] = [];

    for (let j = 0; j < batchSize && (i + j) < totalCoupons; j++) {
      const couponIndex = i + j;
      const isUserSpecific = couponIndex < 2500;

      if (isUserSpecific) {
        const rand = Math.random();
        let status: string;
        if (rand < 0.60) status = 'active';
        else if (rand < 0.85) status = 'expired';
        else status = 'inactive';

        const code = generateCouponCode(couponIndex, 'USER');
        const userId = generateUserId(Math.floor(Math.random() * 1_000_000));
        const discountType = Math.random() > 0.5 ? 'percentage' : 'fixed';
        const discountValue = discountType === 'percentage' ? 
          Math.floor(Math.random() * 30) + 5 : 
          Math.floor(Math.random() * 500) + 50;

        const idx = userSpecificValues.length;
        userSpecificPlaceholders.push(`($${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10})`);
        userSpecificValues.push(
          code, 'user_specific', discountType, discountValue,
          discountType === 'percentage' ? Math.floor(Math.random() * 200) + 100 : null,
          Math.floor(Math.random() * 500) + 100,
          `User coupon ${couponIndex}`,
          userId, status, 'system'
        );
      } else {
        const rand = Math.random();
        let status: string, validFrom: Date, validUntil: Date;
        
        if (rand < 0.60) {
          status = 'active';
          validFrom = randomDate(pastDate, now);
          validUntil = randomDate(now, futureDate);
        } else if (rand < 0.85) {
          status = 'expired';
          validFrom = randomDate(new Date(pastDate.getTime() - 90 * 24 * 60 * 60 * 1000), pastDate);
          validUntil = randomDate(pastDate, new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000));
        } else {
          status = 'inactive';
          validFrom = randomDate(futureDate, new Date(futureDate.getTime() + 30 * 24 * 60 * 60 * 1000));
          validUntil = randomDate(validFrom, new Date(validFrom.getTime() + 60 * 24 * 60 * 60 * 1000));
        }

        const code = generateCouponCode(couponIndex, 'TIME');
        const discountType = Math.random() > 0.5 ? 'percentage' : 'fixed';
        const discountValue = discountType === 'percentage' ? 
          Math.floor(Math.random() * 40) + 10 : 
          Math.floor(Math.random() * 1000) + 100;
        const maxUses = Math.floor(Math.random() * 10000) + 1000;

        const idx = timeSpecificValues.length;
        timeSpecificPlaceholders.push(`($${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12})`);
        timeSpecificValues.push(
          code, 'time_specific', discountType, discountValue,
          discountType === 'percentage' ? Math.floor(Math.random() * 500) + 100 : null,
          Math.floor(Math.random() * 1000) + 200,
          `Time coupon ${couponIndex}`,
          status, 'system', validFrom, validUntil, maxUses
        );
      }
    }

    // Insert user-specific coupons
    if (userSpecificValues.length > 0) {
      const userQuery = `
        INSERT INTO coupons (
          code, type, discount_type, discount_value, max_discount_amount,
          min_order_value, description, user_id, status, created_by
        ) VALUES ${userSpecificPlaceholders.join(', ')}
        ON CONFLICT (code) DO NOTHING
      `;
      await pool.query(userQuery, userSpecificValues);
      inserted += userSpecificPlaceholders.length;
    }

    // Insert time-specific coupons
    if (timeSpecificValues.length > 0) {
      const timeQuery = `
        INSERT INTO coupons (
          code, type, discount_type, discount_value, max_discount_amount,
          min_order_value, description, status, created_by,
          valid_from, valid_until, max_total_uses
        ) VALUES ${timeSpecificPlaceholders.join(', ')}
        ON CONFLICT (code) DO NOTHING
      `;
      await pool.query(timeQuery, timeSpecificValues);
      inserted += timeSpecificPlaceholders.length;
    }

    if (inserted % 1000 === 0) {
      console.log(`  Inserted ${inserted} coupons...`);
    }
  }

  console.log(`✓ Completed: ${inserted} coupons`);
  return inserted;
}

async function seedCouponUsage(): Promise<number> {
  console.log('Seeding coupon usage records...');
  
  // Get active coupons
  const { rows: coupons } = await pool.query(`
    SELECT id, type, user_id FROM coupons 
    WHERE status = 'active' 
    LIMIT 1000
  `);

  let inserted = 0;
  const batchSize = 500;

  for (let i = 0; i < coupons.length; i += batchSize) {
    const batch = coupons.slice(i, i + batchSize);
    const values: any[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const coupon = batch[j];
      const usageCount = Math.floor(Math.random() * 5) + 1; // 1-5 uses per coupon

      for (let k = 0; k < usageCount; k++) {
        const userId = coupon.type === 'user_specific' ? 
          coupon.user_id : 
          generateUserId(Math.floor(Math.random() * 1_000_000));
        
        const orderValue = Math.floor(Math.random() * 5000) + 500;
        const discountApplied = Math.floor(Math.random() * 500) + 50;
        const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const idx = values.length;
        placeholders.push(`($${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5})`);
        values.push(coupon.id, userId, orderId, orderValue, discountApplied);
      }
    }

    if (values.length > 0) {
      // Use the partial unique index for conflict detection
      const query = `
        INSERT INTO coupon_usage (coupon_id, user_id, order_id, order_value, discount_applied)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING
      `;
      await pool.query(query, values);
      inserted += placeholders.length;
    }

    if (inserted % 1000 === 0) {
      console.log(`  Inserted ${inserted} usage records...`);
    }
  }

  console.log(`✓ Completed: ${inserted} usage records`);
  return inserted;
}

async function createUsersTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ Users table ready');
}

async function main() {
  console.log('🚀 Starting performance data seeding...\n');
  const startTime = Date.now();

  try {
    // Create users table
    await createUsersTable();

    // Seed data
    const userCount = await seedUsers();
    const couponCount = await seedCoupons();
    const usageCount = await seedCouponUsage();

    const duration = (Date.now() - startTime) / 1000;

    console.log('\n✅ Seeding completed successfully!');
    console.log('\nStatistics:');
    console.log(`  Users: ${userCount.toLocaleString()}`);
    console.log(`  Coupons: ${couponCount.toLocaleString()}`);
    console.log(`  Usage Records: ${usageCount.toLocaleString()}`);
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log(`  Rate: ${Math.floor((userCount + couponCount) / duration).toLocaleString()} records/sec`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

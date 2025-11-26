import { db } from '../index';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    await db.query(schemaSql);
    
    logger.info('Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
}

runMigrations();

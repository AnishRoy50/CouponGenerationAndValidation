import { Pool } from 'pg';
import { ValidationLog, ValidationLogQueue } from '../utils/validationLogQueue';
import { logger } from '../utils/logger';

export class ValidationLogService {
  private pool: Pool;
  private logQueue: ValidationLogQueue;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logQueue = new ValidationLogQueue(this.batchInsertLogs.bind(this));
  }


  public logValidationAttempt(log: ValidationLog): void {
  
    this.logQueue.add(log);
  }


  private async batchInsertLogs(logs: ValidationLog[]): Promise<void> {
    if (logs.length === 0) return;

    const client = await this.pool.connect();
    try {
      const values: any[] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const idx = i * 12;
        
        placeholders.push(
          `($${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12})`
        );

        values.push(
          log.couponCode,
          log.userId || null,
          log.orderId || null,
          log.orderValue || null,
          log.isValid,
          log.validationReason || null,
          log.discountApplied || null,
          log.finalAmount || null,
          log.ipAddress || null,
          log.userAgent || null,
          log.responseTimeMs || null,
          log.couponId || null
        );
      }

      const query = `
        INSERT INTO validation_logs (
          coupon_code, user_id, order_id, order_value, is_valid,
          validation_reason, discount_applied, final_amount,
          ip_address, user_agent, response_time_ms, coupon_id
        ) VALUES ${placeholders.join(', ')}
      `;

      await client.query(query, values);
      logger.info(`Flushed ${logs.length} validation logs to database`);
    } catch (error) {
      logger.error('Error inserting validation logs', { error, count: logs.length });
      throw error;
    } finally {
      client.release();
    }
  }


  public async getCouponValidationStats(couponCode: string): Promise<any> {
    const result = await this.pool.query(
      `
      SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN is_valid THEN 1 ELSE 0 END) as successful_validations,
        SUM(CASE WHEN is_valid THEN 0 ELSE 1 END) as failed_validations,
        AVG(response_time_ms) as avg_response_time_ms,
        MAX(response_time_ms) as max_response_time_ms,
        MIN(response_time_ms) as min_response_time_ms
      FROM validation_logs
      WHERE coupon_code = $1
      `,
      [couponCode]
    );

    return result.rows[0];
  }

  public async getRecentValidations(limit: number = 100): Promise<ValidationLog[]> {
    const result = await this.pool.query(
      `
      SELECT 
        coupon_code, user_id, order_id, order_value, is_valid,
        validation_reason, discount_applied, final_amount,
        ip_address, user_agent, validated_at, response_time_ms
      FROM validation_logs
      ORDER BY validated_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return result.rows;
  }

  public async shutdown(): Promise<void> {
    await this.logQueue.shutdown();
    logger.info('ValidationLogService shut down gracefully');
  }

  public getQueueSize(): number {
    return this.logQueue.getQueueSize();
  }
}

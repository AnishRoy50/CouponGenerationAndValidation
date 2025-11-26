export interface ValidationLog {
  couponCode: string;
  userId?: string;
  orderId?: string;
  orderValue?: number;
  isValid: boolean;
  validationReason?: string;
  discountApplied?: number;
  finalAmount?: number;
  ipAddress?: string;
  userAgent?: string;
  responseTimeMs?: number;
  couponId?: string;
}

export class ValidationLogQueue {
  private queue: ValidationLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
  private isProcessing = false;
  private flushCallback: (logs: ValidationLog[]) => Promise<void>;

  constructor(flushCallback: (logs: ValidationLog[]) => Promise<void>) {
    this.flushCallback = flushCallback;
    this.startAutoFlush();
  }

  /**
   * Add a validation log to the queue (non-blocking)
   */
  public add(log: ValidationLog): void {
    this.queue.push(log);

    // Auto-flush if batch size reached
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush().catch(err => {
        console.error('Error flushing validation logs:', err);
      });
    }
  }

  /**
   * Start automatic periodic flushing
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush().catch(err => {
          console.error('Error in auto-flush:', err);
        });
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Flush all queued logs to database
   */
  public async flush(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const logsToFlush = this.queue.splice(0, this.queue.length);

    try {
      await this.flushCallback(logsToFlush);
    } catch (error) {
      console.error('Failed to flush logs, re-queuing:', error);
      // Re-queue failed logs at the beginning
      this.queue.unshift(...logsToFlush);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Graceful shutdown - flush remaining logs
   */
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();
  }
}

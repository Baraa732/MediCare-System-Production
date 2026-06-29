import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedMessage } from '../entities/processed-message.entity';

/**
 * Fix 24: Kafka consumer idempotency service.
 * Ensures exactly-once processing by checking if a message has already been processed.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(ProcessedMessage)
    private processedMessageRepository: Repository<ProcessedMessage>,
  ) {}

  /**
   * Check if a message has already been processed.
   * Returns true if the message should be skipped (already processed).
   */
  async isProcessed(messageId: string, topic: string): Promise<boolean> {
    try {
      const existing = await this.processedMessageRepository.findOne({
        where: { messageId, topic },
      });
      return existing !== null;
    } catch (error: any) {
      this.logger.error(`Failed to check idempotency for ${topic}/${messageId}: ${error.message}`);
      // Fail open: if we can't check, assume not processed to avoid blocking
      return false;
    }
  }

  /**
   * Mark a message as processed after successful handling.
   */
  async markProcessed(messageId: string, topic: string): Promise<void> {
    try {
      await this.processedMessageRepository.save({
        messageId,
        topic,
      });
      this.logger.debug(`Marked message as processed: ${topic}/${messageId}`);
    } catch (error: any) {
      this.logger.error(`Failed to mark message as processed ${topic}/${messageId}: ${error.message}`);
      // Don't throw - idempotency failures shouldn't block the main flow
    }
  }

  /**
   * Cleanup old processed_messages records (called by cron job).
   * Delete records older than 30 days.
   */
  async cleanupOldRecords(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.processedMessageRepository
        .createQueryBuilder()
        .delete()
        .where('processedAt < :cutoffDate', { cutoffDate })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} old processed_messages records`);
    } catch (error: any) {
      this.logger.error(`Failed to cleanup old processed_messages: ${error.message}`);
    }
  }
}

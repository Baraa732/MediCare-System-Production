import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { SessionService } from '../services/session.service';
import { JwtBlocklistService } from '../services/jwt-blocklist.service';
import { Otp } from '../entities/otp.entity';
import { IdempotencyKey } from '../entities/idempotency-key.entity';

/**
 * Fixes 15, 16, 17, 18: Scheduled cleanup jobs for expired data.
 *
 * Fix 15: Hourly session cleanup — marks expired sessions as EXPIRED
 * Fix 16: Daily OTP cleanup — deletes expired OTP records
 * Fix 17: Daily idempotency key cleanup — deletes expired idempotency keys
 * Fix 18: Monthly audit log partition creation
 */
@Injectable()
export class CleanupTasks {
  private readonly logger = new Logger(CleanupTasks.name);

  constructor(
    private sessionService: SessionService,
    private jwtBlocklistService: JwtBlocklistService,
    @InjectRepository(Otp, 'authConnection')
    private otpRepository: Repository<Otp>,
    @InjectRepository(IdempotencyKey, 'authConnection')
    private idempotencyRepository: Repository<IdempotencyKey>,
    @InjectDataSource('authConnection')
    private dataSource: DataSource,
  ) {}

  /**
   * Fix 15: Run every hour at :00 — mark expired sessions as EXPIRED.
   * Previously this was only called via setInterval in main.ts (unreliable).
   */
  @Cron('0 * * * *')
  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.sessionService.cleanupExpiredSessions();
      this.logger.log('Expired sessions cleanup completed');
    } catch (err: any) {
      this.logger.error(`Session cleanup failed: ${err.message}`);
    }
  }

  /**
   * Fix 16: Run daily at midnight — delete expired OTP records.
   * Prevents unbounded growth of the otps table.
   */
  @Cron('0 0 * * *')
  async cleanupExpiredOtps(): Promise<void> {
    try {
      const result = await this.otpRepository
        .createQueryBuilder()
        .delete()
        .where('"expiresAt" < :now', { now: new Date() })
        .execute();
      this.logger.log(`Deleted ${result.affected} expired OTP records`);
    } catch (err: any) {
      this.logger.error(`OTP cleanup failed: ${err.message}`);
    }
  }

  /**
   * Fix 17: Run daily at midnight — delete expired idempotency keys.
   * Prevents unbounded growth of the idempotency_keys table.
   */
  @Cron('0 0 * * *')
  async cleanupExpiredIdempotencyKeys(): Promise<void> {
    try {
      const result = await this.idempotencyRepository
        .createQueryBuilder()
        .delete()
        .where('"expiresAt" < :now', { now: new Date() })
        .execute();
      this.logger.log(`Deleted ${result.affected} expired idempotency keys`);
    } catch (err: any) {
      this.logger.error(`Idempotency key cleanup failed: ${err.message}`);
    }
  }

  /**
   * Fix 5 + cleanup: Run daily at midnight — delete expired JWT blocklist entries.
   */
  @Cron('0 0 * * *')
  async cleanupExpiredJwtBlocklist(): Promise<void> {
    await this.jwtBlocklistService.cleanupExpired();
  }

  /**
   * Fix 18: Run on the 1st of each month at midnight — create next month's audit_logs partition.
   * Ensures the partition exists before the month starts.
   */
  @Cron('0 0 1 * *')
  async createNextMonthPartition(): Promise<void> {
    try {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      const year  = next.getFullYear();
      const month = next.getMonth() + 1; // 1-indexed
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 1); // first day of month after next
      const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
      const name = `audit_logs_${year}_${String(month).padStart(2, '0')}`;

      await this.dataSource.query(
        `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF audit_logs
         FOR VALUES FROM ('${start}') TO ('${end}')`,
      );
      this.logger.log(`Created audit_logs partition: ${name} (${start} to ${end})`);
    } catch (err: any) {
      this.logger.error(`Failed to create audit_logs partition: ${err.message}`);
    }
  }
}

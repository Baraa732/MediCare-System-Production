import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TrustedDevice } from '../entities/trusted-device.entity';

type DeviceInfo = {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  browserFingerprint?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
};

@Injectable()
export class TrustedDeviceService {
  private readonly logger = new Logger(TrustedDeviceService.name);

  constructor(
    @InjectRepository(TrustedDevice, 'authConnection')
    private trustedDeviceRepository: Repository<TrustedDevice>,
  ) {}

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private normalize(value?: string): string {
    return (value || '').trim();
  }

  // Prefer explicit stable IDs (deviceId / browserFingerprint) over UA.
  private buildDeviceHash(userId: string, deviceInfo?: DeviceInfo): string | null {
    if (!deviceInfo) return null;
    const deviceId = this.normalize(deviceInfo.deviceId);
    const fingerprint = this.normalize(deviceInfo.browserFingerprint);
    const userAgent = this.normalize(deviceInfo.userAgent);

    if (deviceId) return this.sha256(`${userId}|did|${deviceId}`);
    if (fingerprint) return this.sha256(`${userId}|fp|${fingerprint}`);
    if (userAgent) return this.sha256(`${userId}|ua|${userAgent}`);
    return null;
  }

  async isTrustedDevice(userId: string, deviceInfo?: DeviceInfo): Promise<boolean> {
    const deviceHash = this.buildDeviceHash(userId, deviceInfo);
    if (!deviceHash) return false;

    const now = new Date();
    const trusted = await this.trustedDeviceRepository
      .createQueryBuilder('td')
      .where('td.userId = :userId', { userId })
      .andWhere('td.deviceHash = :deviceHash', { deviceHash })
      .andWhere('td.revokedAt IS NULL')
      .andWhere('(td.expiresAt IS NULL OR td.expiresAt > :now)', { now })
      .getOne();

    if (!trusted) return false;

    trusted.lastUsedAt = now;
    await this.trustedDeviceRepository.save(trusted);
    return true;
  }

  async trustDevice(userId: string, deviceInfo?: DeviceInfo, ttlDays = 90): Promise<void> {
    const deviceHash = this.buildDeviceHash(userId, deviceInfo);
    if (!deviceHash) return;

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    const deviceId = this.normalize(deviceInfo?.deviceId);
    const browserFingerprint = this.normalize(deviceInfo?.browserFingerprint);
    const userAgent = this.normalize(deviceInfo?.userAgent);
    const label = [deviceInfo?.deviceType, deviceInfo?.browser, deviceInfo?.os].filter(Boolean).join(' / ') || null;

    await this.trustedDeviceRepository
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        deviceHash,
        deviceLabel: label,
        metadata: {
          userAgent: userAgent || undefined,
          deviceIdHash: deviceId ? this.sha256(deviceId) : undefined,
          browserFingerprintHash: browserFingerprint ? this.sha256(browserFingerprint) : undefined,
          ip: this.normalize(deviceInfo?.ip) || undefined,
          deviceType: deviceInfo?.deviceType,
          browser: deviceInfo?.browser,
          os: deviceInfo?.os,
        },
        expiresAt,
        revokedAt: null,
        lastUsedAt: now,
      })
      .orUpdate(
        ['deviceLabel', 'metadata', 'expiresAt', 'revokedAt', 'lastUsedAt', 'updatedAt'],
        ['userId', 'deviceHash'],
      )
      .execute();

    this.logger.log(`Trusted device upserted for user ${userId}`);
  }

  async revokeByUserId(userId: string): Promise<void> {
    await this.trustedDeviceRepository
      .createQueryBuilder()
      .update(TrustedDevice)
      .set({ revokedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL')
      .execute();
  }
}

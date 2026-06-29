import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { createHash } from 'crypto';

export enum OtpType {
  PHONE_VERIFICATION = 'phone_verification',
  PASSWORD_RESET = 'password_reset',
  LOGIN_VERIFICATION = 'login_verification',
}

@Entity('otps')
@Index(['phoneNumber', 'type', 'isUsed'])
@Index(['expiresAt'])
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // SHA-256(rawOtp + ':' + phoneNumber + ':' + type)
  // Raw OTP is NEVER stored — a DB breach cannot expose active codes.
  @Column({ name: 'code_hash' })
  codeHash: string;

  @Column()
  phoneNumber: string;

  @Column({ type: 'enum', enum: OtpType, default: OtpType.PHONE_VERIFICATION })
  type: OtpType;

  @Column({ default: false })
  isUsed: boolean;

  // Invalidate OTP after 5 wrong guesses — prevents brute force even without
  // the rate-limit layer (defence in depth).
  @Column({ default: 0 })
  failedAttempts: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  /**
   * Deterministic hash used for both storage and verification.
   * Includes phoneNumber + type as salt so the same OTP code for a different
   * phone or purpose produces a completely different hash.
   */
  static hashCode(code: string, phoneNumber: string, type: OtpType): string {
    return createHash('sha256')
      .update(`${code}:${phoneNumber}:${type}`)
      .digest('hex');
  }
}

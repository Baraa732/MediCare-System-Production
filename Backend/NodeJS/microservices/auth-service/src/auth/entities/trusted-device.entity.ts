import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('trusted_devices')
@Index(['userId'])
@Index(['userId', 'deviceHash'], { unique: true })
@Index(['expiresAt'])
export class TrustedDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ length: 128 })
  deviceHash: string;

  @Column({ nullable: true, length: 128 })
  deviceLabel: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    userAgent?: string;
    deviceIdHash?: string;
    browserFingerprintHash?: string;
    ip?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
  } | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

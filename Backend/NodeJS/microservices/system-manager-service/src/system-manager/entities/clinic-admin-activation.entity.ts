import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ActivationCodeStatus {
  PENDING = 'pending',
  USED = 'used',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

@Entity('clinic_admin_activation_codes')
export class ClinicAdminActivation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  idNumber: string;

  @Column()
  phoneNumber: string;

  @Column()
  fullName: string;

  @Column({
    type: 'enum',
    enum: ActivationCodeStatus,
    default: ActivationCodeStatus.PENDING
  })
  status: ActivationCodeStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ nullable: true })
  generatedBy: string; // System Manager ID who generated the code

  @Column()
  clinicLocation: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: false })
  isCashPaymentDone: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    notes?: string;
  };

  @Column({ default: 0 })
  attemptCount: number; // Track failed validation attempts

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date; // When the clinic admin dashboard was activated
}

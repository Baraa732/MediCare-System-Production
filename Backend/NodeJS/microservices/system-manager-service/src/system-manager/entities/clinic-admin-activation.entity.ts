import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ClinicType } from '../enums/clinic-activation.enums';
import type { ActivationDocumentsMap } from '../types/activation-documents.types';

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
  generatedBy: string;

  @Column()
  clinicLocation: string;

  @Column({ type: 'enum', enum: ClinicType, enumName: 'clinic_type_enum', default: ClinicType.PRIVATE_CLINIC })
  clinicType: ClinicType;

  @Column({ default: '' })
  registrationLicenseNumber: string;

  @Column({ type: 'date', nullable: true })
  establishmentDate: Date | null;

  @Column({ type: 'simple-array', nullable: true })
  specialties: string[];

  @Column({ default: '' })
  whatsappNumber: string;

  @Column({ nullable: true })
  email: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'int', nullable: true })
  yearsOfExperience: number | null;

  @Column({ type: 'jsonb', nullable: true })
  documents: ActivationDocumentsMap | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'int', default: 5 })
  serviceRadiusKm: number;

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
  attemptCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date;
}

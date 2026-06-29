import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_account_links')
@Index(['systemManagerId', 'userId', 'linkType'], { unique: true })
export class UserAccountLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  systemManagerId: string;

  @Column()
  userId: string;

  @Column()
  linkType: string; // 'PATIENT', 'DOCTOR', 'CLINIC_ADMIN', etc.

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

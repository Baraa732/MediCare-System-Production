import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('push_device_tokens')
@Index(['tenantId', 'userId', 'enabled'])
@Index(['tenantId', 'createdAt'])
export class PushDeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column('uuid')
  userId: string;

  @Column({ type: 'text' })
  fcmToken: string;

  @Column({ default: 'web' })
  platform: string;

  @Column({ nullable: true })
  deviceLabel: string;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastSeenAt: Date;
}

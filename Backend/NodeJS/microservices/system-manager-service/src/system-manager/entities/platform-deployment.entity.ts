import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type PlatformDeploymentStatus = 'Success' | 'Failed' | 'Rolled back' | 'In progress';

@Entity('platform_deployments')
export class PlatformDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  service: string;

  @Column({ nullable: true })
  version: string | null;

  @Column({ type: 'varchar', length: 32, default: 'Success' })
  status: PlatformDeploymentStatus;

  @Column({ nullable: true })
  actor: string | null;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'varchar', length: 32, default: 'api' })
  source: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

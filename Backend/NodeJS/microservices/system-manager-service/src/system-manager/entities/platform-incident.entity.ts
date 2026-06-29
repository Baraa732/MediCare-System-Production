import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PlatformIncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'assigned'
  | 'resolved'
  | 'escalated';

@Entity('platform_incidents')
export class PlatformIncident {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  title: string | null;

  @Column({ nullable: true })
  service: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'open',
  })
  status: PlatformIncidentStatus;

  @Column({ nullable: true })
  assignee: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

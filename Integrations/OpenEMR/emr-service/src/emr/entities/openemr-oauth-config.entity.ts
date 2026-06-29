import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('openemr_oauth_config')
@Index('uq_openemr_oauth_config_tenant', ['tenantId'], { unique: true, where: '"tenant_id" IS NOT NULL' })
export class OpenEmrOAuthConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 255 })
  clientId: string;

  @Column({ type: 'varchar', length: 512 })
  clientSecret: string;

  @CreateDateColumn()
  registeredAt: Date;
}

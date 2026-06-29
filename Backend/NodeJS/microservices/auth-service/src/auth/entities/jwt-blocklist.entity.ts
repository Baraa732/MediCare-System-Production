import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Fix 5: PostgreSQL fallback for JWT revocation.
 * Written on every addToBlocklist() (dual-write with Redis).
 * Read only when Redis is unavailable.
 */
@Entity('jwt_blocklist')
export class JwtBlocklistEntry {
  @PrimaryColumn({ length: 36 })
  jti: string;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

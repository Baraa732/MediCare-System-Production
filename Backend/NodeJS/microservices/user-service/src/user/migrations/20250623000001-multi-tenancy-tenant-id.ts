import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiTenancyUserTenantId20250623000001 implements MigrationInterface {
  name = 'MultiTenancyUserTenantId20250623000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'clinicId')) {
      await queryRunner.query(`ALTER TABLE users RENAME COLUMN "clinicId" TO tenant_id`);
    } else if (!(await queryRunner.hasColumn('users', 'tenant_id'))) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN tenant_id UUID`);
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_users_tenant_status ON users(tenant_id, status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE users RENAME COLUMN tenant_id TO "clinicId"`);
    }
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

async function renameColumnIfNeeded(
  queryRunner: QueryRunner,
  table: string,
  from: string,
  to: string,
): Promise<void> {
  if (await queryRunner.hasColumn(table, from) && !(await queryRunner.hasColumn(table, to))) {
    await queryRunner.query(`ALTER TABLE ${table} RENAME COLUMN "${from}" TO ${to}`);
  }
}

async function convertEnumColumnIfNeeded(
  queryRunner: QueryRunner,
  table: string,
  column: string,
  varcharLen: number,
): Promise<void> {
  const colInfo = await queryRunner.query(
    `
    SELECT udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
  `,
    [table, column],
  );
  const udt = colInfo[0]?.udt_name as string | undefined;
  if (udt?.endsWith('_enum')) {
    await queryRunner.query(
      `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE varchar(${varcharLen}) USING ${column}::text`,
    );
  }
}

/**
 * Migrates clinic-centric schema to tenant-centric multi-tenancy.
 * Handles legacy camelCase columns created by earlier TypeORM synchronize runs.
 */
export class MultiTenancyTenants20250623000001 implements MigrationInterface {
  name = 'MultiTenancyTenants20250623000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasClinics = await queryRunner.hasTable('clinics');
    const hasTenants = await queryRunner.hasTable('tenants');

    if (hasClinics && !hasTenants) {
      await queryRunner.query(`ALTER TABLE clinics RENAME TO tenants`);
    }

    if (!(await queryRunner.hasTable('tenants'))) {
      await queryRunner.query(`
        CREATE TABLE tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(200) NOT NULL,
          slug VARCHAR(100) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          subscription_plan VARCHAR(50) NOT NULL DEFAULT 'standard',
          description TEXT,
          address VARCHAR(300),
          city VARCHAR(100),
          governorate VARCHAR(100),
          phone VARCHAR(30),
          email VARCHAR(200),
          timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Damascus',
          activation_code_id UUID UNIQUE,
          admin_phone_number VARCHAR(20) UNIQUE,
          admin_user_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    } else {
      await renameColumnIfNeeded(queryRunner, 'tenants', 'createdAt', 'created_at');
      await renameColumnIfNeeded(queryRunner, 'tenants', 'updatedAt', 'updated_at');
      await renameColumnIfNeeded(queryRunner, 'tenants', 'activationCodeId', 'activation_code_id');
      await renameColumnIfNeeded(queryRunner, 'tenants', 'adminPhoneNumber', 'admin_phone_number');
      await renameColumnIfNeeded(queryRunner, 'tenants', 'adminUserId', 'admin_user_id');

      if (!(await queryRunner.hasColumn('tenants', 'slug'))) {
        await queryRunner.query(`ALTER TABLE tenants ADD COLUMN slug VARCHAR(100)`);
      }

      await queryRunner.query(`
        UPDATE tenants
        SET slug = LOWER(REGEXP_REPLACE(COALESCE(name, id::text), '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE slug IS NULL OR slug = ''
      `);

      if (await queryRunner.hasColumn('tenants', 'slug')) {
        await queryRunner.query(`
          ALTER TABLE tenants ALTER COLUMN slug SET NOT NULL
        `).catch(() => undefined);
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)
        `);
      }

      if (!(await queryRunner.hasColumn('tenants', 'subscription_plan'))) {
        await queryRunner.query(`
          ALTER TABLE tenants ADD COLUMN subscription_plan VARCHAR(50) NOT NULL DEFAULT 'standard'
        `);
      }

      await convertEnumColumnIfNeeded(queryRunner, 'tenants', 'status', 20);

      await queryRunner.query(`
        UPDATE tenants SET status = 'SUSPENDED'
        WHERE status IN ('INACTIVE', 'ARCHIVED')
      `);
    }

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status)`);
    if (await queryRunner.hasColumn('tenants', 'created_at')) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at)`,
      );
    }

    const hasOldAssignments = await queryRunner.hasTable('clinic_staff_assignments');
    const hasNewAssignments = await queryRunner.hasTable('tenant_staff_assignments');

    if (hasOldAssignments && !hasNewAssignments) {
      await queryRunner.query(`ALTER TABLE clinic_staff_assignments RENAME TO tenant_staff_assignments`);
      if (await queryRunner.hasColumn('tenant_staff_assignments', 'clinic_id')) {
        await queryRunner.query(
          `ALTER TABLE tenant_staff_assignments RENAME COLUMN clinic_id TO tenant_id`,
        );
      } else if (await queryRunner.hasColumn('tenant_staff_assignments', 'clinicId')) {
        await queryRunner.query(
          `ALTER TABLE tenant_staff_assignments RENAME COLUMN "clinicId" TO tenant_id`,
        );
      }
    }

    if (!(await queryRunner.hasTable('tenant_staff_assignments'))) {
      await queryRunner.query(`
        CREATE TABLE tenant_staff_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          staff_role VARCHAR(32) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          assigned_by UUID,
          assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, user_id)
        )
      `);
    } else {
      await renameColumnIfNeeded(queryRunner, 'tenant_staff_assignments', 'userId', 'user_id');
      await renameColumnIfNeeded(queryRunner, 'tenant_staff_assignments', 'staffRole', 'staff_role');
      await renameColumnIfNeeded(queryRunner, 'tenant_staff_assignments', 'assignedBy', 'assigned_by');
      await renameColumnIfNeeded(queryRunner, 'tenant_staff_assignments', 'assignedAt', 'assigned_at');
      await renameColumnIfNeeded(queryRunner, 'tenant_staff_assignments', 'updatedAt', 'updated_at');
      await convertEnumColumnIfNeeded(queryRunner, 'tenant_staff_assignments', 'staff_role', 32);
      await convertEnumColumnIfNeeded(queryRunner, 'tenant_staff_assignments', 'status', 20);
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tsa_tenant_id ON tenant_staff_assignments(tenant_id)`,
    );
    if (await queryRunner.hasColumn('tenant_staff_assignments', 'user_id')) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_tsa_user_status ON tenant_staff_assignments(user_id, status)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('tenant_staff_assignments')) {
      if (await queryRunner.hasColumn('tenant_staff_assignments', 'tenant_id')) {
        await queryRunner.query(`
          ALTER TABLE tenant_staff_assignments RENAME COLUMN tenant_id TO "clinicId"
        `);
      }
      await queryRunner.query(`ALTER TABLE tenant_staff_assignments RENAME TO clinic_staff_assignments`);
    }
    if (await queryRunner.hasTable('tenants')) {
      await queryRunner.query(`ALTER TABLE tenants RENAME TO clinics`);
    }
  }
}

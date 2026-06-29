import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cleans up artifacts from failed TypeORM synchronize attempts and legacy table duplicates
 * that cause "relation PK_... already exists" on startup.
 */
export class RepairClinicSchemaSync20250625000001 implements MigrationInterface {
  name = 'RepairClinicSchemaSync20250625000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT c.relname
          FROM pg_class c
          LEFT JOIN pg_constraint con ON con.conindid = c.oid
          WHERE c.relname LIKE 'PK_%'
            AND c.relkind IN ('i', 'I')
            AND con.oid IS NULL
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', r.relname);
        END LOOP;
      END $$;
    `);

    const hasClinics = await queryRunner.hasTable('clinics');
    const hasTenants = await queryRunner.hasTable('tenants');
    if (hasClinics && hasTenants) {
      const [{ count: clinicRows }] = await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM clinics`,
      );
      const [{ count: tenantRows }] = await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM tenants`,
      );
      if (clinicRows === 0 && tenantRows > 0) {
        await queryRunner.query(`DROP TABLE IF EXISTS clinics CASCADE`);
      } else if (tenantRows === 0 && clinicRows > 0) {
        await queryRunner.query(`ALTER TABLE clinics RENAME TO tenants`);
      }
    }

    const hasOldAssignments = await queryRunner.hasTable('clinic_staff_assignments');
    const hasNewAssignments = await queryRunner.hasTable('tenant_staff_assignments');
    if (hasOldAssignments && hasNewAssignments) {
      const [{ count: oldRows }] = await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM clinic_staff_assignments`,
      );
      if (oldRows === 0) {
        await queryRunner.query(`DROP TABLE IF EXISTS clinic_staff_assignments CASCADE`);
      }
    }

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

    if (await queryRunner.hasTable('tenant_staff_assignments')) {
      if (!(await queryRunner.hasColumn('tenant_staff_assignments', 'tenant_id'))) {
        if (await queryRunner.hasColumn('tenant_staff_assignments', 'clinic_id')) {
          await queryRunner.query(
            `ALTER TABLE tenant_staff_assignments RENAME COLUMN clinic_id TO tenant_id`,
          );
        }
      }

      for (const col of ['staff_role', 'status']) {
        const colInfo = await queryRunner.query(
          `
          SELECT udt_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenant_staff_assignments'
            AND column_name = $1
          LIMIT 1
        `,
          [col],
        );
        const udt = colInfo[0]?.udt_name as string | undefined;
        if (udt?.endsWith('_enum')) {
          const len = col === 'staff_role' ? 32 : 20;
          await queryRunner.query(
            `ALTER TABLE tenant_staff_assignments ALTER COLUMN ${col} TYPE varchar(${len}) USING ${col}::text`,
          );
        }
      }
    }
  }

  public async down(): Promise<void> {}
}

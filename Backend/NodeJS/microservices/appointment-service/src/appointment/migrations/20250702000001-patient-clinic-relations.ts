import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientClinicRelations20250702000001 implements MigrationInterface {
  name = 'PatientClinicRelations20250702000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS patient_clinic_relations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_patient_clinic_relations_patient_tenant UNIQUE (patient_id, tenant_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_clinic_relations_patient
      ON patient_clinic_relations (patient_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_clinic_relations_tenant
      ON patient_clinic_relations (tenant_id)
    `);

    await queryRunner.query(`
      INSERT INTO patient_clinic_relations (patient_id, tenant_id, first_seen_at, last_seen_at)
      SELECT DISTINCT "patientId", tenant_id, MIN("createdAt"), MAX("updatedAt")
      FROM appointments
      GROUP BY "patientId", tenant_id
      ON CONFLICT (patient_id, tenant_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS patient_clinic_relations`);
  }
}

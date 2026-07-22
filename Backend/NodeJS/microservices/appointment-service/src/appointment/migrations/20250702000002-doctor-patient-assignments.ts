import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorPatientAssignments20250702000002 implements MigrationInterface {
  name = 'DoctorPatientAssignments20250702000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        doctor_id UUID NOT NULL,
        patient_id UUID NOT NULL,
        assigned_by UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_doctor_patient_assignments_tenant_doctor_patient
          UNIQUE (tenant_id, doctor_id, patient_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_doctor_patient_assignments_tenant_doctor
      ON doctor_patient_assignments (tenant_id, doctor_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_doctor_patient_assignments_tenant_patient
      ON doctor_patient_assignments (tenant_id, patient_id)
    `);

    await queryRunner.query(`
      INSERT INTO doctor_patient_assignments (
        tenant_id, doctor_id, patient_id, assigned_by, status, assigned_at, created_at, updated_at
      )
      SELECT DISTINCT
        tenant_id,
        "doctorId",
        "patientId",
        "createdBy",
        'ACTIVE',
        MIN("createdAt"),
        MIN("createdAt"),
        MAX("updatedAt")
      FROM appointments
      GROUP BY tenant_id, "doctorId", "patientId", "createdBy"
      ON CONFLICT (tenant_id, doctor_id, patient_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS doctor_patient_assignments`);
  }
}

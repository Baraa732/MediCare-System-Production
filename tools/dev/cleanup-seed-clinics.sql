DELETE FROM clinic_staff_assignments WHERE "clinicId" IN (
  SELECT id FROM clinics WHERE "adminPhoneNumber" LIKE '+96399900%'
);
DELETE FROM clinics WHERE "adminPhoneNumber" LIKE '+96399900%';

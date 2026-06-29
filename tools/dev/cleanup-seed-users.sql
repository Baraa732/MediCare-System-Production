-- Remove demo seed data (+96399900XXXX phones) for a clean re-run.
DELETE FROM password_history WHERE user_id IN (SELECT id FROM users WHERE "phoneNumber" LIKE '+96399900%');
DELETE FROM users WHERE "phoneNumber" LIKE '+96399900%';

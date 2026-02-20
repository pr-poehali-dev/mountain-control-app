
UPDATE users SET is_active = false WHERE id != 6;

UPDATE users SET
  position = 'Начальник отдела ОТ и ПБ',
  department = 'Рудник Бадран',
  role = 'admin',
  personal_code = 'АД-001',
  qr_code = 'QR-AD-001'
WHERE id = 6;

UPDATE personnel SET status = 'archived' WHERE 1=1;

INSERT INTO personnel (personal_code, full_name, position, department, category, phone, room, status, qr_code, medical_status, shift)
VALUES ('АД-001', 'Шнюков Константин Анатольевич', 'Начальник отдела ОТ и ПБ', 'Рудник Бадран', 'mine', '', NULL, 'arrived', 'QR-AD-001', 'passed', NULL);

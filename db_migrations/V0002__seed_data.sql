
INSERT INTO users (email, password_hash, full_name, position, department, personal_code, qr_code, role) VALUES
('admin@rudnik.ru', '$2b$12$LJ3m4ks9Yqz8N5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5', 'Орлов Максим Константинович', 'Системный администратор', 'ИТ', 'ADM-001', 'QR-ADM-001', 'admin'),
('gromov@rudnik.ru', '$2b$12$LJ3m4ks9Yqz8N5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5', 'Громов Павел Романович', 'Старший диспетчер', 'Диспетчерская', 'ДС-001', 'QR-DS-001', 'dispatcher'),
('smirnova@rudnik.ru', '$2b$12$LJ3m4ks9Yqz8N5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5', 'Смирнова Елена Викторовна', 'Врач', 'Медпункт', 'МД-001', 'QR-MD-001', 'doctor'),
('operator@rudnik.ru', '$2b$12$LJ3m4ks9Yqz8N5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5e0X5', 'Борисов Николай Леонидович', 'Оператор КПП', 'КПП', 'ОП-001', 'QR-OP-001', 'operator');

INSERT INTO personnel (personal_code, full_name, position, department, category, phone, room, status, qr_code, medical_status, shift) VALUES
('МК-001', 'Иванов Алексей Сергеевич', 'Горнорабочий', 'Участок №3', 'mine', '+79001112233', '301', 'on_shift', 'QR-MK-001', 'passed', 'A'),
('МК-002', 'Петров Виталий Иванович', 'Электрослесарь', 'Участок №1', 'mine', '+79002223344', '215', 'on_shift', 'QR-MK-002', 'passed', 'A'),
('МК-003', 'Сидоров Кирилл Николаевич', 'Маркшейдер', 'Геология', 'business_trip', '+79003334455', '108', 'arrived', 'QR-MK-003', 'failed', 'A'),
('МК-004', 'Козлов Дмитрий Михайлович', 'Монтажник', 'СтройМонтаж', 'contractor', '+79004445566', '412', 'business_trip', 'QR-MK-004', 'passed', 'A'),
('МК-005', 'Николаев Евгений Петрович', 'Взрывник', 'Участок №2', 'mine', '+79005556677', '205', 'departed', 'QR-MK-005', 'passed', 'A'),
('МК-006', 'Фёдоров Геннадий Андреевич', 'Механик', 'Мех.цех', 'mine', '+79006667788', '312', 'on_shift', 'QR-MK-006', 'expiring', 'A'),
('МК-007', 'Волков Артём Павлович', 'Проходчик', 'Участок №1', 'mine', '+79007778899', '303', 'on_shift', 'QR-MK-007', 'passed', 'A'),
('МК-008', 'Морозов Сергей Дмитриевич', 'Инженер ОТ', 'ОТиПБ', 'mine', '+79008889900', '107', 'on_shift', 'QR-MK-008', 'passed', 'A'),
('МК-009', 'Лебедев Игорь Валерьевич', 'Геолог', 'Геология', 'guest', '+79009990011', NULL, 'arrived', 'QR-MK-009', 'pending', NULL),
('МК-010', 'Кузнецов Андрей Владимирович', 'Крепильщик', 'Участок №2', 'mine', '+79001010101', '204', 'on_shift', 'QR-MK-010', 'passed', 'A'),
('МК-011', 'Соколов Владимир Петрович', 'Машинист ПДМ', 'Участок №3', 'mine', '+79001111111', '302', 'on_shift', 'QR-MK-011', 'passed', 'A'),
('МК-012', 'Попов Денис Александрович', 'Электромонтёр', 'Энергоцех', 'mine', '+79001212121', '118', 'on_shift', 'QR-MK-012', 'passed', 'A'),
('МК-013', 'Новиков Руслан Олегович', 'Сварщик', 'СтройМонтаж', 'contractor', '+79001313131', '415', 'on_shift', 'QR-MK-013', 'passed', 'A'),
('МК-014', 'Семёнов Игорь Викторович', 'Слесарь', 'Мех.цех', 'mine', '+79001414141', '311', 'arrived', 'QR-MK-014', 'pending', 'B'),
('МК-015', 'Голубев Тимур Рашидович', 'Инженер-геолог', 'Геология', 'business_trip', '+79001515151', '109', 'arrived', 'QR-MK-015', 'passed', NULL);

INSERT INTO rooms (room_number, building, capacity, occupied, status) VALUES
('101', 'Общежитие №1', 2, 0, 'available'),
('107', 'Общежитие №1', 2, 1, 'occupied'),
('108', 'Общежитие №1', 2, 1, 'occupied'),
('109', 'Общежитие №1', 2, 1, 'occupied'),
('118', 'Общежитие №1', 2, 1, 'occupied'),
('204', 'Общежитие №2', 2, 1, 'occupied'),
('205', 'Общежитие №2', 2, 0, 'available'),
('215', 'Общежитие №2', 2, 1, 'occupied'),
('301', 'Общежитие №3', 2, 1, 'occupied'),
('302', 'Общежитие №3', 2, 1, 'occupied'),
('303', 'Общежитие №3', 2, 1, 'occupied'),
('311', 'Общежитие №3', 2, 1, 'occupied'),
('312', 'Общежитие №3', 2, 1, 'occupied'),
('412', 'Общежитие №4', 2, 1, 'occupied'),
('415', 'Общежитие №4', 2, 1, 'occupied');

INSERT INTO lanterns (lantern_number, rescuer_number, status, assigned_to, issued_at) VALUES
('Ф-001', 'СС-001', 'issued', 1, NOW()),
('Ф-012', 'СС-012', 'issued', 2, NOW()),
('Ф-023', 'СС-023', 'issued', 7, NOW()),
('Ф-033', 'СС-033', 'issued', 6, NOW()),
('Ф-044', 'СС-044', 'issued', 10, NOW()),
('Ф-055', 'СС-055', 'issued', 11, NOW()),
('Ф-066', 'СС-066', 'issued', 12, NOW()),
('Ф-077', 'СС-077', 'issued', 13, NOW()),
('Ф-089', 'СС-089', 'charging', NULL, NULL),
('Ф-090', 'СС-090', 'available', NULL, NULL),
('Ф-091', 'СС-091', 'available', NULL, NULL),
('Ф-147', 'СС-147', 'missing', NULL, NULL);

INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, checked_at) VALUES
(1, 'pre_shift', 'passed', '120/80', 72, 0.00, 36.6, 'Смирнова Е.В.', NOW() - INTERVAL '18 minutes'),
(2, 'pre_shift', 'passed', '130/85', 78, 0.00, 36.4, 'Смирнова Е.В.', NOW() - INTERVAL '22 minutes'),
(3, 'pre_shift', 'failed', '155/95', 92, 0.12, 37.2, 'Смирнова Е.В.', NOW() - INTERVAL '25 minutes'),
(6, 'pre_shift', 'passed', '125/82', 68, 0.00, 36.5, 'Козлова И.А.', NOW() - INTERVAL '30 minutes'),
(7, 'pre_shift', 'passed', '118/76', 65, 0.00, 36.7, 'Козлова И.А.', NOW() - INTERVAL '35 minutes'),
(10, 'pre_shift', 'passed', '122/78', 70, 0.00, 36.5, 'Смирнова Е.В.', NOW() - INTERVAL '40 minutes'),
(11, 'pre_shift', 'passed', '128/82', 74, 0.00, 36.6, 'Козлова И.А.', NOW() - INTERVAL '45 minutes'),
(12, 'pre_shift', 'passed', '115/75', 66, 0.00, 36.4, 'Козлова И.А.', NOW() - INTERVAL '50 minutes'),
(13, 'pre_shift', 'passed', '132/86', 80, 0.00, 36.8, 'Смирнова Е.В.', NOW() - INTERVAL '55 minutes');

INSERT INTO events (event_type, description, personnel_id, created_at) VALUES
('medical_pass', 'Иванов А.С. — прошёл медосмотр', 1, NOW() - INTERVAL '18 minutes'),
('lantern_issued', 'Фонарь Ф-012 — выдан Петрову В.И.', 2, NOW() - INTERVAL '22 minutes'),
('arrival', 'Козлов Д.М. — прибыл (командировка)', 4, NOW() - INTERVAL '25 minutes'),
('shift_start', 'Смена А — начало (10 человек)', NULL, NOW() - INTERVAL '30 minutes'),
('medical_fail', 'Сидоров К.Н. — не прошёл медосмотр', 3, NOW() - INTERVAL '35 minutes'),
('departure', 'Николаев Е.П. — убыл с объекта', 5, NOW() - INTERVAL '40 minutes'),
('room_checkin', 'Комната 312 — заселение Фёдоров Г.А.', 6, NOW() - INTERVAL '45 minutes'),
('lantern_returned', 'Фонарь Ф-089 — возвращён (норма)', NULL, NOW() - INTERVAL '50 minutes');

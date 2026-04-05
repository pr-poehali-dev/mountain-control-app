
-- Демо-события
INSERT INTO events (event_type, description, personnel_id, created_at, is_demo_data) VALUES
('arrival', 'Петров Алексей Николаевич — прибыл на вахту', 423, NOW() - INTERVAL '2 hours', TRUE),
('checkpoint_in', 'Петров Алексей Николаевич — проход через КПП (вход)', 423, NOW() - INTERVAL '1 hour 50 minutes', TRUE),
('medical_passed', 'Петров Алексей Николаевич — медосмотр пройден', 423, NOW() - INTERVAL '1 hour 40 minutes', TRUE),
('lamp_issued', 'Петров Алексей Николаевич — выдан светильник Л-015', 423, NOW() - INTERVAL '1 hour 30 minutes', TRUE),
('arrival', 'Сидоров Михаил Валерьевич — прибыл на вахту', 424, NOW() - INTERVAL '1 hour 45 minutes', TRUE),
('checkpoint_in', 'Сидоров Михаил Валерьевич — проход через КПП (вход)', 424, NOW() - INTERVAL '1 hour 35 minutes', TRUE),
('medical_passed', 'Сидоров Михаил Валерьевич — медосмотр пройден', 424, NOW() - INTERVAL '1 hour 25 minutes', TRUE),
('checkpoint_in', 'Козлов Дмитрий Сергеевич — проход через КПП (вход)', 425, NOW() - INTERVAL '3 hours', TRUE),
('medical_passed', 'Козлов Дмитрий Сергеевич — медосмотр пройден', 425, NOW() - INTERVAL '2 hours 50 minutes', TRUE),
('arrival', 'Новиков Андрей Петрович — прибыл на вахту', 426, NOW() - INTERVAL '4 hours', TRUE),
('checkpoint_in', 'Новиков Андрей Петрович — проход через КПП (вход)', 426, NOW() - INTERVAL '3 hours 50 minutes', TRUE),
('medical_passed', 'Новиков Андрей Петрович — медосмотр пройден', 426, NOW() - INTERVAL '3 hours 40 minutes', TRUE),
('lamp_issued', 'Новиков Андрей Петрович — выдан светильник Л-022', 426, NOW() - INTERVAL '3 hours 30 minutes', TRUE),
('medical_failed', 'Соколов Артём Владимирович — медосмотр не пройден (повышенное АД)', 431, NOW() - INTERVAL '5 hours', TRUE),
('checkpoint_in', 'Кузнецов Павел Олегович — проход через КПП (вход)', 430, NOW() - INTERVAL '6 hours', TRUE),
('medical_passed', 'Кузнецов Павел Олегович — медосмотр пройден', 430, NOW() - INTERVAL '5 hours 50 minutes', TRUE),
('security_check', 'Волков Сергей Александрович — проверка документов (ок)', 428, NOW() - INTERVAL '7 hours', TRUE),
('checkpoint_in', 'Морозов Виктор Иванович — проход через КПП (вход)', 427, NOW() - INTERVAL '8 hours', TRUE),
('departure', 'Лебедев Игорь Дмитриевич — убыл с вахты', 429, NOW() - INTERVAL '10 hours', TRUE),
('checkpoint_out', 'Лебедев Игорь Дмитриевич — проход через КПП (выход)', 429, NOW() - INTERVAL '10 hours 5 minutes', TRUE),
('arrival', 'Фёдоров Максим Юрьевич — прибыл в командировку', 434, NOW() - INTERVAL '1 day', TRUE),
('checkpoint_in', 'Попов Николай Сергеевич — проход через КПП (вход)', 432, NOW() - INTERVAL '3 hours 10 minutes', TRUE),
('medical_passed', 'Попов Николай Сергеевич — медосмотр пройден', 432, NOW() - INTERVAL '3 hours', TRUE),
('security_check', 'Григорьев Олег Анатольевич — проверка документов (ок)', 433, NOW() - INTERVAL '9 hours', TRUE);

-- Демо-медосмотры
INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes, checked_at, shift_type, check_direction, shift_date, is_demo_data) VALUES
(423, 'pre_shift', 'passed', '125/80', 72, 0.00, 36.6, 'Смирнова Е.В.', 'Здоров, допущен', NOW() - INTERVAL '1 hour 40 minutes', 'day', 'to_shift', CURRENT_DATE, TRUE),
(424, 'pre_shift', 'passed', '130/85', 78, 0.00, 36.5, 'Смирнова Е.В.', 'Здоров, допущен', NOW() - INTERVAL '1 hour 25 minutes', 'day', 'to_shift', CURRENT_DATE, TRUE),
(425, 'pre_shift', 'passed', '118/75', 68, 0.00, 36.7, 'Смирнова Е.В.', 'Здоров, допущен', NOW() - INTERVAL '2 hours 50 minutes', 'day', 'to_shift', CURRENT_DATE, TRUE),
(426, 'pre_shift', 'passed', '122/78', 74, 0.00, 36.4, 'Смирнова Е.В.', 'Здоров, допущен', NOW() - INTERVAL '3 hours 40 minutes', 'day', 'to_shift', CURRENT_DATE, TRUE),
(427, 'pre_shift', 'passed', '135/88', 82, 0.00, 36.8, 'Кравченко И.П.', 'Допущен с замечанием', NOW() - INTERVAL '8 hours', 'night', 'to_shift', CURRENT_DATE - 1, TRUE),
(428, 'pre_shift', 'passed', '120/78', 70, 0.00, 36.5, 'Кравченко И.П.', 'Здоров, допущен', NOW() - INTERVAL '7 hours', 'day', 'to_shift', CURRENT_DATE, TRUE),
(430, 'pre_shift', 'passed', '115/72', 66, 0.00, 36.6, 'Смирнова Е.В.', 'Здоров, допущен', NOW() - INTERVAL '5 hours 50 minutes', 'day', 'to_shift', CURRENT_DATE, TRUE),
(431, 'pre_shift', 'failed', '160/100', 92, 0.00, 36.9, 'Смирнова Е.В.', 'Не допущен — повышенное АД', NOW() - INTERVAL '5 hours', 'day', 'to_shift', CURRENT_DATE, TRUE),
(432, 'pre_shift', 'passed', '128/82', 76, 0.00, 36.5, 'Смирнова Е.В.', 'Здоров, допущен', NOW() - INTERVAL '3 hours', 'day', 'to_shift', CURRENT_DATE, TRUE),
(433, 'pre_shift', 'passed', '119/76', 70, 0.00, 36.6, 'Кравченко И.П.', 'Здоров, допущен', NOW() - INTERVAL '9 hours', 'day', 'to_shift', CURRENT_DATE, TRUE),
(429, 'post_shift', 'passed', '130/84', 80, 0.00, 36.7, 'Кравченко И.П.', 'Норма', NOW() - INTERVAL '10 hours', 'day', 'from_shift', CURRENT_DATE - 1, TRUE);

-- Демо-проходы КПП
INSERT INTO checkpoint_passes (personnel_id, personal_code, full_name, direction, checkpoint_name, medical_ok, notes, created_at, is_demo_data) VALUES
(423, 'ДМ-001', 'Петров Алексей Николаевич', 'in', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '1 hour 50 minutes', TRUE),
(424, 'ДМ-002', 'Сидоров Михаил Валерьевич', 'in', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '1 hour 35 minutes', TRUE),
(425, 'ДМ-003', 'Козлов Дмитрий Сергеевич', 'in', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '3 hours', TRUE),
(426, 'ДМ-004', 'Новиков Андрей Петрович', 'in', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '3 hours 50 minutes', TRUE),
(427, 'ДМ-005', 'Морозов Виктор Иванович', 'in', 'КПП-2 Промплощадка', TRUE, '', NOW() - INTERVAL '8 hours', TRUE),
(428, 'ДМ-006', 'Волков Сергей Александрович', 'in', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '7 hours', TRUE),
(429, 'ДМ-007', 'Лебедев Игорь Дмитриевич', 'out', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '10 hours 5 minutes', TRUE),
(430, 'ДМ-008', 'Кузнецов Павел Олегович', 'in', 'КПП-2 Промплощадка', TRUE, '', NOW() - INTERVAL '6 hours', TRUE),
(431, 'ДМ-009', 'Соколов Артём Владимирович', 'in', 'КПП-1 Главный', FALSE, 'Не пройден медосмотр', NOW() - INTERVAL '5 hours 10 minutes', TRUE),
(432, 'ДМ-010', 'Попов Николай Сергеевич', 'in', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '3 hours 10 minutes', TRUE),
(433, 'ДМ-011', 'Григорьев Олег Анатольевич', 'in', 'КПП-1 Главный', TRUE, '', NOW() - INTERVAL '9 hours', TRUE),
(434, 'ДМ-012', 'Фёдоров Максим Юрьевич', 'in', 'КПП-1 Главный', TRUE, 'Командировка', NOW() - INTERVAL '1 day', TRUE);

-- Демо-проверки охраны
INSERT INTO security_checks (personnel_id, personal_code, full_name, check_type, result, notes, checked_by, created_at, is_demo_data) VALUES
(423, 'ДМ-001', 'Петров Алексей Николаевич', 'document', 'valid', 'Удостоверение проверено', 'Охранник Васильев А.К.', NOW() - INTERVAL '1 hour 55 minutes', TRUE),
(424, 'ДМ-002', 'Сидоров Михаил Валерьевич', 'document', 'valid', 'Удостоверение проверено', 'Охранник Васильев А.К.', NOW() - INTERVAL '1 hour 40 minutes', TRUE),
(428, 'ДМ-006', 'Волков Сергей Александрович', 'document', 'valid', 'Удостоверение проверено', 'Охранник Васильев А.К.', NOW() - INTERVAL '7 hours 10 minutes', TRUE),
(430, 'ДМ-008', 'Кузнецов Павел Олегович', 'document', 'valid', 'Пропуск подрядчика проверен', 'Охранник Ермолаев С.Н.', NOW() - INTERVAL '6 hours 5 minutes', TRUE),
(431, 'ДМ-009', 'Соколов Артём Владимирович', 'document', 'valid', 'Пропуск подрядчика проверен', 'Охранник Ермолаев С.Н.', NOW() - INTERVAL '5 hours 15 minutes', TRUE),
(434, 'ДМ-012', 'Фёдоров Максим Юрьевич', 'document', 'valid', 'Командировочное удостоверение', 'Охранник Васильев А.К.', NOW() - INTERVAL '1 day 10 minutes', TRUE),
(433, 'ДМ-011', 'Григорьев Олег Анатольевич', 'document', 'valid', 'Удостоверение ОТ проверено', 'Охранник Васильев А.К.', NOW() - INTERVAL '9 hours 5 minutes', TRUE);

-- Демо-ламповая (выдача)
INSERT INTO lamp_room_issues (person_id, person_code, person_name, item_type, lantern_number, rescuer_number, status, issued_at, returned_at, condition, notes, issued_by, tabular_number, is_demo_data) VALUES
(423, 'ДМ-001', 'Петров Алексей Николаевич', 'both', 'ДЛ-015', 'ДС-015', 'issued', NOW() - INTERVAL '1 hour 30 minutes', NULL, 'good', '', 'Ламповщик Белова Т.А.', '', TRUE),
(424, 'ДМ-002', 'Сидоров Михаил Валерьевич', 'both', 'ДЛ-016', 'ДС-016', 'issued', NOW() - INTERVAL '1 hour 20 minutes', NULL, 'good', '', 'Ламповщик Белова Т.А.', '', TRUE),
(426, 'ДМ-004', 'Новиков Андрей Петрович', 'both', 'ДЛ-022', 'ДС-022', 'issued', NOW() - INTERVAL '3 hours 30 minutes', NULL, 'good', '', 'Ламповщик Белова Т.А.', '', TRUE),
(432, 'ДМ-010', 'Попов Николай Сергеевич', 'both', 'ДЛ-031', 'ДС-031', 'issued', NOW() - INTERVAL '2 hours 50 minutes', NULL, 'good', '', 'Ламповщик Белова Т.А.', '', TRUE),
(429, 'ДМ-007', 'Лебедев Игорь Дмитриевич', 'both', 'ДЛ-018', 'ДС-018', 'returned', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '10 hours 10 minutes', 'good', '', 'Ламповщик Белова Т.А.', '', TRUE);

-- Демо-диспетчерские сообщения
INSERT INTO dispatcher_messages (sender_name, sender_role, message, is_urgent, created_at, is_demo_data) VALUES
('Волков С.А.', 'Начальник участка', 'Участок №1: работы по плану, 4 человека в забое', FALSE, NOW() - INTERVAL '2 hours', TRUE),
('Белова Т.А.', 'Ламповщик', 'Выдано 4 светильника на дневную смену', FALSE, NOW() - INTERVAL '1 hour 30 minutes', TRUE),
('Смирнова Е.В.', 'Врач', 'Медосмотр: 10 допущено, 1 не допущен (Соколов А.В.)', FALSE, NOW() - INTERVAL '50 minutes', TRUE),
('Охранник Васильев', 'Охрана', 'КПП-1: пропущено 8 человек за смену, нарушений нет', FALSE, NOW() - INTERVAL '30 minutes', TRUE),
('Диспетчер', 'Диспетчер', 'Внимание: подрядчик Соколов А.В. не допущен к работе', TRUE, NOW() - INTERVAL '4 hours 30 minutes', TRUE);

-- Демо-здания
INSERT INTO buildings (name, number, total_rooms, total_capacity, sort_order, is_active, created_at, updated_at, is_demo_data) VALUES
('Общежитие №1 (демо)', 'Д1', 6, 24, 100, TRUE, NOW(), NOW(), TRUE),
('Общежитие №2 (демо)', 'Д2', 4, 16, 101, TRUE, NOW(), NOW(), TRUE);

-- Демо-комнаты (уникальные номера)
INSERT INTO rooms (room_number, building, capacity, occupied, status, building_id, floor, notes, is_active, created_at, updated_at, is_demo_data) VALUES
('Д1-101', 'Общежитие №1 (демо)', 4, 3, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №1 (демо)' AND is_demo_data = TRUE LIMIT 1), 1, '', TRUE, NOW(), NOW(), TRUE),
('Д1-102', 'Общежитие №1 (демо)', 4, 4, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №1 (демо)' AND is_demo_data = TRUE LIMIT 1), 1, '', TRUE, NOW(), NOW(), TRUE),
('Д1-103', 'Общежитие №1 (демо)', 4, 2, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №1 (демо)' AND is_demo_data = TRUE LIMIT 1), 1, '', TRUE, NOW(), NOW(), TRUE),
('Д1-201', 'Общежитие №1 (демо)', 4, 1, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №1 (демо)' AND is_demo_data = TRUE LIMIT 1), 2, '', TRUE, NOW(), NOW(), TRUE),
('Д1-202', 'Общежитие №1 (демо)', 4, 0, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №1 (демо)' AND is_demo_data = TRUE LIMIT 1), 2, '', TRUE, NOW(), NOW(), TRUE),
('Д1-203', 'Общежитие №1 (демо)', 4, 2, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №1 (демо)' AND is_demo_data = TRUE LIMIT 1), 2, '', TRUE, NOW(), NOW(), TRUE),
('Д2-101', 'Общежитие №2 (демо)', 4, 3, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №2 (демо)' AND is_demo_data = TRUE LIMIT 1), 1, '', TRUE, NOW(), NOW(), TRUE),
('Д2-102', 'Общежитие №2 (демо)', 4, 2, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №2 (демо)' AND is_demo_data = TRUE LIMIT 1), 1, '', TRUE, NOW(), NOW(), TRUE),
('Д2-201', 'Общежитие №2 (демо)', 4, 1, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №2 (демо)' AND is_demo_data = TRUE LIMIT 1), 2, '', TRUE, NOW(), NOW(), TRUE),
('Д2-202', 'Общежитие №2 (демо)', 4, 0, 'active', (SELECT id FROM buildings WHERE name = 'Общежитие №2 (демо)' AND is_demo_data = TRUE LIMIT 1), 2, '', TRUE, NOW(), NOW(), TRUE);

-- Демо-уведомления
INSERT INTO notifications (type, title, message, person_name, person_code, is_read, created_at, is_demo_data) VALUES
('medical_failed', 'Медосмотр не пройден', 'Сотрудник не допущен: повышенное АД', 'Соколов Артём Владимирович', 'ДМ-009', FALSE, NOW() - INTERVAL '5 hours', TRUE),
('medical_expiring', 'Истекает медосвидетельствование', 'Срок медосвидетельствования истекает через 5 дней', 'Морозов Виктор Иванович', 'ДМ-005', FALSE, NOW() - INTERVAL '1 day', TRUE),
('checkpoint', 'Проход через КПП', 'Командированный сотрудник прибыл на территорию', 'Фёдоров Максим Юрьевич', 'ДМ-012', TRUE, NOW() - INTERVAL '1 day', TRUE);

-- Демо-оборудование ламповой
INSERT INTO lamp_room_equipment (equipment_type, equipment_number, status, repair_reason, created_at, notes, is_demo_data) VALUES
('lantern', 'ДЛ-015', 'issued', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-016', 'issued', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-017', 'available', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-018', 'available', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-019', 'available', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-020', 'available', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-021', 'available', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-022', 'issued', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-023', 'repair', 'Разбит корпус', NOW() - INTERVAL '3 days', 'На ремонте', TRUE),
('lantern', 'ДЛ-024', 'available', NULL, NOW(), '', TRUE),
('lantern', 'ДЛ-031', 'issued', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-015', 'issued', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-016', 'issued', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-017', 'available', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-018', 'available', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-019', 'available', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-020', 'available', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-022', 'issued', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-031', 'issued', NULL, NOW(), '', TRUE),
('rescuer', 'ДС-023', 'repair', 'Истёк срок поверки', NOW() - INTERVAL '5 days', 'На поверке', TRUE);

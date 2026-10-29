UPDATE rotation_departments SET is_active = FALSE, name = 'ОГР-образец (дубль)' WHERE id IN (3, 4);
INSERT INTO rotation_members (personnel_id, crew_id, is_key)
SELECT p.id, CASE WHEN CAST(SUBSTRING(p.personal_code FROM 5) AS INT) <= 27 THEN 15 ELSE 16 END, p.position = 'Горный мастер'
FROM personnel p WHERE p.personal_code LIKE 'ОБР-%'
ON CONFLICT (personnel_id) DO NOTHING;
INSERT INTO rotation_norms (department_id, position, min_count)
SELECT 5, x.p, x.n FROM (VALUES ('Горный мастер', 2), ('Проходчик', 7), ('Машинист ПДМ', 3), ('Машинист буровой установки', 2), ('Взрывник', 2), ('Крепильщик', 2), ('Электрослесарь подземный', 2), ('Слесарь-ремонтник', 1), ('Горнорабочий подземный', 1)) AS x(p, n)
ON CONFLICT (department_id, position) DO NOTHING;
INSERT INTO rotation_exceptions (personnel_id, kind, date_from, date_to, notes)
SELECT id, 'vacation', DATE '2026-12-01', DATE '2026-12-28', 'Ежегодный отпуск (образец)' FROM personnel WHERE personal_code = 'ОБР-040';
INSERT INTO rotation_exceptions (personnel_id, kind, date_from, date_to, notes)
SELECT id, 'sick', CURRENT_DATE - 2, CURRENT_DATE + 6, 'Больничный (образец)' FROM personnel WHERE personal_code = 'ОБР-012';
UPDATE rotation_departments SET sort_order = 0 WHERE id = 5;
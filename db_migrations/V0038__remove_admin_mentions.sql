UPDATE medical_checks
SET doctor_name = '',
    notes = REPLACE(notes, 'Отметка администратора — ', '')
WHERE doctor_name LIKE 'Админ:%' OR notes LIKE 'Отметка администратора%';

UPDATE events SET is_hidden = TRUE
WHERE description LIKE 'Журнал КПП:%' OR description LIKE '%администратором%';

UPDATE events
SET description = REGEXP_REPLACE(description, ' — медосмотр пройден \(отметка администратора [^)]*\)', ' — прошёл медосмотр')
WHERE event_type = 'medical_pass' AND description LIKE '%(отметка администратора%';

UPDATE events
SET description = REGEXP_REPLACE(description, ' — медосмотр не пройден \(отметка администратора [^)]*\)', ' — не прошёл медосмотр')
WHERE event_type = 'medical_fail' AND description LIKE '%(отметка администратора%';

UPDATE events SET is_hidden = TRUE
WHERE description LIKE '%(отметка администратора%';
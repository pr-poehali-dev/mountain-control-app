CREATE TABLE rotation_workers (
  id SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES rotation_departments(id),
  crew_id INT NULL REFERENCES rotation_crews(id),
  full_name VARCHAR(255) NOT NULL,
  position VARCHAR(200) NOT NULL DEFAULT '',
  tab_number VARCHAR(50) NOT NULL DEFAULT '',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  pass_valid_to DATE NULL,
  housing VARCHAR(200) NOT NULL DEFAULT '',
  is_key BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rotation_workers_dept ON rotation_workers(department_id);
CREATE INDEX idx_rotation_workers_crew ON rotation_workers(crew_id);

CREATE TABLE rotation_absences (
  id SERIAL PRIMARY KEY,
  worker_id INT NOT NULL REFERENCES rotation_workers(id),
  kind VARCHAR(30) NOT NULL DEFAULT 'vacation',
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rotation_absences_worker ON rotation_absences(worker_id);

CREATE TABLE rotation_worker_moves (
  id SERIAL PRIMARY KEY,
  worker_id INT NOT NULL REFERENCES rotation_workers(id),
  change_date DATE NOT NULL,
  direction VARCHAR(5) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  transport VARCHAR(100) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, change_date, direction)
);

INSERT INTO rotation_workers (department_id, crew_id, full_name, position, tab_number, pass_valid_to, housing, is_key)
SELECT 5, m.crew_id, p.full_name, COALESCE(p.position, ''), SUBSTRING(p.personal_code FROM 5), p.pass_valid_to,
       TRIM(COALESCE(p.residence, '') || ' ' || COALESCE(p.room, '')), m.is_key
FROM rotation_members m JOIN personnel p ON p.id = m.personnel_id
WHERE p.personal_code LIKE 'ОБР-%'
ORDER BY p.personal_code;

INSERT INTO rotation_absences (worker_id, kind, date_from, date_to, notes)
SELECT w.id, e.kind, e.date_from, e.date_to, e.notes
FROM rotation_exceptions e JOIN personnel p ON p.id = e.personnel_id
JOIN rotation_workers w ON w.department_id = 5 AND w.tab_number = SUBSTRING(p.personal_code FROM 5)
WHERE p.personal_code LIKE 'ОБР-%';

UPDATE personnel SET status = 'archived', is_hidden = TRUE, department = '', organization = '',
       full_name = '[образец перевахтовки] ' || full_name, residence = '', room = '', pass_number = ''
WHERE personal_code LIKE 'ОБР-%';
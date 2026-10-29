CREATE TABLE rotation_departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NOT NULL DEFAULT '',
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  on_days INT NOT NULL DEFAULT 60,
  off_days INT NOT NULL DEFAULT 60,
  handover_days INT NOT NULL DEFAULT 1,
  anchor_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scheme VARCHAR(20) NOT NULL DEFAULT 'full',
  head_name VARCHAR(200) NOT NULL DEFAULT '',
  color VARCHAR(20) NOT NULL DEFAULT 'amber',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE rotation_crews (
  id SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES rotation_departments(id),
  name VARCHAR(50) NOT NULL,
  offset_days INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE rotation_members (
  personnel_id INT PRIMARY KEY REFERENCES personnel(id),
  crew_id INT NOT NULL REFERENCES rotation_crews(id),
  is_key BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE rotation_norms (
  id SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES rotation_departments(id),
  position VARCHAR(200) NOT NULL,
  min_count INT NOT NULL DEFAULT 1,
  UNIQUE (department_id, position)
);

CREATE TABLE rotation_exceptions (
  id SERIAL PRIMARY KEY,
  personnel_id INT NOT NULL REFERENCES personnel(id),
  kind VARCHAR(30) NOT NULL DEFAULT 'vacation',
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE rotation_moves (
  id SERIAL PRIMARY KEY,
  personnel_id INT NOT NULL REFERENCES personnel(id),
  change_date DATE NOT NULL,
  direction VARCHAR(5) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  transport VARCHAR(100) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (personnel_id, change_date, direction)
);

CREATE INDEX idx_rotation_crews_dept ON rotation_crews(department_id);
CREATE INDEX idx_rotation_members_crew ON rotation_members(crew_id);
CREATE INDEX idx_rotation_exc_person ON rotation_exceptions(personnel_id);
CREATE INDEX idx_rotation_moves_date ON rotation_moves(change_date);
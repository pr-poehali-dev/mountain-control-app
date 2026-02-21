
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE aho_arrivals ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE aho_batches ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE medical_checks ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_personnel_is_hidden ON personnel(is_hidden);
CREATE INDEX IF NOT EXISTS idx_aho_arrivals_is_hidden ON aho_arrivals(is_hidden);
CREATE INDEX IF NOT EXISTS idx_medical_checks_is_hidden ON medical_checks(is_hidden);

CREATE TABLE IF NOT EXISTS reset_log (
    id SERIAL PRIMARY KEY,
    reset_type VARCHAR(50) NOT NULL,
    description TEXT,
    affected_rows INTEGER DEFAULT 0,
    performed_by INTEGER REFERENCES users(id),
    performed_at TIMESTAMP DEFAULT NOW()
);

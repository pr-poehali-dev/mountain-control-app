
CREATE TABLE IF NOT EXISTS security_checks (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER REFERENCES personnel(id),
    personal_code VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    check_type VARCHAR(50) NOT NULL DEFAULT 'pass_verification',
    result VARCHAR(50) NOT NULL DEFAULT 'valid',
    notes TEXT,
    checked_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_checks_personnel ON security_checks(personnel_id);
CREATE INDEX idx_security_checks_created ON security_checks(created_at DESC);
CREATE INDEX idx_security_checks_result ON security_checks(result);

CREATE TABLE IF NOT EXISTS checkpoint_passes (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER REFERENCES personnel(id),
    personal_code VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    direction VARCHAR(10) NOT NULL DEFAULT 'in',
    checkpoint_name VARCHAR(100) DEFAULT 'КПП-1',
    medical_ok BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkpoint_passes_personnel ON checkpoint_passes(personnel_id);
CREATE INDEX idx_checkpoint_passes_created ON checkpoint_passes(created_at DESC);
CREATE INDEX idx_checkpoint_passes_direction ON checkpoint_passes(direction);
CREATE INDEX idx_checkpoint_passes_date ON checkpoint_passes(created_at);

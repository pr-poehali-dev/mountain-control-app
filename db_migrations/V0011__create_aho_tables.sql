
CREATE TABLE IF NOT EXISTS aho_arrivals (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50) NOT NULL,
    personnel_id INTEGER REFERENCES personnel(id),
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    department VARCHAR(255),
    organization VARCHAR(255),
    organization_type VARCHAR(50) DEFAULT 'contractor',
    phone VARCHAR(50),
    arrival_date DATE NOT NULL,
    departure_date DATE,
    arrival_status VARCHAR(50) NOT NULL DEFAULT 'expected',
    check_in_at TIMESTAMP,
    check_out_at TIMESTAMP,
    room VARCHAR(20),
    building VARCHAR(100),
    medical_status VARCHAR(50) DEFAULT 'pending',
    personal_code VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aho_arrivals_batch ON aho_arrivals(batch_id);
CREATE INDEX IF NOT EXISTS idx_aho_arrivals_status ON aho_arrivals(arrival_status);
CREATE INDEX IF NOT EXISTS idx_aho_arrivals_personnel ON aho_arrivals(personnel_id);
CREATE INDEX IF NOT EXISTS idx_aho_arrivals_dates ON aho_arrivals(arrival_date, departure_date);

CREATE TABLE IF NOT EXISTS aho_batches (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50) NOT NULL UNIQUE,
    file_name VARCHAR(255),
    total_count INTEGER NOT NULL DEFAULT 0,
    arrived_count INTEGER NOT NULL DEFAULT 0,
    departed_count INTEGER NOT NULL DEFAULT 0,
    arrival_date DATE,
    departure_date DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

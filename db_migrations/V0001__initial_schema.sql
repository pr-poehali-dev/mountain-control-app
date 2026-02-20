
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    department VARCHAR(255),
    personal_code VARCHAR(20) UNIQUE NOT NULL,
    qr_code VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE personnel (
    id SERIAL PRIMARY KEY,
    personal_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    department VARCHAR(255),
    category VARCHAR(50) NOT NULL DEFAULT 'mine',
    phone VARCHAR(50),
    room VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'arrived',
    qr_code VARCHAR(255) UNIQUE,
    medical_status VARCHAR(50) DEFAULT 'pending',
    shift VARCHAR(10),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    building VARCHAR(100),
    capacity INTEGER NOT NULL DEFAULT 2,
    occupied INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'available'
);

CREATE TABLE lanterns (
    id SERIAL PRIMARY KEY,
    lantern_number VARCHAR(20) UNIQUE NOT NULL,
    rescuer_number VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'available',
    assigned_to INTEGER REFERENCES personnel(id),
    issued_at TIMESTAMP,
    returned_at TIMESTAMP,
    condition VARCHAR(50) DEFAULT 'normal'
);

CREATE TABLE medical_checks (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    check_type VARCHAR(50) NOT NULL DEFAULT 'pre_shift',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    blood_pressure VARCHAR(20),
    pulse INTEGER,
    alcohol_level DECIMAL(4,2) DEFAULT 0.00,
    temperature DECIMAL(4,1),
    doctor_name VARCHAR(255),
    notes TEXT,
    checked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    personnel_id INTEGER REFERENCES personnel(id),
    user_id INTEGER REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personnel_code ON personnel(personal_code);
CREATE INDEX idx_personnel_status ON personnel(status);
CREATE INDEX idx_personnel_category ON personnel(category);
CREATE INDEX idx_lanterns_status ON lanterns(status);
CREATE INDEX idx_medical_checks_personnel ON medical_checks(personnel_id);
CREATE INDEX idx_medical_checks_date ON medical_checks(checked_at);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_date ON events(created_at);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_personal_code ON users(personal_code);

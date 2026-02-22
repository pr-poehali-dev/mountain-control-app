
CREATE TABLE lamp_room_issues (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES personnel(id),
    person_code VARCHAR(50) NOT NULL,
    person_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('lantern', 'rescuer', 'both')),
    lantern_number VARCHAR(50),
    rescuer_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned')),
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMP,
    condition VARCHAR(50) DEFAULT 'normal',
    notes TEXT,
    issued_by VARCHAR(255)
);

CREATE TABLE lamp_room_denials (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES personnel(id),
    person_code VARCHAR(50) NOT NULL,
    person_name VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    denied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    denied_by VARCHAR(255)
);

CREATE INDEX idx_lamp_issues_person ON lamp_room_issues(person_id);
CREATE INDEX idx_lamp_issues_status ON lamp_room_issues(status);
CREATE INDEX idx_lamp_issues_date ON lamp_room_issues(issued_at);
CREATE INDEX idx_lamp_denials_date ON lamp_room_denials(denied_at);

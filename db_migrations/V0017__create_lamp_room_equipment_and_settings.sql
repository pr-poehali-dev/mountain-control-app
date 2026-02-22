
CREATE TABLE lamp_room_equipment (
    id SERIAL PRIMARY KEY,
    equipment_type VARCHAR(20) NOT NULL CHECK (equipment_type IN ('lantern', 'rescuer')),
    equipment_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued', 'repair', 'decommissioned')),
    repair_reason TEXT,
    sent_to_repair_at TIMESTAMP,
    returned_from_repair_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_lamp_equipment_type ON lamp_room_equipment(equipment_type);
CREATE INDEX idx_lamp_equipment_status ON lamp_room_equipment(status);

INSERT INTO settings (key, value) VALUES ('lamp_room_total_lanterns', '300') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('lamp_room_total_rescuers', '300') ON CONFLICT DO NOTHING;

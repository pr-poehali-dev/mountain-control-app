CREATE TABLE IF NOT EXISTS housing_history (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id),
    action VARCHAR(20) NOT NULL,
    building_id INTEGER NULL REFERENCES buildings(id),
    room_id INTEGER NULL REFERENCES rooms(id),
    building_name VARCHAR(255) NOT NULL DEFAULT '',
    room_number VARCHAR(20) NOT NULL DEFAULT '',
    prev_building_name VARCHAR(255) NOT NULL DEFAULT '',
    prev_room_number VARCHAR(20) NOT NULL DEFAULT '',
    source VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_housing_history_person ON housing_history(personnel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_housing_history_date ON housing_history(created_at);

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500) NOT NULL DEFAULT '';

INSERT INTO housing_history (personnel_id, action, building_id, room_id, building_name, room_number, source, created_at)
SELECT p.id, 'checkin', r.building_id, r.id, b.name, r.room_number, 'Начальные данные', COALESCE(p.updated_at, NOW())
FROM personnel p JOIN rooms r ON r.id = p.residence_room_id JOIN buildings b ON b.id = r.building_id
WHERE NOT EXISTS (SELECT 1 FROM housing_history h WHERE h.personnel_id = p.id);
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_building_number ON rooms(building_id, room_number);
CREATE INDEX IF NOT EXISTS idx_personnel_residence_room ON personnel(residence_room_id);

INSERT INTO rooms (building_id, building, room_number, capacity, floor)
SELECT p.residence_building_id, b.name, TRIM(p.room), 2, 1
FROM personnel p
JOIN buildings b ON b.id = p.residence_building_id
WHERE p.residence_room_id IS NULL AND COALESCE(TRIM(p.room), '') != ''
  AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.building_id = p.residence_building_id AND r.room_number = TRIM(p.room))
GROUP BY p.residence_building_id, b.name, TRIM(p.room);

UPDATE personnel p SET
  residence_room_id = r.id,
  residence = b.name || ', комн. ' || r.room_number,
  updated_at = NOW()
FROM rooms r JOIN buildings b ON b.id = r.building_id
WHERE p.residence_room_id IS NULL
  AND r.building_id = p.residence_building_id
  AND r.room_number = TRIM(p.room);

UPDATE buildings b SET
  total_rooms = (SELECT COUNT(*) FROM rooms WHERE building_id = b.id AND is_active = TRUE),
  total_capacity = (SELECT COALESCE(SUM(capacity), 0) FROM rooms WHERE building_id = b.id AND is_active = TRUE);
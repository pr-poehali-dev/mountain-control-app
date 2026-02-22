
INSERT INTO t_p25857058_mountain_control_app.lamp_room_equipment (equipment_type, equipment_number, status, repair_reason, sent_to_repair_at)
SELECT 
    CASE 
        WHEN i.item_type IN ('lantern', 'both') THEN 'lantern'
        ELSE 'rescuer'
    END,
    COALESCE(i.lantern_number, i.rescuer_number),
    'repair',
    'Требует ремонта (от ' || i.person_name || ')',
    i.returned_at
FROM t_p25857058_mountain_control_app.lamp_room_issues i
WHERE i.status = 'returned' 
  AND i.condition = 'needs_repair'
  AND i.item_type IN ('lantern', 'both')
  AND i.lantern_number IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM t_p25857058_mountain_control_app.lamp_room_equipment e 
      WHERE e.equipment_type = 'lantern' AND e.equipment_number = i.lantern_number
  );

INSERT INTO t_p25857058_mountain_control_app.lamp_room_equipment (equipment_type, equipment_number, status, repair_reason, sent_to_repair_at)
SELECT 
    'rescuer',
    i.rescuer_number,
    'repair',
    'Требует ремонта (от ' || i.person_name || ')',
    i.returned_at
FROM t_p25857058_mountain_control_app.lamp_room_issues i
WHERE i.status = 'returned' 
  AND i.condition = 'needs_repair'
  AND i.item_type IN ('rescuer', 'both')
  AND i.rescuer_number IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM t_p25857058_mountain_control_app.lamp_room_equipment e 
      WHERE e.equipment_type = 'rescuer' AND e.equipment_number = i.rescuer_number
  );

ALTER TABLE t_p25857058_mountain_control_app.personnel ADD COLUMN IF NOT EXISTS gender VARCHAR(1) NOT NULL DEFAULT '';
ALTER TABLE t_p25857058_mountain_control_app.personnel ADD COLUMN IF NOT EXISTS temp_owner_id INTEGER NULL;
ALTER TABLE t_p25857058_mountain_control_app.personnel ADD COLUMN IF NOT EXISTS temp_housed_at TIMESTAMP NULL;
UPDATE t_p25857058_mountain_control_app.personnel SET gender = CASE
  WHEN lower(full_name) ~ '(вич|оглы|улы)(\s|$)' THEN 'M'
  WHEN lower(full_name) ~ '(вна|чна|кызы|гызы)(\s|$)' THEN 'F'
  ELSE '' END
WHERE gender = '';
CREATE INDEX IF NOT EXISTS idx_personnel_temp_owner ON t_p25857058_mountain_control_app.personnel (temp_owner_id);
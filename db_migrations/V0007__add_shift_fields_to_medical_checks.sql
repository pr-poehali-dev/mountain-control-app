ALTER TABLE medical_checks ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20) DEFAULT 'day';
ALTER TABLE medical_checks ADD COLUMN IF NOT EXISTS check_direction VARCHAR(20) DEFAULT 'to_shift';
ALTER TABLE medical_checks ADD COLUMN IF NOT EXISTS shift_date DATE DEFAULT CURRENT_DATE;

COMMENT ON COLUMN medical_checks.shift_type IS 'day=дневная(05-17), night=ночная(17-05)';
COMMENT ON COLUMN medical_checks.check_direction IS 'to_shift=на смену, from_shift=со смены';
COMMENT ON COLUMN medical_checks.shift_date IS 'Дата рабочей смены';
ALTER TABLE t_p25857058_mountain_control_app.users ADD COLUMN IF NOT EXISTS face_descriptor JSONB;
ALTER TABLE t_p25857058_mountain_control_app.users ADD COLUMN IF NOT EXISTS face_photo_url TEXT;
ALTER TABLE t_p25857058_mountain_control_app.users ADD COLUMN IF NOT EXISTS face_updated_at TIMESTAMP;
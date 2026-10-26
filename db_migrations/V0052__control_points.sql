CREATE TABLE IF NOT EXISTS t_p25857058_mountain_control_app.control_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(30) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    icon VARCHAR(50) NOT NULL DEFAULT 'DoorOpen',
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO t_p25857058_mountain_control_app.control_points (name, short_name, icon, is_main, sort_order, settings)
SELECT 'КПП', 'КПП', 'DoorOpen', TRUE, 0,
       '{"counts_territory": true, "require_on_site": false, "check_pass": true, "require_medical": false, "vehicles": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM t_p25857058_mountain_control_app.control_points WHERE is_main = TRUE);

ALTER TABLE t_p25857058_mountain_control_app.checkpoint_passes ADD COLUMN IF NOT EXISTS control_point_id INTEGER NULL;
ALTER TABLE t_p25857058_mountain_control_app.vehicle_passes ADD COLUMN IF NOT EXISTS control_point_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_checkpoint_passes_cp ON t_p25857058_mountain_control_app.checkpoint_passes (control_point_id, personnel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_passes_cp ON t_p25857058_mountain_control_app.vehicle_passes (control_point_id, created_at DESC);
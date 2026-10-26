CREATE TABLE IF NOT EXISTS t_p25857058_mountain_control_app.housing_conflicts (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL,
  owner_id INTEGER NULL,
  temp_id INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_housing_conflicts_open ON t_p25857058_mountain_control_app.housing_conflicts (resolved_at);
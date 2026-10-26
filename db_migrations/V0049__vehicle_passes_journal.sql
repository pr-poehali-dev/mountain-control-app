CREATE TABLE IF NOT EXISTS t_p25857058_mountain_control_app.vehicle_passes (
  id SERIAL PRIMARY KEY,
  personnel_id INTEGER NULL REFERENCES t_p25857058_mountain_control_app.personnel(id),
  vehicle_number VARCHAR(20) NOT NULL,
  vehicle_brand VARCHAR(100) NOT NULL DEFAULT '',
  owner_name VARCHAR(255) NOT NULL DEFAULT '',
  direction VARCHAR(10) NOT NULL,
  checkpoint_name VARCHAR(100) NOT NULL DEFAULT 'КПП-1',
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_passes_created ON t_p25857058_mountain_control_app.vehicle_passes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personnel_vehicle_number ON t_p25857058_mountain_control_app.personnel (vehicle_number);
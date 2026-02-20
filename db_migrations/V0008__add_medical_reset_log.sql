CREATE TABLE IF NOT EXISTS medical_reset_log (
    id SERIAL PRIMARY KEY,
    shift_type VARCHAR(20) NOT NULL,
    shift_date DATE NOT NULL,
    reset_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(shift_type, shift_date)
);

COMMENT ON TABLE medical_reset_log IS 'Лог автосбросов медосмотров — по одному на смену/дату';
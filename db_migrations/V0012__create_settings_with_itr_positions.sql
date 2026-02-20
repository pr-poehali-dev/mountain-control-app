
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES (
    'itr_positions',
    '["Главный инженер", "Главный механик", "Главный энергетик", "Начальник участка", "Начальник смены", "Горный мастер", "Маркшейдер", "Геолог", "Инженер ОТ", "Инженер ОТиПБ", "Инженер-технолог", "Инженер-механик", "Инженер-электрик", "Инженер-геолог", "Инженер КИПиА", "Мастер", "Мастер участка", "Техник", "Диспетчер", "Начальник отдела", "Заместитель начальника"]'::jsonb
) ON CONFLICT (key) DO NOTHING;

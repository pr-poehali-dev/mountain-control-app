CREATE TABLE IF NOT EXISTS dispatcher_messages (
    id SERIAL PRIMARY KEY,
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(50) DEFAULT 'dispatcher',
    message TEXT NOT NULL,
    is_urgent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dispatcher_messages_created ON dispatcher_messages (created_at DESC);
UPDATE settings 
SET value = value || '["Электромеханик", "Инженер по материально-техническому снабжению"]'::jsonb,
    updated_at = NOW()
WHERE key = 'itr_positions';
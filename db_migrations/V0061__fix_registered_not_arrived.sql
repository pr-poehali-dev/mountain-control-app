UPDATE personnel SET status = 'expected', updated_at = NOW()
WHERE id = 501 AND status = 'arrived'
  AND NOT EXISTS (SELECT 1 FROM checkpoint_passes c WHERE c.personnel_id = 501);
UPDATE events SET event_type = 'registration', description = 'Чукмасов Михаил Викторович — зарегистрирован в системе (ожидается, КПП не проходил)'
WHERE id = 1334 AND personnel_id = 501;
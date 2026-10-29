UPDATE personnel SET pass_permanent = FALSE, pass_valid_from = CURRENT_DATE - 60,
  pass_valid_to = CURRENT_DATE + CASE CAST(SUBSTRING(personal_code FROM 4) AS INT)
    WHEN 7 THEN -12 WHEN 17 THEN -3 WHEN 45 THEN -1 WHEN 22 THEN 0 WHEN 33 THEN 2 WHEN 56 THEN 5
    ELSE 90 + CAST(SUBSTRING(personal_code FROM 4) AS INT) END
WHERE is_demo_data = TRUE AND personal_code ~ '^ДМ-[0-9]+$';

UPDATE personnel SET vehicle_pass_permanent = (CAST(SUBSTRING(personal_code FROM 4) AS INT) = 30),
  vehicle_pass_valid_from = CURRENT_DATE - 45,
  vehicle_pass_valid_to = CASE CAST(SUBSTRING(personal_code FROM 4) AS INT)
    WHEN 12 THEN CURRENT_DATE - 4 WHEN 21 THEN CURRENT_DATE + 2 WHEN 30 THEN NULL ELSE CURRENT_DATE + 120 END
WHERE is_demo_data = TRUE AND personal_code ~ '^ДМ-[0-9]+$' AND COALESCE(vehicle_number, '') <> '';
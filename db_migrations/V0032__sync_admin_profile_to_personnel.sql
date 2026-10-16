UPDATE t_p25857058_mountain_control_app.personnel p
SET full_name = u.full_name, position = u.position, department = u.department, updated_at = NOW()
FROM t_p25857058_mountain_control_app.users u
WHERE u.role = 'admin' AND u.personal_code = p.personal_code AND u.personal_code IS NOT NULL;

UPDATE t_p25857058_mountain_control_app.aho_arrivals a
SET full_name = u.full_name, position = u.position, department = u.department
FROM t_p25857058_mountain_control_app.users u
WHERE u.role = 'admin' AND u.personal_code = a.personal_code AND u.personal_code IS NOT NULL;
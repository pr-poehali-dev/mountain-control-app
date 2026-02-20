import json
import os
import psycopg2

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def json_response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': json.dumps(body, ensure_ascii=False, default=str)
    }

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

def handler(event, context):
    """Медицинский контроль — предсменные и послесменные осмотры, сканирование QR"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and action in ('list', ''):
        return get_checks()
    elif method == 'GET' and action == 'stats':
        return get_medical_stats()
    elif method == 'POST' and action == 'add':
        return add_check(body)
    elif method == 'POST' and action == 'scan':
        return scan_medical(body)
    elif method == 'POST' and action == 'deny':
        return deny_medical(body)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_checks():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT mc.id, mc.check_type, mc.status, mc.blood_pressure, mc.pulse,
               mc.alcohol_level, mc.temperature, mc.doctor_name, mc.checked_at, mc.notes,
               p.full_name, p.personal_code, p.department
        FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE p.status != 'archived'
        ORDER BY mc.checked_at DESC
        LIMIT 50
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    checks = []
    for r in rows:
        checks.append({
            'id': r[0], 'check_type': r[1], 'status': r[2],
            'blood_pressure': r[3], 'pulse': r[4],
            'alcohol_level': float(r[5]) if r[5] else 0,
            'temperature': float(r[6]) if r[6] else 0,
            'doctor_name': r[7], 'checked_at': r[8], 'notes': r[9],
            'person_name': r[10], 'person_code': r[11], 'department': r[12]
        })

    return json_response(200, {'checks': checks, 'total': len(checks)})

def get_medical_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT status, COUNT(*) FROM medical_checks
        WHERE checked_at::date = CURRENT_DATE
        GROUP BY status
    """)
    today = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived'")
    total_personnel = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND medical_status = 'passed'")
    med_passed = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND medical_status = 'failed'")
    med_failed = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND medical_status IN ('pending', '')")
    med_pending = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'today': {
            'passed': today.get('passed', 0),
            'failed': today.get('failed', 0),
        },
        'passed': med_passed,
        'failed': med_failed,
        'pending': med_pending,
        'total': total_personnel
    })

def scan_medical(body):
    raw_code = body.get('code', '').strip()
    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, full_name, personal_code, position, department, medical_status, organization
        FROM personnel
        WHERE (personal_code = '%s' OR qr_code = '%s') AND status != 'archived'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    person_id = row[0]
    person_name = row[1]
    person_code = row[2]
    position = row[3]
    department = row[4]
    old_medical = row[5]
    organization = row[6] or ''

    cur.execute("""
        INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes)
        VALUES (%d, 'pre_shift', 'passed', '', 0, 0, 0, 'QR-скан', 'Автоматическая отметка через QR')
        RETURNING id
    """ % person_id)
    check_id = cur.fetchone()[0]

    cur.execute("""
        UPDATE personnel SET medical_status = 'passed', updated_at = NOW() WHERE id = %d
    """ % person_id)

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('medical_pass', '%s — прошёл медосмотр (QR-скан)', %d)
    """ % (person_name.replace("'", "''"), person_id))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'result': 'passed',
        'check_id': check_id,
        'person': {
            'id': person_id,
            'full_name': person_name,
            'personal_code': person_code,
            'position': position,
            'department': department,
            'organization': organization,
            'old_medical': old_medical,
            'new_medical': 'passed'
        },
        'message': '%s — медосмотр пройден' % person_name
    })

def add_check(body):
    personnel_id = body.get('personnel_id')
    check_type = body.get('check_type', 'pre_shift')
    blood_pressure = body.get('blood_pressure', '')
    pulse = body.get('pulse', 0)
    alcohol_level = body.get('alcohol_level', 0.0)
    temperature = body.get('temperature', 0.0)
    doctor_name = body.get('doctor_name', '')
    notes = body.get('notes', '')

    if not personnel_id:
        return json_response(400, {'error': 'ID сотрудника обязателен'})

    status = 'passed'
    if float(alcohol_level) > 0.0:
        status = 'failed'
    if float(temperature) > 37.0:
        status = 'failed'

    bp_parts = blood_pressure.split('/')
    if len(bp_parts) == 2:
        systolic = int(bp_parts[0])
        if systolic > 150 or systolic < 90:
            status = 'failed'

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes)
        VALUES (%d, '%s', '%s', '%s', %d, %s, %s, '%s', '%s')
        RETURNING id
    """ % (
        int(personnel_id),
        check_type.replace("'", "''"),
        status,
        blood_pressure.replace("'", "''"),
        int(pulse),
        float(alcohol_level),
        float(temperature),
        doctor_name.replace("'", "''"),
        notes.replace("'", "''")
    ))
    check_id = cur.fetchone()[0]

    cur.execute("""
        UPDATE personnel SET medical_status = '%s', updated_at = NOW() WHERE id = %d
    """ % (status, int(personnel_id)))

    cur.execute("SELECT full_name FROM personnel WHERE id = %d" % int(personnel_id))
    person_name = cur.fetchone()[0]

    event_type = 'medical_pass' if status == 'passed' else 'medical_fail'
    event_desc = '%s — %s медосмотр' % (person_name.replace("'", "''"), 'прошёл' if status == 'passed' else 'не прошёл')
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('%s', '%s', %d)
    """ % (event_type, event_desc, int(personnel_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'id': check_id,
        'status': status,
        'message': 'Медосмотр записан. Результат: %s' % ('допущен' if status == 'passed' else 'не допущен')
    })

def deny_medical(body):
    raw_code = body.get('code', '').strip()
    reason = body.get('reason', '').strip()
    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, full_name, personal_code, position, department, medical_status, organization
        FROM personnel
        WHERE (personal_code = '%s' OR qr_code = '%s') AND status != 'archived'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    person_id = row[0]
    person_name = row[1]
    person_code = row[2]
    position = row[3]
    department = row[4]
    old_medical = row[5]
    organization = row[6] or ''

    notes = reason if reason else 'Отказ при медосмотре'

    cur.execute("""
        INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes)
        VALUES (%d, 'pre_shift', 'failed', '', 0, 0, 0, 'QR-скан', '%s')
        RETURNING id
    """ % (person_id, notes.replace("'", "''")))
    check_id = cur.fetchone()[0]

    cur.execute("""
        UPDATE personnel SET medical_status = 'failed', updated_at = NOW() WHERE id = %d
    """ % person_id)

    event_desc = '%s — не прошёл медосмотр (%s)' % (person_name.replace("'", "''"), notes.replace("'", "''"))
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('medical_fail', '%s', %d)
    """ % (event_desc, person_id))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'result': 'denied',
        'check_id': check_id,
        'person': {
            'id': person_id,
            'full_name': person_name,
            'personal_code': person_code,
            'position': position,
            'department': department,
            'organization': organization,
            'old_medical': old_medical,
            'new_medical': 'failed'
        },
        'message': '%s — медосмотр НЕ пройден: %s' % (person_name, notes)
    })
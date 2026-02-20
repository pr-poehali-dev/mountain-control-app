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

def handler(event, context):
    """Медицинский контроль — предсменные и послесменные осмотры"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and path == '/':
        return get_checks()
    elif method == 'GET' and path == '/stats':
        return get_medical_stats()
    elif method == 'POST' and path == '/':
        return add_check(body)

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

    cur.execute("SELECT COUNT(*) FROM personnel")
    total_personnel = cur.fetchone()[0]

    cur.close()
    conn.close()

    passed = today.get('passed', 0)
    failed = today.get('failed', 0)
    pending = total_personnel - passed - failed

    return json_response(200, {
        'today': {
            'passed': passed,
            'failed': failed,
            'pending': max(0, pending),
            'total': total_personnel
        }
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

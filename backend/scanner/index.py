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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': json.dumps(body, ensure_ascii=False, default=str)
    }

def handler(event, context):
    """Сканирование QR-кодов и личных кодов — идентификация и отметка персонала"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'POST' and action == 'identify':
        return identify(body)
    elif method == 'POST' and action == 'checkin':
        return checkin(body)
    elif method == 'GET' and action == 'recent':
        return get_recent()

    return json_response(404, {'error': 'Маршрут не найден'})

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

def identify(body):
    raw_code = body.get('code', '').strip()
    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)

    conn = get_db()
    cur = conn.cursor()

    safe_code = code.replace("'", "''")
    cur.execute("""
        SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
               p.category, p.status, p.medical_status, p.room, p.shift
        FROM personnel p
        WHERE p.personal_code = '%s' OR p.qr_code = '%s'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.execute("""
            SELECT u.id, u.personal_code, u.full_name, u.position, u.department,
                   'user' as category, 'active' as status, 'passed' as medical_status, '' as room, '' as shift
            FROM users u
            WHERE u.personal_code = '%s' OR u.qr_code = '%s'
            LIMIT 1
        """ % (safe_code, safe_code))
        row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    category_labels = {
        'mine': 'Рудничный', 'contractor': 'Подрядчик',
        'business_trip': 'Командированный', 'guest': 'Гость', 'user': 'Пользователь'
    }
    status_labels = {
        'on_shift': 'На смене', 'arrived': 'Прибыл', 'departed': 'Убыл',
        'business_trip': 'Командировка', 'active': 'Активен'
    }
    medical_labels = {
        'passed': 'Пройден', 'failed': 'Не пройден',
        'pending': 'Ожидает', 'expiring': 'Истекает'
    }

    medical_ok = row[7] in ('passed', 'expiring')

    return json_response(200, {
        'person': {
            'id': row[0],
            'personal_code': row[1],
            'full_name': row[2],
            'position': row[3],
            'department': row[4],
            'category': category_labels.get(row[5], row[5]),
            'status': status_labels.get(row[6], row[6]),
            'medical_status': medical_labels.get(row[7], row[7]),
            'medical_ok': medical_ok,
            'room': row[8] or '—',
            'shift': row[9] or '—'
        }
    })

def checkin(body):
    raw_code = body.get('code', '').strip()
    action = body.get('action', 'checkin')

    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)

    if not code:
        return json_response(400, {'error': 'Код не указан'})

    conn = get_db()
    cur = conn.cursor()

    safe_code = code.replace("'", "''")
    cur.execute("""
        SELECT id, full_name, medical_status FROM personnel
        WHERE personal_code = '%s' OR qr_code = '%s'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})

    person_id = row[0]
    person_name = row[1]
    medical_status = row[2]

    allowed = medical_status in ('passed', 'expiring')
    result = 'allowed' if allowed else 'denied'

    if action == 'checkin' and allowed:
        cur.execute("""
            UPDATE personnel SET status = 'on_shift', updated_at = NOW() WHERE id = %d
        """ % person_id)

    event_type = 'scan_checkin' if allowed else 'scan_denied'
    event_desc = '%s — %s (QR-скан)' % (
        person_name.replace("'", "''"),
        'отмечен' if allowed else 'отказ: медосмотр не пройден'
    )
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('%s', '%s', %d)
    """ % (event_type, event_desc, person_id))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'result': result,
        'person_name': person_name,
        'message': 'Отметка принята' if allowed else 'Отказ: медосмотр не пройден',
        'medical_ok': allowed
    })

def get_recent():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT e.id, e.event_type, e.description, e.created_at,
               p.full_name, p.personal_code
        FROM events e
        LEFT JOIN personnel p ON e.personnel_id = p.id
        WHERE e.event_type IN ('scan_checkin', 'scan_denied')
        ORDER BY e.created_at DESC
        LIMIT 20
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    scans = []
    for r in rows:
        scans.append({
            'id': r[0],
            'type': r[1],
            'description': r[2],
            'created_at': r[3],
            'person_name': r[4] or '—',
            'person_code': r[5] or '—',
            'allowed': r[1] == 'scan_checkin'
        })

    return json_response(200, {'scans': scans})
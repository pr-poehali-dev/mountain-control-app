import json
import os
from datetime import datetime, date as date_type
import psycopg2

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def serialize_default(obj):
    if isinstance(obj, datetime):
        if obj.tzinfo is None:
            return obj.isoformat() + '+00:00'
        return obj.isoformat()
    if isinstance(obj, (date_type,)):
        return obj.isoformat()
    return str(obj)

def json_response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': json.dumps(body, ensure_ascii=False, default=serialize_default)
    }

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

def handler(event, context):
    """Диспетчерская — выдача/возврат фонарей и самоспасателей, поиск сотрудников, чат"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and action in ('list', ''):
        return get_lanterns(params)
    elif method == 'GET' and action == 'stats':
        return get_lantern_stats()
    elif method == 'GET' and action == 'search':
        return search_person(params)
    elif method == 'GET' and action == 'available':
        return get_available_lanterns()
    elif method == 'POST' and action == 'issue':
        return issue_lantern(body)
    elif method == 'POST' and action == 'issue-by-code':
        return issue_by_code(body)
    elif method == 'POST' and action == 'return':
        return return_lantern(body)
    elif method == 'GET' and action == 'messages':
        return get_messages(params)
    elif method == 'POST' and action == 'message':
        return send_message(body)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_lanterns(params):
    status_filter = params.get('status', '')
    conn = get_db()
    cur = conn.cursor()

    where = ""
    if status_filter and status_filter in ('issued', 'available', 'charging', 'missing'):
        where = "WHERE l.status = '%s'" % status_filter

    cur.execute("""
        SELECT l.id, l.lantern_number, l.rescuer_number, l.status, l.issued_at, l.returned_at, l.condition,
               p.full_name, p.personal_code, p.department
        FROM lanterns l
        LEFT JOIN personnel p ON l.assigned_to = p.id
        %s
        ORDER BY l.status = 'issued' DESC, l.lantern_number
    """ % where)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    lanterns = []
    for r in rows:
        lanterns.append({
            'id': r[0], 'lantern_number': r[1], 'rescuer_number': r[2],
            'status': r[3], 'issued_at': r[4], 'returned_at': r[5],
            'condition': r[6], 'person_name': r[7], 'person_code': r[8],
            'department': r[9] or ''
        })

    return json_response(200, {'lanterns': lanterns, 'total': len(lanterns)})

def get_lantern_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT status, COUNT(*) FROM lanterns GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) FROM lanterns")
    total = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND status IN ('on_shift', 'arrived')")
    on_site = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'total': total,
        'issued': by_status.get('issued', 0),
        'available': by_status.get('available', 0),
        'charging': by_status.get('charging', 0),
        'missing': by_status.get('missing', 0),
        'on_site': on_site
    })

def get_available_lanterns():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, lantern_number, rescuer_number, condition
        FROM lanterns WHERE status IN ('available', 'charging')
        ORDER BY lantern_number
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    items = [{'id': r[0], 'lantern_number': r[1], 'rescuer_number': r[2], 'condition': r[3]} for r in rows]
    return json_response(200, {'lanterns': items})

def search_person(params):
    q = params.get('q', '').strip()
    if not q:
        return json_response(400, {'error': 'Введите запрос'})

    safe_q = q.replace("'", "''")
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.id, p.personal_code, p.full_name, p.position, p.department, p.medical_status,
               (SELECT l.lantern_number FROM lanterns l WHERE l.assigned_to = p.id AND l.status = 'issued' LIMIT 1) as current_lantern
        FROM personnel p
        WHERE p.status != 'archived'
          AND (p.full_name ILIKE '%%%s%%' OR p.personal_code ILIKE '%%%s%%' OR p.qr_code ILIKE '%%%s%%')
        ORDER BY p.full_name LIMIT 15
    """ % (safe_q, safe_q, safe_q))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    results = []
    for r in rows:
        results.append({
            'id': r[0], 'personal_code': r[1], 'full_name': r[2],
            'position': r[3], 'department': r[4], 'medical_status': r[5],
            'current_lantern': r[6]
        })

    return json_response(200, {'results': results})

def issue_lantern(body):
    lantern_id = body.get('lantern_id')
    person_id = body.get('person_id')

    if not lantern_id or not person_id:
        return json_response(400, {'error': 'ID фонаря и сотрудника обязательны'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT status FROM lanterns WHERE id = %d" % int(lantern_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Фонарь не найден'})
    if row[0] == 'issued':
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Фонарь уже выдан'})

    cur.execute("SELECT medical_status FROM personnel WHERE id = %d AND status != 'archived'" % int(person_id))
    p_row = cur.fetchone()
    if not p_row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})
    if p_row[0] != 'passed':
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Медосмотр не пройден — выдача запрещена'})

    cur.execute("""
        UPDATE lanterns SET status = 'issued', assigned_to = %d, issued_at = NOW(), returned_at = NULL
        WHERE id = %d RETURNING lantern_number, rescuer_number
    """ % (int(person_id), int(lantern_id)))
    l_row = cur.fetchone()

    cur.execute("SELECT full_name, personal_code FROM personnel WHERE id = %d" % int(person_id))
    pr = cur.fetchone()

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('lantern_issued', 'Фонарь %s + СС %s — выдан %s', %d)
    """ % (l_row[0], l_row[1] or '—', pr[0].replace("'", "''"), int(person_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Фонарь %s и самоспасатель %s выданы — %s' % (l_row[0], l_row[1] or '—', pr[0]),
        'lantern': l_row[0], 'rescuer': l_row[1], 'person': pr[0]
    })

def issue_by_code(body):
    raw_code = body.get('code', '').strip()
    lantern_id = body.get('lantern_id')

    if not raw_code or not lantern_id:
        return json_response(400, {'error': 'Код сотрудника и ID фонаря обязательны'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id FROM personnel
        WHERE (personal_code = '%s' OR qr_code = '%s') AND status != 'archived'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    return issue_lantern({'lantern_id': lantern_id, 'person_id': row[0]})

def return_lantern(body):
    lantern_id = body.get('lantern_id')
    condition = body.get('condition', 'normal')

    if not lantern_id:
        return json_response(400, {'error': 'ID фонаря обязателен'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT l.lantern_number, l.rescuer_number, p.full_name, l.assigned_to
        FROM lanterns l LEFT JOIN personnel p ON l.assigned_to = p.id
        WHERE l.id = %d
    """ % int(lantern_id))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Фонарь не найден'})

    new_status = 'charging' if condition == 'normal' else 'available'
    cur.execute("""
        UPDATE lanterns SET status = '%s', assigned_to = NULL, returned_at = NOW(), condition = '%s'
        WHERE id = %d
    """ % (new_status, condition.replace("'", "''"), int(lantern_id)))

    person_name = row[2] or 'неизвестный'
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('lantern_returned', 'Фонарь %s + СС %s — возвращён %s (%s)', %s)
    """ % (row[0], row[1] or '—', person_name.replace("'", "''"), condition, str(row[3]) if row[3] else 'NULL'))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Фонарь %s принят' % row[0], 'lantern': row[0], 'person': person_name})

def get_messages(params):
    limit = int(params.get('limit', '50'))
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, sender_name, sender_role, message, is_urgent, created_at
        FROM dispatcher_messages
        ORDER BY created_at DESC LIMIT %d
    """ % min(limit, 200))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    msgs = []
    for r in rows:
        msgs.append({
            'id': r[0], 'sender_name': r[1], 'sender_role': r[2],
            'message': r[3], 'is_urgent': r[4], 'created_at': r[5]
        })

    return json_response(200, {'messages': msgs})

def send_message(body):
    sender_name = body.get('sender_name', '').strip()
    message = body.get('message', '').strip()
    is_urgent = body.get('is_urgent', False)

    if not sender_name or not message:
        return json_response(400, {'error': 'Имя и сообщение обязательны'})

    safe_name = sender_name.replace("'", "''")
    safe_msg = message.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO dispatcher_messages (sender_name, message, is_urgent)
        VALUES ('%s', '%s', %s) RETURNING id, created_at
    """ % (safe_name, safe_msg, 'TRUE' if is_urgent else 'FALSE'))
    row = cur.fetchone()

    if is_urgent:
        cur.execute("""
            INSERT INTO notifications (type, title, message, person_name)
            VALUES ('urgent_message', 'Срочное сообщение', '%s: %s', '%s')
        """ % (safe_name, safe_msg[:100], safe_name))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'id': row[0], 'created_at': row[1], 'message': 'Отправлено'})

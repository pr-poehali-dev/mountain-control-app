import json
import os
from datetime import datetime, date as date_type
import psycopg2


def caller_is_admin(event):
    """Цифровой код сотрудников видит только администратор (не в демо-режиме)"""
    headers = event.get('headers') or {}
    params = event.get('queryStringParameters') or {}
    if headers.get('X-Demo', headers.get('x-demo', '')) == 'true' or params.get('demo') == '1':
        return False
    token = ''
    for key in ['X-Authorization', 'x-authorization', 'Authorization', 'authorization']:
        val = headers.get(key, '')
        if val:
            token = val[7:] if val.startswith('Bearer ') else val
            break
    if not token:
        token = params.get('auth', '')
    if not token:
        return False
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute("""
        SELECT 1 FROM users u JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE AND u.role = 'admin'
    """ % token.replace("'", "''"))
    ok = cur.fetchone() is not None
    cur.close()
    conn.close()
    return ok

def is_demo_request(event):
    headers = event.get('headers') or {}
    return headers.get('X-Demo', headers.get('x-demo', '')) == 'true'

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


CODE_KEYS = ('personal_code', 'person_code')
HIDE_CODES = {'on': False}


def strip_codes(obj):
    if isinstance(obj, dict):
        return {k: ('' if k in CODE_KEYS else strip_codes(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [strip_codes(v) for v in obj]
    return obj

def json_response(status, body):
    if HIDE_CODES['on']:
        body = strip_codes(body)
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization, X-Demo'
        },
        'body': json.dumps(body, ensure_ascii=False, default=serialize_default)
    }

def handler(event, context):
    """Сканирование QR-кодов и личных кодов — идентификация и отметка персонала"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')
    HIDE_CODES['on'] = not caller_is_admin(event)

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'POST' and action == 'identify':
        return identify(body)
    elif method == 'POST' and action == 'checkin':
        return checkin(body)
    elif method == 'GET' and action == 'recent':
        return get_recent(event)
    elif method == 'GET' and action == 'me':
        return my_card(event)

    return json_response(404, {'error': 'Маршрут не найден'})

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

PERSON_SQL = """
    SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
           p.category, p.status, p.medical_status, p.room, p.shift,
           p.organization, p.organization_type,
           COALESCE(b.name, ''), COALESCE(b.number, ''), COALESCE(r.room_number, ''), r.floor, COALESCE(r.name, ''),
           COALESCE(p.residence, ''), COALESCE(p.phone, ''), COALESCE(p.tab_number, ''), COALESCE(p.photo_url, ''),
           COALESCE(p.pass_number, ''), p.pass_permanent, p.pass_valid_from, p.pass_valid_to, COALESCE(p.inspection_mode, 'general'),
           p.vehicle_pass_number, p.vehicle_number, p.vehicle_brand, p.vehicle_pass_permanent,
           p.vehicle_pass_valid_from, p.vehicle_pass_valid_to
    FROM personnel p
    LEFT JOIN rooms r ON r.id = p.residence_room_id
    LEFT JOIN buildings b ON b.id = COALESCE(r.building_id, p.residence_building_id)
    WHERE %s AND p.status != 'archived'
    ORDER BY p.id DESC
    LIMIT 1
"""

CATEGORY_LABELS = {
    'mine': 'Рудничный', 'contractor': 'Подрядчик',
    'business_trip': 'Командированный', 'guest': 'Гость', 'user': 'Пользователь'
}
STATUS_LABELS = {
    'on_shift': 'На смене', 'arrived': 'Прибыл', 'departed': 'Убыл',
    'business_trip': 'Командировка', 'active': 'Активен'
}
MEDICAL_LABELS = {
    'passed': 'Пройден', 'failed': 'Не пройден',
    'pending': 'Ожидает', 'expiring': 'Истекает'
}
ORG_TYPE_LABELS = {
    'rudnik': 'Рудник', 'guest': 'Гость',
    'contractor': 'Подрядная организация', 'gov': 'Гос.органы'
}
INSPECTION_LABELS = {'general': 'Досмотр на общих основаниях', 'none': 'Без досмотра'}


def iso(d):
    return d.isoformat() if d else ''


def pass_state(number, permanent, d_from, d_to):
    today = date_type.today()
    if not number and not permanent and not d_from and not d_to:
        return 'none'
    if permanent:
        return 'active'
    if d_to and d_to < today:
        return 'expired'
    if d_from and d_from > today:
        return 'future'
    return 'active'


def person_from_row(row):
    medical_ok = row[7] in ('passed', 'expiring')
    return {
        'id': row[0],
        'personal_code': row[1],
        'full_name': row[2],
        'position': row[3] or '',
        'department': row[4] or '',
        'category': CATEGORY_LABELS.get(row[5], row[5]),
        'status': STATUS_LABELS.get(row[6], row[6]),
        'medical_status': MEDICAL_LABELS.get(row[7], row[7]),
        'medical_ok': medical_ok,
        'room': row[14] or row[8] or '—',
        'shift': row[9] or '—',
        'organization': row[10] or '',
        'organization_type': ORG_TYPE_LABELS.get(row[11] or '', row[11] or ''),
        'housing': {
            'building': row[12], 'building_number': row[13],
            'room': row[14] or row[8] or '', 'floor': row[15], 'room_name': row[16],
            'residence': row[17]
        },
        'phone': row[18], 'tab_number': row[19], 'photo_url': row[20],
        'personal_pass': {
            'number': row[21], 'permanent': bool(row[22]),
            'valid_from': iso(row[23]), 'valid_to': iso(row[24]),
            'inspection': INSPECTION_LABELS.get(row[25], row[25]),
            'state': pass_state(row[21], row[22], row[23], row[24])
        },
        'vehicle_pass': {
            'number': row[26] or '', 'vehicle_number': row[27] or '', 'vehicle_brand': row[28] or '',
            'permanent': bool(row[29]), 'valid_from': iso(row[30]), 'valid_to': iso(row[31]),
            'state': pass_state((row[26] or '') + (row[27] or ''), row[29], row[30], row[31])
        }
    }


def identify(body):
    raw_code = body.get('code', '').strip()
    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)

    conn = get_db()
    cur = conn.cursor()

    safe_code = code.replace("'", "''")
    cur.execute(PERSON_SQL % ("(p.personal_code = '%s' OR p.qr_code = '%s')" % (safe_code, safe_code)))
    row = cur.fetchone()
    person = person_from_row(row) if row else None

    if not person:
        cur.execute("""
            SELECT u.id, u.personal_code, u.full_name, u.position, u.department,
                   u.organization, u.organization_type, COALESCE(u.photo_url, '')
            FROM users u
            WHERE u.personal_code = '%s' OR u.qr_code = '%s'
            LIMIT 1
        """ % (safe_code, safe_code))
        u = cur.fetchone()
        if u:
            empty_pass = {'number': '', 'permanent': False, 'valid_from': '', 'valid_to': '', 'state': 'none'}
            person = {
                'id': u[0], 'personal_code': u[1], 'full_name': u[2],
                'position': u[3] or '', 'department': u[4] or '',
                'category': CATEGORY_LABELS['user'], 'status': STATUS_LABELS['active'],
                'medical_status': MEDICAL_LABELS['passed'], 'medical_ok': True,
                'room': '—', 'shift': '—',
                'organization': u[5] or '', 'organization_type': ORG_TYPE_LABELS.get(u[6] or '', u[6] or ''),
                'housing': {'building': '', 'building_number': '', 'room': '', 'floor': None, 'room_name': '', 'residence': ''},
                'phone': '', 'tab_number': '', 'photo_url': u[7],
                'personal_pass': dict(empty_pass, inspection=''),
                'vehicle_pass': dict(empty_pass, vehicle_number='', vehicle_brand='')
            }

    cur.close()
    conn.close()

    if not person:
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    return json_response(200, {'person': person})

def get_token(event):
    headers = event.get('headers') or {}
    for key in ['X-Authorization', 'x-authorization', 'Authorization', 'authorization']:
        val = headers.get(key, '')
        if val:
            return val[7:] if val.startswith('Bearer ') else val
    return ''


def my_card(event):
    """Полная карточка текущего сотрудника для личного кабинета"""
    HIDE_CODES['on'] = False
    token = get_token(event)
    if not token:
        return json_response(401, {'error': 'Требуется авторизация'})
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.personal_code, u.qr_code FROM users u JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE
    """ % token.replace("'", "''"))
    u = cur.fetchone()
    if not u:
        cur.close()
        conn.close()
        return json_response(401, {'error': 'Сессия истекла'})
    code = str(u[0] or '').replace("'", "''")
    qr = str(u[1] or '').replace("'", "''")
    cur.execute(PERSON_SQL % ("(p.personal_code = '%s' OR (p.qr_code <> '' AND p.qr_code = '%s'))" % (code, qr)))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return json_response(200, {'person': person_from_row(row) if row else None})


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
        cur.execute("""
            UPDATE rooms r SET occupied = s.cnt,
                status = CASE WHEN s.cnt = 0 THEN 'free' WHEN s.cnt >= r.capacity THEN 'full' ELSE 'partial' END
            FROM (SELECT r2.id, COUNT(p.id) AS cnt FROM rooms r2
                  LEFT JOIN personnel p ON p.residence_room_id = r2.id
                    AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE
                  GROUP BY r2.id) s
            WHERE s.id = r.id
        """)

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

def get_recent(event):
    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'

    cur.execute("""
        SELECT e.id, e.event_type, e.description, e.created_at,
               p.full_name, p.personal_code
        FROM events e
        LEFT JOIN personnel p ON e.personnel_id = p.id
        WHERE e.event_type IN ('scan_checkin', 'scan_denied')
        AND (p.id IS NULL OR p.is_demo_data = %s)
        ORDER BY e.created_at DESC
        LIMIT 20
    """ % demo_val)
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
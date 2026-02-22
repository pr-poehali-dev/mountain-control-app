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
    """Ламповая — выдача и приём фонарей и самоспасателей, учёт недопусков"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = {}
    if event.get('body'):
        body = json.loads(event['body'])

    if method == 'GET' and action == 'list':
        return get_issues(params)
    elif method == 'GET' and action == 'stats':
        return get_stats()
    elif method == 'GET' and action == 'detail':
        return get_detail(params)
    elif method == 'GET' and action == 'search':
        return search_person(params)
    elif method == 'GET' and action == 'denials':
        return get_denials(params)
    elif method == 'POST' and action == 'identify':
        return identify_person(body)
    elif method == 'POST' and action == 'issue':
        return issue_item(body)
    elif method == 'POST' and action == 'return':
        return return_item(body)
    elif method == 'POST' and action == 'deny':
        return deny_person(body)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_issues(params):
    status_filter = params.get('status', '')
    date_filter = params.get('date', '')
    item_type_filter = params.get('item_type', '')
    conn = get_db()
    cur = conn.cursor()

    conditions = []
    if status_filter and status_filter in ('issued', 'returned'):
        conditions.append("i.status = '%s'" % status_filter)
    if date_filter:
        safe_date = date_filter.replace("'", "''")
        conditions.append("i.issued_at::date = '%s'" % safe_date)
    if item_type_filter and item_type_filter in ('lantern', 'rescuer', 'both'):
        if item_type_filter == 'lantern':
            conditions.append("i.item_type IN ('lantern', 'both')")
        elif item_type_filter == 'rescuer':
            conditions.append("i.item_type IN ('rescuer', 'both')")
        else:
            conditions.append("i.item_type = 'both'")

    where = ""
    if conditions:
        where = "WHERE " + " AND ".join(conditions)

    cur.execute("""
        SELECT i.id, i.person_code, i.person_name, i.item_type,
               i.lantern_number, i.rescuer_number, i.status,
               i.issued_at, i.returned_at, i.condition, i.notes, i.issued_by,
               i.tabular_number, p.position, p.department, p.organization
        FROM lamp_room_issues i
        LEFT JOIN personnel p ON i.person_id = p.id
        %s
        ORDER BY i.issued_at DESC
        LIMIT 300
    """ % where)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'person_code': r[1], 'person_name': r[2],
            'item_type': r[3], 'lantern_number': r[4], 'rescuer_number': r[5],
            'status': r[6], 'issued_at': r[7], 'returned_at': r[8],
            'condition': r[9], 'notes': r[10], 'issued_by': r[11],
            'tabular_number': r[12] or '', 'position': r[13] or '',
            'department': r[14] or '', 'organization': r[15] or ''
        })

    return json_response(200, {'issues': items, 'total': len(items)})

def get_detail(params):
    detail_type = params.get('type', '')
    conn = get_db()
    cur = conn.cursor()

    if detail_type == 'lanterns_out':
        cur.execute("""
            SELECT i.id, i.person_code, i.person_name, i.lantern_number, i.rescuer_number,
                   i.issued_at, i.issued_by, i.tabular_number,
                   p.position, p.department, p.organization
            FROM lamp_room_issues i
            LEFT JOIN personnel p ON i.person_id = p.id
            WHERE i.status = 'issued' AND i.item_type IN ('lantern', 'both')
            ORDER BY i.issued_at DESC
        """)
    elif detail_type == 'rescuers_out':
        cur.execute("""
            SELECT i.id, i.person_code, i.person_name, i.lantern_number, i.rescuer_number,
                   i.issued_at, i.issued_by, i.tabular_number,
                   p.position, p.department, p.organization
            FROM lamp_room_issues i
            LEFT JOIN personnel p ON i.person_id = p.id
            WHERE i.status = 'issued' AND i.item_type IN ('rescuer', 'both')
            ORDER BY i.issued_at DESC
        """)
    elif detail_type == 'today_issued':
        cur.execute("""
            SELECT i.id, i.person_code, i.person_name, i.lantern_number, i.rescuer_number,
                   i.issued_at, i.issued_by, i.tabular_number,
                   p.position, p.department, p.organization
            FROM lamp_room_issues i
            LEFT JOIN personnel p ON i.person_id = p.id
            WHERE i.issued_at::date = CURRENT_DATE
            ORDER BY i.issued_at DESC
        """)
    elif detail_type == 'today_returned':
        cur.execute("""
            SELECT i.id, i.person_code, i.person_name, i.lantern_number, i.rescuer_number,
                   i.returned_at, i.issued_by, i.tabular_number,
                   p.position, p.department, p.organization
            FROM lamp_room_issues i
            LEFT JOIN personnel p ON i.person_id = p.id
            WHERE i.returned_at::date = CURRENT_DATE
            ORDER BY i.returned_at DESC
        """)
    elif detail_type == 'denials':
        cur.execute("""
            SELECT d.id, d.person_code, d.person_name, d.reason, d.denied_at, d.denied_by, d.tabular_number
            FROM lamp_room_denials d
            WHERE d.denied_at::date = CURRENT_DATE
            ORDER BY d.denied_at DESC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        items = []
        for r in rows:
            items.append({
                'id': r[0], 'person_code': r[1], 'person_name': r[2],
                'reason': r[3], 'denied_at': r[4], 'denied_by': r[5],
                'tabular_number': r[6] or ''
            })
        return json_response(200, {'items': items, 'total': len(items), 'type': 'denials'})
    else:
        cur.execute("""
            SELECT i.id, i.person_code, i.person_name, i.lantern_number, i.rescuer_number,
                   i.issued_at, i.issued_by, i.tabular_number,
                   p.position, p.department, p.organization
            FROM lamp_room_issues i
            LEFT JOIN personnel p ON i.person_id = p.id
            WHERE i.status = 'issued'
            ORDER BY i.issued_at DESC
        """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'person_code': r[1], 'person_name': r[2],
            'lantern_number': r[3], 'rescuer_number': r[4],
            'time': r[5], 'issued_by': r[6], 'tabular_number': r[7] or '',
            'position': r[8] or '', 'department': r[9] or '', 'organization': r[10] or ''
        })

    return json_response(200, {'items': items, 'total': len(items), 'type': detail_type})

def get_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM lamp_room_issues WHERE status = 'issued'")
    active = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lamp_room_issues WHERE status = 'issued' AND item_type IN ('lantern', 'both')")
    lanterns_out = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lamp_room_issues WHERE status = 'issued' AND item_type IN ('rescuer', 'both')")
    rescuers_out = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lamp_room_issues WHERE issued_at::date = CURRENT_DATE")
    today_issued = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lamp_room_issues WHERE returned_at::date = CURRENT_DATE")
    today_returned = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lamp_room_denials WHERE denied_at::date = CURRENT_DATE")
    today_denied = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'active': active,
        'lanterns_out': lanterns_out,
        'rescuers_out': rescuers_out,
        'today_issued': today_issued,
        'today_returned': today_returned,
        'today_denied': today_denied
    })

def search_person(params):
    q = params.get('q', '').strip()
    if not q:
        return json_response(400, {'error': 'Введите запрос'})

    safe_q = q.replace("'", "''")
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
               p.medical_status, p.organization, p.tabular_number
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
            'organization': r[6], 'tabular_number': r[7] or ''
        })

    return json_response(200, {'results': results})

def identify_person(body):
    raw_code = body.get('code', '').strip()
    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
               p.medical_status, p.organization, p.category, p.tabular_number
        FROM personnel p
        WHERE (p.personal_code = '%s' OR p.qr_code = '%s') AND p.status != 'archived'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден по коду: %s' % code})

    cur.execute("""
        SELECT id, item_type, lantern_number, rescuer_number, issued_at
        FROM lamp_room_issues
        WHERE person_id = %d AND status = 'issued'
        ORDER BY issued_at DESC
    """ % row[0])
    active_issues = []
    for ai in cur.fetchall():
        active_issues.append({
            'id': ai[0], 'item_type': ai[1],
            'lantern_number': ai[2], 'rescuer_number': ai[3],
            'issued_at': ai[4]
        })

    cur.close()
    conn.close()

    return json_response(200, {
        'person': {
            'id': row[0], 'personal_code': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4], 'medical_status': row[5],
            'organization': row[6], 'category': row[7], 'tabular_number': row[8] or ''
        },
        'active_issues': active_issues
    })

def issue_item(body):
    person_id = body.get('person_id')
    item_type = body.get('item_type', 'both')
    lantern_number = body.get('lantern_number', '').strip()
    rescuer_number = body.get('rescuer_number', '').strip()
    issued_by = body.get('issued_by', '')

    if not person_id:
        return json_response(400, {'error': 'Сотрудник не указан'})

    if item_type not in ('lantern', 'rescuer', 'both'):
        return json_response(400, {'error': 'Неверный тип оборудования'})

    if item_type in ('lantern', 'both') and not lantern_number:
        return json_response(400, {'error': 'Укажите номер фонаря'})

    if item_type in ('rescuer', 'both') and not rescuer_number:
        return json_response(400, {'error': 'Укажите номер самоспасателя'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, personal_code, full_name, medical_status, tabular_number FROM personnel WHERE id = %d AND status != 'archived'" % int(person_id))
    p = cur.fetchone()
    if not p:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})

    if p[3] != 'passed':
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Медосмотр не пройден — выдача запрещена. Статус: %s' % (p[3] or 'не пройден')})

    safe_ln = (lantern_number or '').replace("'", "''")
    safe_rn = (rescuer_number or '').replace("'", "''")
    safe_name = p[2].replace("'", "''")
    safe_code = p[1].replace("'", "''")
    safe_by = (issued_by or '').replace("'", "''")
    safe_tab = (p[4] or '').replace("'", "''")

    cur.execute("""
        INSERT INTO lamp_room_issues (person_id, person_code, person_name, item_type, lantern_number, rescuer_number, issued_by, tabular_number)
        VALUES (%d, '%s', '%s', '%s', %s, %s, '%s', '%s')
        RETURNING id
    """ % (
        int(person_id), safe_code, safe_name, item_type,
        ("'%s'" % safe_ln) if lantern_number else 'NULL',
        ("'%s'" % safe_rn) if rescuer_number else 'NULL',
        safe_by, safe_tab
    ))
    issue_id = cur.fetchone()[0]

    parts = []
    if item_type in ('lantern', 'both'):
        parts.append('Фонарь %s' % lantern_number)
    if item_type in ('rescuer', 'both'):
        parts.append('СС %s' % rescuer_number)
    desc = '%s — выдано %s' % (' + '.join(parts), p[2])

    safe_desc = desc.replace("'", "''")
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('lamp_room_issue', '%s', %d)
    """ % (safe_desc, int(person_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Выдано: %s → %s' % (' + '.join(parts), p[2]),
        'issue_id': issue_id
    })

def return_item(body):
    issue_id = body.get('issue_id')
    condition = body.get('condition', 'normal')

    if not issue_id:
        return json_response(400, {'error': 'ID выдачи не указан'})

    safe_cond = condition.replace("'", "''")
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, person_name, item_type, lantern_number, rescuer_number FROM lamp_room_issues WHERE id = %d AND status = 'issued'" % int(issue_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Запись о выдаче не найдена или уже возвращено'})

    cur.execute("""
        UPDATE lamp_room_issues SET status = 'returned', returned_at = NOW(), condition = '%s'
        WHERE id = %d
    """ % (safe_cond, int(issue_id)))

    parts = []
    if row[2] in ('lantern', 'both') and row[3]:
        parts.append('Фонарь %s' % row[3])
    if row[2] in ('rescuer', 'both') and row[4]:
        parts.append('СС %s' % row[4])
    desc = '%s — возврат от %s' % (' + '.join(parts), row[1])

    safe_desc = desc.replace("'", "''")
    cur.execute("""
        INSERT INTO events (event_type, description)
        VALUES ('lamp_room_return', '%s')
    """ % safe_desc)

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Принято: %s от %s' % (' + '.join(parts), row[1])
    })

def deny_person(body):
    person_id = body.get('person_id')
    person_code = body.get('person_code', '')
    person_name = body.get('person_name', '')
    reason = body.get('reason', '').strip()
    denied_by = body.get('denied_by', '')

    if not reason:
        return json_response(400, {'error': 'Укажите причину недопуска'})

    if not person_code and not person_name:
        return json_response(400, {'error': 'Укажите данные сотрудника'})

    safe_code = person_code.replace("'", "''")
    safe_name = person_name.replace("'", "''")
    safe_reason = reason.replace("'", "''")
    safe_by = (denied_by or '').replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    tab_num = ''
    person_id_val = 'NULL'
    if person_id and int(person_id) > 0:
        person_id_val = str(int(person_id))
        cur.execute("SELECT tabular_number FROM personnel WHERE id = %s" % person_id_val)
        tr = cur.fetchone()
        if tr:
            tab_num = (tr[0] or '').replace("'", "''")

    cur.execute("""
        INSERT INTO lamp_room_denials (person_id, person_code, person_name, reason, denied_by, tabular_number)
        VALUES (%s, '%s', '%s', '%s', '%s', '%s')
        RETURNING id
    """ % (person_id_val, safe_code, safe_name, safe_reason, safe_by, tab_num))
    denial_id = cur.fetchone()[0]

    desc = 'Недопуск: %s (%s) — %s' % (safe_name, safe_code, safe_reason)
    cur.execute("""
        INSERT INTO events (event_type, description)
        VALUES ('lamp_room_denial', '%s')
    """ % desc[:500])

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Недопуск зафиксирован: %s — %s' % (person_name, reason),
        'denial_id': denial_id
    })

def get_denials(params):
    date_filter = params.get('date', '')
    conn = get_db()
    cur = conn.cursor()

    where = ""
    if date_filter:
        safe_date = date_filter.replace("'", "''")
        where = "WHERE d.denied_at::date = '%s'" % safe_date

    cur.execute("""
        SELECT d.id, d.person_code, d.person_name, d.reason, d.denied_at, d.denied_by, d.tabular_number
        FROM lamp_room_denials d
        %s
        ORDER BY d.denied_at DESC
        LIMIT 100
    """ % where)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'person_code': r[1], 'person_name': r[2],
            'reason': r[3], 'denied_at': r[4], 'denied_by': r[5],
            'tabular_number': r[6] or ''
        })

    return json_response(200, {'denials': items, 'total': len(items)})

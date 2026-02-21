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

def handler(event, context):
    """Управление персоналом рудника — список, добавление, обновление статусов"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and action in ('list', ''):
        return get_personnel(params)
    elif method == 'GET' and action == 'stats':
        return get_stats()
    elif method == 'POST' and action == 'add':
        return add_person(body)
    elif method == 'PUT' and action == 'status':
        return update_status(body)
    elif method == 'PUT' and action == 'edit':
        return edit_person(body)
    elif method == 'GET' and action == 'history':
        return get_history(params)
    elif method == 'GET' and action == 'search':
        return search_personnel(params)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_personnel(params):
    conn = get_db()
    cur = conn.cursor()

    category = params.get('category', '')
    status = params.get('status', '')
    shift = params.get('shift', '')

    org_type = params.get('organization_type', '')

    query = """
        SELECT id, personal_code, full_name, position, department, category, 
               phone, room, status, qr_code, medical_status, shift, created_at,
               organization, organization_type
        FROM personnel WHERE status != 'archived' AND is_hidden = FALSE
    """
    if category:
        query += " AND category = '%s'" % category.replace("'", "''")
    if status:
        query += " AND status = '%s'" % status.replace("'", "''")
    if shift:
        query += " AND shift = '%s'" % shift.replace("'", "''")
    if org_type:
        query += " AND organization_type = '%s'" % org_type.replace("'", "''")
    query += " ORDER BY full_name"

    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    personnel = []
    for r in rows:
        personnel.append({
            'id': r[0], 'personal_code': r[1], 'full_name': r[2],
            'position': r[3], 'department': r[4], 'category': r[5],
            'phone': r[6], 'room': r[7], 'status': r[8],
            'qr_code': r[9], 'medical_status': r[10], 'shift': r[11],
            'created_at': r[12], 'organization': r[13] or '',
            'organization_type': r[14] or ''
        })

    return json_response(200, {'personnel': personnel, 'total': len(personnel)})

def get_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE")
    total = cur.fetchone()[0]

    cur.execute("SELECT category, COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE GROUP BY category")
    by_category = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT status, COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT medical_status, COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE GROUP BY medical_status")
    by_medical = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COALESCE(organization_type, ''), COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE GROUP BY COALESCE(organization_type, '')")
    by_org_type = {}
    for r in cur.fetchall():
        key = r[0] if r[0] else 'unknown'
        by_org_type[key] = r[1]

    cur.execute("SELECT COALESCE(organization, ''), COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE AND organization != '' GROUP BY organization ORDER BY COUNT(*) DESC LIMIT 20")
    by_org = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) FROM rooms")
    total_rooms = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM rooms WHERE occupied > 0")
    occupied_rooms = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(capacity), 0) FROM rooms")
    total_beds = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(occupied), 0) FROM rooms")
    occupied_beds = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'total': total,
        'by_category': by_category,
        'by_status': by_status,
        'by_medical': by_medical,
        'by_org_type': by_org_type,
        'by_organization': by_org,
        'housing': {
            'total_rooms': total_rooms,
            'occupied_rooms': occupied_rooms,
            'total_beds': total_beds,
            'occupied_beds': occupied_beds
        }
    })

def add_person(body):
    full_name = body.get('full_name', '').strip()
    position = body.get('position', '').strip()
    department = body.get('department', '').strip()
    category = body.get('category', 'mine')
    phone = body.get('phone', '').strip()
    room = body.get('room', '')
    shift = body.get('shift', '')
    organization = body.get('organization', '').strip()
    organization_type = body.get('organization_type', '').strip()

    if not full_name:
        return json_response(400, {'error': 'ФИО обязательно'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM personnel")
    next_id = cur.fetchone()[0]
    personal_code = 'МК-%03d' % next_id
    qr_code = 'QR-MK-%03d' % next_id

    cur.execute("""
        INSERT INTO personnel (personal_code, full_name, position, department, category, phone, room, status, qr_code, shift, organization, organization_type, medical_status)
        VALUES ('%s', '%s', '%s', '%s', '%s', '%s', '%s', 'arrived', '%s', '%s', '%s', '%s', 'pending')
        RETURNING id, personal_code, qr_code
    """ % (
        personal_code,
        full_name.replace("'", "''"),
        position.replace("'", "''"),
        department.replace("'", "''"),
        category.replace("'", "''"),
        phone.replace("'", "''"),
        str(room).replace("'", "''"),
        qr_code,
        str(shift).replace("'", "''"),
        organization.replace("'", "''"),
        organization_type.replace("'", "''")
    ))
    row = cur.fetchone()

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('arrival', '%s — добавлен в систему', %d)
    """ % (full_name.replace("'", "''"), row[0]))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'id': row[0],
        'personal_code': row[1],
        'qr_code': row[2],
        'message': 'Сотрудник добавлен'
    })

def update_status(body):
    person_id = body.get('id')
    new_status = body.get('status', '')

    if not person_id or not new_status:
        return json_response(400, {'error': 'ID и статус обязательны'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE personnel SET status = '%s', updated_at = NOW()
        WHERE id = %d RETURNING full_name
    """ % (new_status.replace("'", "''"), int(person_id)))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})

    status_labels = {
        'on_shift': 'вышел на смену',
        'arrived': 'прибыл',
        'departed': 'убыл',
        'business_trip': 'командировка'
    }
    label = status_labels.get(new_status, new_status)

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('status_change', '%s — %s', %d)
    """ % (row[0].replace("'", "''"), label, int(person_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Статус обновлён'})

def search_personnel(params):
    query_str = params.get('q', '').strip()
    if not query_str:
        return json_response(400, {'error': 'Введите поисковый запрос'})

    conn = get_db()
    cur = conn.cursor()

    safe_q = query_str.replace("'", "''")
    cur.execute("""
        SELECT id, personal_code, full_name, position, department, category, 
               room, status, qr_code, medical_status, organization, organization_type
        FROM personnel
        WHERE status != 'archived' AND (full_name ILIKE '%%%s%%' OR personal_code ILIKE '%%%s%%' 
              OR department ILIKE '%%%s%%' OR qr_code ILIKE '%%%s%%'
              OR organization ILIKE '%%%s%%')
        ORDER BY full_name LIMIT 20
    """ % (safe_q, safe_q, safe_q, safe_q, safe_q))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    results = []
    for r in rows:
        results.append({
            'id': r[0], 'personal_code': r[1], 'full_name': r[2],
            'position': r[3], 'department': r[4], 'category': r[5],
            'room': r[6], 'status': r[7], 'qr_code': r[8], 'medical_status': r[9],
            'organization': r[10] or '', 'organization_type': r[11] or ''
        })

    return json_response(200, {'results': results, 'total': len(results)})

def edit_person(body):
    person_id = body.get('id')
    if not person_id:
        return json_response(400, {'error': 'ID обязателен'})

    fields = {}
    for key in ('full_name', 'position', 'department', 'category', 'phone', 'room', 'shift', 'status', 'medical_status', 'organization', 'organization_type'):
        if key in body:
            fields[key] = str(body[key]).strip()

    if not fields:
        return json_response(400, {'error': 'Нет полей для обновления'})

    conn = get_db()
    cur = conn.cursor()

    new_medical = fields.get('medical_status', '')

    cur.execute("SELECT full_name, medical_status FROM personnel WHERE id = %d AND status != 'archived'" % int(person_id))
    old_row = cur.fetchone()
    if not old_row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})

    person_name = old_row[0]
    old_medical = old_row[1] or 'pending'

    set_parts = []
    for key, val in fields.items():
        set_parts.append("%s = '%s'" % (key, val.replace("'", "''")))
    set_parts.append("updated_at = NOW()")

    cur.execute("""
        UPDATE personnel SET %s WHERE id = %d
    """ % (', '.join(set_parts), int(person_id)))

    if new_medical and new_medical != old_medical:
        medical_labels = {'passed': 'пройден', 'failed': 'не пройден', 'pending': 'ожидает'}
        old_label = medical_labels.get(old_medical, old_medical)
        new_label = medical_labels.get(new_medical, new_medical)

        if new_medical == 'passed':
            check_status = 'passed'
            event_type = 'medical_pass'
            notes = 'Ручное изменение: %s -> %s' % (old_label, new_label)
            cur.execute("""
                INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes, shift_type, check_direction, shift_date)
                VALUES (%d, 'manual', 'passed', '', 0, 0, 0, 'Редактирование', '%s', '', '', CURRENT_DATE)
            """ % (int(person_id), notes.replace("'", "''")))
        elif new_medical == 'failed':
            check_status = 'failed'
            event_type = 'medical_fail'
            notes = 'Ручное изменение: %s -> %s' % (old_label, new_label)
            cur.execute("""
                INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes, shift_type, check_direction, shift_date)
                VALUES (%d, 'manual', 'failed', '', 0, 0, 0, 'Редактирование', '%s', '', '', CURRENT_DATE)
            """ % (int(person_id), notes.replace("'", "''")))
        else:
            event_type = 'medical_reset'

        cur.execute("""
            INSERT INTO events (event_type, description, personnel_id)
            VALUES ('%s', '%s — медосмотр изменён: %s → %s', %d)
        """ % (event_type, person_name.replace("'", "''"), old_label, new_label, int(person_id)))

        n_type = 'medical_deny' if new_medical == 'failed' else ('medical_pass' if new_medical == 'passed' else 'medical_change')
        n_title = 'Медосмотр изменён' if new_medical == 'passed' else ('Отказ в медосмотре' if new_medical == 'failed' else 'Статус медосмотра сброшен')
        safe_pname = person_name.replace("'", "''")
        cur.execute("""
            INSERT INTO notifications (type, title, message, person_name, person_code)
            VALUES ('%s', '%s', '%s — %s → %s (ручное изменение)', '%s', '%s')
        """ % (n_type, n_title, safe_pname, old_label, new_label, safe_pname, ''))

    changed = ', '.join(fields.keys())
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('edit', '%s — изменены данные (%s)', %d)
    """ % (person_name.replace("'", "''"), changed, int(person_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Данные обновлены'})

def get_history(params):
    person_id = params.get('id', '')
    if not person_id:
        return json_response(400, {'error': 'ID обязателен'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, event_type, description, created_at
        FROM events
        WHERE personnel_id = %d
        ORDER BY created_at DESC
        LIMIT 50
    """ % int(person_id))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    type_labels = {
        'scan_checkin': 'КПП — отмечен',
        'scan_denied': 'КПП — отказ',
        'medical_pass': 'Медосмотр пройден',
        'medical_fail': 'Медосмотр не пройден',
        'arrival': 'Прибытие',
        'departure': 'Убытие',
        'status_change': 'Смена статуса',
        'edit': 'Изменение данных',
        'shift_start': 'Начало смены',
        'lantern_issued': 'Выдан фонарь',
        'lantern_returned': 'Возвращён фонарь'
    }

    events = []
    for r in rows:
        events.append({
            'id': r[0],
            'type': r[1],
            'type_label': type_labels.get(r[1], r[1]),
            'description': r[2],
            'created_at': r[3]
        })

    return json_response(200, {'events': events})
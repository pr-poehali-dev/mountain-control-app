import base64
import secrets
import json
import os
from datetime import datetime, date as date_type
import psycopg2

PROTECTED_CODE = 'АД-001'

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

def json_response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization, X-Demo'
        },
        'body': json.dumps(body, ensure_ascii=False, default=serialize_default)
    }


def sync_rooms(cur):
    """Пересчитывает занятость и статус комнат по проживающим на предприятии"""
    cur.execute("""
        UPDATE rooms r SET occupied = s.cnt,
            status = CASE WHEN s.cnt = 0 THEN 'free' WHEN s.cnt >= r.capacity THEN 'full' ELSE 'partial' END
        FROM (SELECT r2.id, COUNT(p.id) AS cnt FROM rooms r2
              LEFT JOIN personnel p ON p.residence_room_id = r2.id
                AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE
              GROUP BY r2.id) s
        WHERE s.id = r.id
    """)


def log_housing(cur, pid, old_rid, new_rid, source):
    """Записывает заселение / переселение / выселение в историю проживания"""
    old_rid = int(old_rid) if old_rid else None
    new_rid = int(new_rid) if new_rid else None
    if not pid or old_rid == new_rid:
        return

    def info(rid):
        if not rid:
            return (None, '', '')
        cur.execute("SELECT b.id, b.name, r.room_number FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE r.id = %d" % rid)
        row = cur.fetchone()
        return row if row else (None, '', '')

    ob, oname, onum = info(old_rid)
    nb, nname, nnum = info(new_rid)
    action = 'checkin' if not old_rid else ('evict' if not new_rid else 'move')
    if action == 'evict':
        nb, nname, nnum, old_rid_store = ob, oname, onum, old_rid
        prev_b, prev_r = '', ''
    else:
        old_rid_store = new_rid
        prev_b, prev_r = oname, onum
    cur.execute("""
        INSERT INTO housing_history (personnel_id, action, building_id, room_id, building_name, room_number,
                                     prev_building_name, prev_room_number, source)
        VALUES (%d, '%s', %s, %s, '%s', '%s', '%s', '%s', '%s')
    """ % (int(pid), action, int(nb) if nb else 'NULL', int(old_rid_store) if old_rid_store else 'NULL',
           (nname or '').replace("'", "''"), (nnum or '').replace("'", "''"),
           (prev_b or '').replace("'", "''"), (prev_r or '').replace("'", "''"), source.replace("'", "''")))

def handler(event, context):
    """Управление персоналом рудника — список, добавление, обновление статусов"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and action in ('list', ''):
        return get_personnel(params, event)
    elif method == 'GET' and action == 'stats':
        return get_stats(event)
    elif method == 'POST' and action == 'add':
        return add_person(body)
    elif method == 'PUT' and action == 'status':
        return update_status(body, event)
    elif method == 'PUT' and action == 'edit':
        return edit_person(body, event)
    elif method == 'GET' and action == 'history':
        return get_history(params)
    elif method == 'GET' and action == 'housing-history':
        return get_housing_history(params)
    elif method == 'POST' and action == 'photo':
        return upload_photo(body)
    elif method == 'GET' and action == 'residences':
        return get_residences(event)
    elif method == 'GET' and action == 'search':
        return search_personnel(params, event)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_personnel(params, event):
    conn = get_db()
    cur = conn.cursor()

    category = params.get('category', '')
    status = params.get('status', '')
    shift = params.get('shift', '')

    org_type = params.get('organization_type', '')

    demo_filter = "AND is_demo_data = TRUE" if is_demo_request(event) else "AND is_demo_data = FALSE"

    query = """
        SELECT id, personal_code, full_name, position, department, category, 
               phone, room, status, qr_code, medical_status, shift, created_at,
               organization, organization_type, COALESCE(tab_number, ''),
               COALESCE(residence, ''), residence_building_id, residence_room_id,
               COALESCE(pass_number, ''), pass_permanent, pass_valid_from, pass_valid_to,
               COALESCE(inspection_mode, 'general'), COALESCE(photo_url, '')
        FROM personnel WHERE status != 'archived' AND is_hidden = FALSE %s
    """ % demo_filter
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
            'organization_type': r[14] or '',
            'tab_number': r[15] or '',
            'residence': r[16] or '',
            'residence_building_id': r[17],
            'residence_room_id': r[18],
            'pass_number': r[19] or '',
            'pass_permanent': bool(r[20]),
            'pass_valid_from': r[21].isoformat() if r[21] else '',
            'pass_valid_to': r[22].isoformat() if r[22] else '',
            'inspection_mode': r[23] or 'general',
            'photo_url': r[24] or ''
        })

    return json_response(200, {'personnel': personnel, 'total': len(personnel)})

def get_stats(event):
    conn = get_db()
    cur = conn.cursor()

    demo_filter = "AND is_demo_data = TRUE" if is_demo_request(event) else "AND is_demo_data = FALSE"

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE %s" % demo_filter)
    total = cur.fetchone()[0]

    cur.execute("SELECT category, COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE %s GROUP BY category" % demo_filter)
    by_category = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT status, COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE %s GROUP BY status" % demo_filter)
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT medical_status, COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE %s GROUP BY medical_status" % demo_filter)
    by_medical = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COALESCE(organization_type, ''), COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE %s GROUP BY COALESCE(organization_type, '')" % demo_filter)
    by_org_type = {}
    for r in cur.fetchall():
        key = r[0] if r[0] else 'unknown'
        by_org_type[key] = r[1]

    cur.execute("SELECT COALESCE(organization, ''), COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE AND organization != '' %s GROUP BY organization ORDER BY COUNT(*) DESC LIMIT 20" % demo_filter)
    by_org = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("""
        SELECT COUNT(*), COUNT(*) FILTER (WHERE occ > 0), COALESCE(SUM(capacity), 0)::int, COALESCE(SUM(occ), 0)::int
        FROM (SELECT r.capacity, (SELECT COUNT(*) FROM personnel p WHERE p.residence_room_id = r.id
                  AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE) AS occ
              FROM rooms r JOIN buildings b ON b.id = r.building_id
              WHERE r.is_active = TRUE AND b.is_active = TRUE) t
    """)
    total_rooms, occupied_rooms, total_beds, occupied_beds = cur.fetchone()

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
    tabular_number = body.get('tabular_number', '').strip()

    if not full_name:
        return json_response(400, {'error': 'ФИО обязательно'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM personnel")
    next_id = cur.fetchone()[0]
    personal_code = 'МК-%03d' % next_id
    qr_code = 'QR-MK-%03d' % next_id

    cur.execute("""
        INSERT INTO personnel (personal_code, full_name, position, department, category, phone, room, status, qr_code, shift, organization, organization_type, medical_status, tabular_number)
        VALUES ('%s', '%s', '%s', '%s', '%s', '%s', '%s', 'arrived', '%s', '%s', '%s', '%s', 'pending', '%s')
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
        organization_type.replace("'", "''"),
        tabular_number.replace("'", "''")
    ))
    row = cur.fetchone()

    pass_sets, pass_error = build_pass_sets(body)
    if pass_sets and not pass_error:
        cur.execute("UPDATE personnel SET %s WHERE id = %d" % (', '.join(pass_sets), row[0]))

    res_b, res_r, res_label = resolve_residence(cur, body)
    if res_r:
        res_err = check_room_capacity(cur, res_r, row[0])
        if res_err:
            conn.rollback()
            cur.close()
            conn.close()
            return json_response(400, {'error': res_err})
    if res_label:
        cur.execute("UPDATE personnel SET residence = '%s', residence_building_id = %s, residence_room_id = %s%s WHERE id = %d" % (
            res_label.replace("'", "''"), int(res_b) if res_b else 'NULL', int(res_r) if res_r else 'NULL',
            room_number_set(cur, res_r), row[0]))
        sync_rooms(cur)
        log_housing(cur, row[0], None, res_r, 'Раздел «Персонал»')

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

def update_status(body, event=None):
    person_id = body.get('id')
    new_status = body.get('status', '')

    if not person_id or not new_status:
        return json_response(400, {'error': 'ID и статус обязательны'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT personal_code FROM personnel WHERE id = %d" % int(person_id))
    code_row = cur.fetchone()
    if code_row and code_row[0] == PROTECTED_CODE:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Статус администратора нельзя менять'})

    cur.execute("""
        UPDATE personnel SET status = '%s', updated_at = NOW()
        WHERE id = %d RETURNING full_name
    """ % (new_status.replace("'", "''"), int(person_id)))
    row = cur.fetchone()
    sync_rooms(cur)

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

def search_personnel(params, event):
    query_str = params.get('q', '').strip()
    if not query_str:
        return json_response(400, {'error': 'Введите поисковый запрос'})

    conn = get_db()
    cur = conn.cursor()

    demo_filter = "AND is_demo_data = TRUE" if is_demo_request(event) else "AND is_demo_data = FALSE"

    safe_q = query_str.replace("'", "''")
    cur.execute("""
        SELECT id, personal_code, full_name, position, department, category, 
               room, status, qr_code, medical_status, organization, organization_type, COALESCE(tab_number, '')
        FROM personnel
        WHERE status != 'archived' AND (full_name ILIKE '%%%s%%' OR personal_code ILIKE '%%%s%%' 
              OR department ILIKE '%%%s%%' OR qr_code ILIKE '%%%s%%'
              OR organization ILIKE '%%%s%%'
              OR tab_number ILIKE '%%%s%%') %s
        ORDER BY full_name LIMIT 20
    """ % (safe_q, safe_q, safe_q, safe_q, safe_q, safe_q, demo_filter))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    results = []
    for r in rows:
        results.append({
            'id': r[0], 'personal_code': r[1], 'full_name': r[2],
            'position': r[3], 'department': r[4], 'category': r[5],
            'room': r[6], 'status': r[7], 'qr_code': r[8], 'medical_status': r[9],
            'organization': r[10] or '', 'organization_type': r[11] or '',
            'tab_number': r[12] or ''
        })

    return json_response(200, {'results': results, 'total': len(results)})

def is_admin_request(cur, event):
    headers = (event or {}).get('headers') or {}
    token = ''
    for key in ('X-Authorization', 'x-authorization', 'Authorization', 'authorization'):
        val = headers.get(key, '')
        if val:
            token = val[7:] if val.startswith('Bearer ') else val
            break
    if not token:
        return False
    cur.execute("""
        SELECT u.id FROM users u JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE AND u.role = 'admin'
    """ % token.replace("'", "''"))
    return cur.fetchone() is not None


def get_residences(event):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT b.id, b.name, b.number, r.id, r.room_number, r.floor, r.capacity,
               (SELECT COUNT(*) FROM personnel p WHERE p.residence_room_id = r.id
                  AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE)
        FROM buildings b
        LEFT JOIN rooms r ON r.building_id = b.id AND r.is_active = TRUE
        WHERE b.is_active = TRUE
        ORDER BY b.sort_order, b.id, r.floor, r.room_number
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    buildings = []
    by_id = {}
    for r in rows:
        if r[0] not in by_id:
            by_id[r[0]] = {'id': r[0], 'name': r[1], 'number': r[2] or '', 'rooms': []}
            buildings.append(by_id[r[0]])
        if r[3]:
            by_id[r[0]]['rooms'].append({'id': r[3], 'room_number': r[4], 'floor': r[5], 'capacity': r[6], 'occupied': r[7]})
    return json_response(200, {'buildings': buildings})


def room_number_set(cur, room_id):
    if not room_id:
        return ''
    cur.execute("SELECT room_number FROM rooms WHERE id = %d" % int(room_id))
    rn = cur.fetchone()
    return ", room = '%s'" % rn[0].replace("'", "''") if rn else ''


def check_room_capacity(cur, room_id, person_id):
    cur.execute("""
        SELECT r.room_number, r.capacity,
               (SELECT COUNT(*) FROM personnel p WHERE p.residence_room_id = r.id AND p.id != %d
                  AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE),
               (SELECT residence_room_id FROM personnel WHERE id = %d)
        FROM rooms r WHERE r.id = %d
    """ % (int(person_id), int(person_id), int(room_id)))
    row = cur.fetchone()
    if row and row[3] != int(room_id) and row[2] >= row[1]:
        return 'Комната %s заполнена (%d/%d)' % (row[0], row[2], row[1])
    return ''


def resolve_residence(cur, body):
    room_id = body.get('residence_room_id')
    building_id = body.get('residence_building_id')
    if room_id:
        cur.execute("""
            SELECT b.id, b.name, r.id, r.room_number FROM rooms r JOIN buildings b ON b.id = r.building_id
            WHERE r.id = %d
        """ % int(room_id))
        row = cur.fetchone()
        if row:
            return row[0], row[2], '%s, комн. %s' % (row[1], row[3])
    if building_id:
        cur.execute("SELECT id, name FROM buildings WHERE id = %d" % int(building_id))
        row = cur.fetchone()
        if row:
            return row[0], None, row[1]
    return None, None, ''


PASS_KEYS = ('pass_number', 'pass_permanent', 'pass_valid_from', 'pass_valid_to', 'inspection_mode')


def valid_date(val):
    val = str(val or '').strip()[:10]
    if not val:
        return None
    datetime.strptime(val, '%Y-%m-%d')
    return val


def build_pass_sets(body):
    if not any(k in body for k in PASS_KEYS):
        return [], None
    sets = []
    if 'pass_number' in body:
        sets.append("pass_number = '%s'" % str(body.get('pass_number') or '').strip()[:50].replace("'", "''"))
    if 'inspection_mode' in body:
        mode = body.get('inspection_mode')
        if mode not in ('general', 'none'):
            return None, 'Неверный режим досмотра'
        sets.append("inspection_mode = '%s'" % mode)
    permanent = bool(body.get('pass_permanent'))
    if 'pass_permanent' in body or 'pass_valid_from' in body or 'pass_valid_to' in body:
        try:
            d_from = None if permanent else valid_date(body.get('pass_valid_from'))
            d_to = None if permanent else valid_date(body.get('pass_valid_to'))
        except ValueError:
            return None, 'Неверный формат даты пропуска'
        if d_from and d_to and d_from > d_to:
            return None, 'Дата окончания пропуска раньше даты начала'
        sets.append("pass_permanent = %s" % ('TRUE' if permanent else 'FALSE'))
        sets.append("pass_valid_from = %s" % ("'%s'" % d_from if d_from else 'NULL'))
        sets.append("pass_valid_to = %s" % ("'%s'" % d_to if d_to else 'NULL'))
    return sets, None


def edit_person(body, event=None):
    person_id = body.get('id')
    if not person_id:
        return json_response(400, {'error': 'ID обязателен'})

    fields = {}
    for key in ('full_name', 'position', 'department', 'category', 'phone', 'room', 'shift', 'status', 'medical_status', 'organization', 'organization_type', 'tab_number'):
        if key in body:
            fields[key] = str(body[key]).strip()

    pass_sets, pass_error = build_pass_sets(body)
    if pass_error:
        return json_response(400, {'error': pass_error})

    if not fields and not pass_sets and 'residence_room_id' not in body and 'residence_building_id' not in body:
        return json_response(400, {'error': 'Нет полей для обновления'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT personal_code FROM personnel WHERE id = %d" % int(person_id))
    code_row = cur.fetchone()
    is_protected = bool(code_row and code_row[0] == PROTECTED_CODE)
    if is_protected:
        if not is_admin_request(cur, event):
            cur.close()
            conn.close()
            return json_response(403, {'error': 'Данные администратора защищены от изменений'})
        if fields.get('status') == 'archived':
            cur.close()
            conn.close()
            return json_response(403, {'error': 'Администратора нельзя отправить в архив'})

    new_medical = fields.get('medical_status', '')

    cur.execute("SELECT full_name, medical_status, residence_room_id FROM personnel WHERE id = %d AND status != 'archived'" % int(person_id))
    old_row = cur.fetchone()
    if not old_row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})

    person_name = old_row[0]
    old_medical = old_row[1] or 'pending'

    housing_changed = False
    set_parts = []
    for key, val in fields.items():
        set_parts.append("%s = '%s'" % (key, val.replace("'", "''")))
    if 'residence_room_id' in body or 'residence_building_id' in body:
        res_b, res_r, res_label = resolve_residence(cur, body)
        set_parts.append("residence = '%s'" % res_label.replace("'", "''"))
        set_parts.append("residence_building_id = %s" % (int(res_b) if res_b else 'NULL'))
        set_parts.append("residence_room_id = %s" % (int(res_r) if res_r else 'NULL'))
        if res_r:
            res_err = check_room_capacity(cur, res_r, int(person_id))
            if res_err:
                cur.close()
                conn.close()
                return json_response(400, {'error': res_err})
            cur.execute("SELECT room_number FROM rooms WHERE id = %d" % int(res_r))
            rn = cur.fetchone()
            if rn:
                set_parts = [x for x in set_parts if not x.startswith("room = ")]
                set_parts.append("room = '%s'" % rn[0].replace("'", "''"))
        fields['residence'] = res_label
        housing_changed = True
    set_parts.extend(pass_sets)
    set_parts.append("updated_at = NOW()")

    cur.execute("""
        UPDATE personnel SET %s WHERE id = %d
    """ % (', '.join(set_parts), int(person_id)))
    sync_rooms(cur)
    if housing_changed:
        log_housing(cur, int(person_id), old_row[2], res_r, 'Карточка сотрудника')
        cur.execute("""
            UPDATE aho_arrivals a SET room = COALESCE(r.room_number, ''), building = COALESCE(b.name, ''), updated_at = NOW()
            FROM personnel p LEFT JOIN rooms r ON r.id = p.residence_room_id LEFT JOIN buildings b ON b.id = r.building_id
            WHERE p.id = a.personnel_id AND a.personnel_id = %d AND a.is_hidden = FALSE AND a.arrival_status != 'departed'
        """ % int(person_id))

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

    if is_protected:
        user_sets = []
        for key in ('full_name', 'position', 'department', 'organization', 'organization_type'):
            if key in fields and (key != 'full_name' or fields[key]):
                user_sets.append("%s = '%s'" % (key, fields[key].replace("'", "''")))
        if user_sets:
            cur.execute("UPDATE users SET %s, updated_at = NOW() WHERE personal_code = '%s'" % (', '.join(user_sets), PROTECTED_CODE))

    changed_keys = list(fields.keys())
    if pass_sets:
        changed_keys.append('пропуск/досмотр')
    changed = ', '.join('место проживания' if k == 'residence' else k for k in changed_keys)
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('edit', '%s — изменены данные (%s)', %d)
    """ % (person_name.replace("'", "''"), changed, int(person_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Данные обновлены', 'residence': fields.get('residence')})

def get_history(params):
    person_id = params.get('id', '')
    if not person_id:
        return json_response(400, {'error': 'ID обязателен'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, event_type, description, created_at
        FROM events
        WHERE personnel_id = %d AND COALESCE(is_hidden, FALSE) = FALSE
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


HOUSING_ACTIONS = {'checkin': 'Заселение', 'move': 'Переселение', 'evict': 'Выселение'}


def get_housing_history(params):
    """История проживания сотрудника"""
    person_id = params.get('id', '')
    if not person_id:
        return json_response(400, {'error': 'ID обязателен'})
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, action, building_name, room_number, prev_building_name, prev_room_number, source, created_at
        FROM housing_history WHERE personnel_id = %d ORDER BY created_at DESC, id DESC LIMIT 200
    """ % int(person_id))
    items = [{
        'id': r[0], 'action': r[1], 'action_label': HOUSING_ACTIONS.get(r[1], r[1]),
        'building': r[2], 'room': r[3], 'prev_building': r[4], 'prev_room': r[5],
        'source': r[6], 'created_at': r[7],
    } for r in cur.fetchall()]
    cur.close()
    conn.close()
    return json_response(200, {'items': items})


def upload_photo(body):
    """Загрузка фото сотрудника / пользователя (base64). Фото общее для карточки работника и пользователя"""
    import boto3
    personnel_id = body.get('personnel_id')
    user_id = body.get('user_id')
    photo = body.get('photo') or ''
    if not (personnel_id or user_id):
        return json_response(400, {'error': 'Не указан сотрудник'})

    conn = get_db()
    cur = conn.cursor()
    code = ''
    if personnel_id:
        cur.execute("SELECT personal_code FROM personnel WHERE id = %d" % int(personnel_id))
    else:
        cur.execute("SELECT personal_code FROM users WHERE id = %d" % int(user_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})
    code = row[0] or ''

    url = ''
    if photo:
        content_type = 'image/jpeg'
        if photo.startswith('data:') and ';' in photo:
            content_type = photo[5:photo.index(';')]
        if ',' in photo:
            photo = photo.split(',', 1)[1]
        data = base64.b64decode(photo)
        if len(data) > 5 * 1024 * 1024:
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Фото слишком большое (больше 5 МБ)'})
        ext = {'image/png': 'png', 'image/webp': 'webp'}.get(content_type, 'jpg')
        key = 'photos/%s_%s.%s' % ('p%d' % int(personnel_id) if personnel_id else 'u%d' % int(user_id), secrets.token_hex(6), ext)
        s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                          aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
        s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type)
        url = 'https://cdn.poehali.dev/projects/%s/bucket/%s' % (os.environ['AWS_ACCESS_KEY_ID'], key)

    safe_url = url.replace("'", "''")
    if personnel_id:
        cur.execute("UPDATE personnel SET photo_url = '%s', updated_at = NOW() WHERE id = %d" % (safe_url, int(personnel_id)))
    if user_id:
        cur.execute("UPDATE users SET photo_url = '%s', updated_at = NOW() WHERE id = %d" % (safe_url, int(user_id)))
    if code:
        safe_code = code.replace("'", "''")
        cur.execute("UPDATE personnel SET photo_url = '%s', updated_at = NOW() WHERE personal_code = '%s'" % (safe_url, safe_code))
        cur.execute("UPDATE users SET photo_url = '%s', updated_at = NOW() WHERE personal_code = '%s'" % (safe_url, safe_code))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'photo_url': url, 'message': 'Фото сохранено' if url else 'Фото удалено'})

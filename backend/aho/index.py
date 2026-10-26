import json
import os
import base64
import uuid
from datetime import datetime, date as date_type
import psycopg2

PROTECTED_CODE = 'АД-001'


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
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization, X-Demo'
        },
        'body': json.dumps(body, ensure_ascii=False, default=serialize_default)
    }

ON_SITE = "('arrived', 'on_shift')"
ROOM_OCC = "(SELECT COUNT(*) FROM personnel p WHERE p.residence_room_id = r.id AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE)"


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


def find_or_create_room(cur, room, building, room_id=None):
    if room_id:
        cur.execute("""SELECT r.id, r.room_number, b.id, b.name, r.capacity FROM rooms r
                       JOIN buildings b ON b.id = r.building_id WHERE r.id = %d""" % int(room_id))
        return cur.fetchone()
    safe_room = room.strip().replace("'", "''")
    safe_b = building.strip().replace("'", "''")
    cond = "AND (b.name = '%s' OR b.number = '%s')" % (safe_b, safe_b) if safe_b else ""
    cur.execute("""SELECT r.id, r.room_number, b.id, b.name, r.capacity FROM rooms r
                   JOIN buildings b ON b.id = r.building_id
                   WHERE r.room_number = '%s' AND r.is_active = TRUE AND r.is_residential = TRUE AND b.is_active = TRUE %s
                   ORDER BY b.sort_order, b.id LIMIT 1""" % (safe_room, cond))
    row = cur.fetchone()
    if row or not safe_b:
        return row
    cur.execute("SELECT id, name FROM buildings WHERE (name = '%s' OR number = '%s') AND is_active = TRUE ORDER BY id LIMIT 1" % (safe_b, safe_b))
    b = cur.fetchone()
    if not b:
        return None
    cur.execute("INSERT INTO rooms (building_id, building, room_number, capacity, floor) VALUES (%d, '%s', '%s', 2, 1) RETURNING id"
                % (b[0], b[1].replace("'", "''"), safe_room))
    new_id = cur.fetchone()[0]
    update_building_totals(cur, b[0])
    return (new_id, room.strip(), b[0], b[1], 2)



def detect_housing_conflict(cur, pid):
    """Вернулся хозяин места, на котором временно живёт другой — фиксирует конфликт расселения"""
    cur.execute("SELECT residence_room_id, full_name FROM personnel WHERE id = %d" % int(pid))
    me = cur.fetchone()
    if not me or not me[0]:
        return 0
    rid = me[0]
    cur.execute("""SELECT id, full_name FROM personnel WHERE temp_owner_id = %d AND residence_room_id = %d
                   AND status IN ('arrived', 'on_shift') AND COALESCE(is_hidden, FALSE) = FALSE""" % (int(pid), rid))
    temps = cur.fetchall()
    if not temps:
        return 0
    cur.execute("""SELECT r.capacity, r.room_number, COALESCE(b.name, ''),
                   (SELECT COUNT(*) FROM personnel p WHERE p.residence_room_id = r.id AND p.status IN ('arrived', 'on_shift')
                    AND COALESCE(p.is_hidden, FALSE) = FALSE)
                   FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id WHERE r.id = %d""" % rid)
    room = cur.fetchone()
    if not room or room[3] <= room[0]:
        return 0
    created = 0
    for t in temps:
        cur.execute("SELECT 1 FROM housing_conflicts WHERE owner_id = %d AND temp_id = %d AND resolved_at IS NULL" % (int(pid), t[0]))
        if cur.fetchone():
            continue
        cur.execute("INSERT INTO housing_conflicts (room_id, owner_id, temp_id) VALUES (%d, %d, %d)" % (rid, int(pid), t[0]))
        desc = 'Конфликт расселения: вернулся %s (%s, комн. %s), на его месте временно живёт %s' % (me[1], room[2], room[1], t[1])
        cur.execute("INSERT INTO events (event_type, description, personnel_id) VALUES ('housing_conflict', '%s', %d)"
                    % (desc.replace("'", "''"), int(pid)))
        created += 1
    return created


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
    """АХО — загрузка списков, контроль въезда/выезда, расселение, статистика"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')
    HIDE_CODES['on'] = not caller_is_admin(event)

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'POST' and action == 'upload':
        return upload_excel(body)
    elif method == 'GET' and action == 'list':
        return get_arrivals(params, event)
    elif method == 'GET' and action == 'batches':
        return get_batches(params)
    elif method == 'PUT' and action == 'checkin':
        return check_in(body)
    elif method == 'PUT' and action == 'checkout':
        return check_out(body)
    elif method == 'GET' and action == 'suggest-rooms':
        return suggest_rooms(params, event)
    elif method == 'PUT' and action == 'set-gender':
        return set_gender(body)
    elif method == 'PUT' and action == 'make-permanent':
        return make_permanent(body)
    elif method == 'GET' and action == 'housing-conflicts':
        return get_conflicts(event)
    elif method == 'PUT' and action == 'conflict-resolve':
        return resolve_conflict(body)
    elif method == 'GET' and action == 'unhoused':
        return get_unhoused(event)
    elif method == 'PUT' and action == 'evict':
        return evict(body)
    elif method == 'PUT' and action == 'assign-room':
        return assign_room(body)
    elif method == 'GET' and action == 'stats':
        return get_stats(event)
    elif method == 'GET' and action == 'medical-status':
        return get_medical_status(params, event)
    elif method == 'GET' and action == 'template':
        return get_template()
    elif method == 'PUT' and action == 'mass-checkin':
        return mass_check_in(body)
    elif method == 'PUT' and action == 'mass-checkout':
        return mass_check_out(body)
    elif method == 'GET' and action == 'medical-itr-stats':
        return get_medical_itr_stats(params, event)
    elif method == 'GET' and action == 'itr-positions':
        return get_itr_positions()
    elif method == 'PUT' and action == 'itr-positions':
        return save_itr_positions(body)
    elif method == 'POST' and action == 'reset':
        return perform_reset(body)
    elif method == 'GET' and action == 'export-all':
        return export_all_data()
    elif method == 'GET' and action == 'buildings':
        return get_buildings()
    elif method == 'POST' and action == 'buildings':
        return create_building(body)
    elif method == 'PUT' and action == 'buildings':
        return update_building(body)
    elif method == 'GET' and action == 'buildings-cleanup':
        return buildings_cleanup(False)
    elif method == 'POST' and action == 'buildings-cleanup':
        if is_demo_request(event):
            return json_response(403, {'error': 'В демо-режиме очистка недоступна'})
        return buildings_cleanup(True)
    elif method == 'GET' and action == 'rooms':
        return get_rooms(params)
    elif method == 'POST' and action == 'rooms':
        return create_room(body)
    elif method == 'PUT' and action == 'rooms':
        return update_room(body)
    elif method == 'POST' and action == 'rooms-batch':
        return create_rooms_batch(body)
    elif method == 'GET' and action == 'housing-stats':
        return get_housing_stats(params)

    return json_response(404, {'error': 'Маршрут не найден'})


def parse_excel(file_bytes):
    import openpyxl
    from io import BytesIO

    wb = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active

    rows_data = []
    headers = []
    header_map = {
        'фио': 'full_name', 'ф.и.о': 'full_name', 'ф.и.о.': 'full_name',
        'имя': 'full_name', 'фамилия': 'full_name', 'сотрудник': 'full_name',
        'должность': 'position', 'позиция': 'position',
        'подразделение': 'department', 'отдел': 'department', 'участок': 'department',
        'организация': 'organization', 'компания': 'organization', 'предприятие': 'organization',
        'телефон': 'phone', 'тел': 'phone', 'тел.': 'phone', 'номер': 'phone',
        'дата прибытия': 'arrival_date', 'дата приезда': 'arrival_date', 'заезд': 'arrival_date', 'прибытие': 'arrival_date',
        'дата отъезда': 'departure_date', 'дата убытия': 'departure_date', 'выезд': 'departure_date', 'отъезд': 'departure_date',
        'примечание': 'notes', 'примечания': 'notes', 'комментарий': 'notes',
        'табельный №': 'tab_number', 'табельный номер': 'tab_number', 'таб. №': 'tab_number', 'таб №': 'tab_number', 'таб.№': 'tab_number', 'табельный': 'tab_number', 'таб. номер': 'tab_number',
    }

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            for cell in row:
                val = str(cell or '').strip().lower()
                mapped = header_map.get(val, '')
                headers.append(mapped)
            continue

        if all(c is None or str(c).strip() == '' for c in row):
            continue

        item = {}
        for j, cell in enumerate(row):
            if j < len(headers) and headers[j]:
                val = cell
                if headers[j] in ('arrival_date', 'departure_date'):
                    if isinstance(val, datetime):
                        val = val.date().isoformat()
                    elif isinstance(val, date_type):
                        val = val.isoformat()
                    elif val:
                        val = str(val).strip()
                    else:
                        val = None
                else:
                    val = str(val or '').strip()
                item[headers[j]] = val

        if item.get('full_name'):
            rows_data.append(item)

    wb.close()
    return rows_data


def generate_code(cur):
    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM personnel")
    next_id = cur.fetchone()[0]
    code = 'МК-%03d' % next_id
    qr = 'QR-MK-%03d' % next_id
    return code, qr


def upload_excel(body):
    file_data = body.get('file', '')
    file_name = body.get('file_name', 'upload.xlsx')
    arrival_date = body.get('arrival_date', '')
    departure_date = body.get('departure_date', '')
    org_type = body.get('organization_type', 'contractor')

    if not file_data:
        return json_response(400, {'error': 'Файл не передан'})

    try:
        file_bytes = base64.b64decode(file_data)
    except Exception:
        return json_response(400, {'error': 'Ошибка декодирования файла'})

    try:
        rows_data = parse_excel(file_bytes)
    except Exception as e:
        return json_response(400, {'error': 'Ошибка чтения Excel: ' + str(e)[:100]})

    if not rows_data:
        return json_response(400, {'error': 'Файл пустой или не распознан. Убедитесь, что в первой строке заголовки: ФИО, Должность, Подразделение и т.д.'})

    batch_id = 'AHO-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:4]

    conn = get_db()
    cur = conn.cursor()

    created_ids = []
    for item in rows_data:
        full_name = item.get('full_name', '')
        if not full_name:
            continue

        position = item.get('position', '')
        department = item.get('department', '')
        organization = item.get('organization', '')
        phone = item.get('phone', '')
        notes = item.get('notes', '')
        tab_number = item.get('tab_number', '')
        item_arrival = item.get('arrival_date') or arrival_date or datetime.now().strftime('%Y-%m-%d')
        item_departure = item.get('departure_date') or departure_date or None

        personal_code, qr_code = generate_code(cur)

        tab_sql = "NULL"
        if tab_number:
            tab_sql = "'%s'" % tab_number.replace("'", "''")

        cur.execute("""
            INSERT INTO personnel (personal_code, full_name, position, department, category, phone, status, qr_code, organization, organization_type, medical_status, tab_number)
            VALUES ('%s', '%s', '%s', '%s', '%s', '%s', 'expected', '%s', '%s', '%s', 'pending', %s)
            RETURNING id
        """ % (
            personal_code,
            full_name.replace("'", "''"),
            position.replace("'", "''"),
            department.replace("'", "''"),
            org_type.replace("'", "''"),
            phone.replace("'", "''"),
            qr_code,
            organization.replace("'", "''"),
            org_type.replace("'", "''"),
            tab_sql,
        ))
        person_id = cur.fetchone()[0]

        dep_sql = "NULL"
        if item_departure:
            dep_sql = "'%s'" % str(item_departure).replace("'", "''")

        cur.execute("""
            INSERT INTO aho_arrivals (batch_id, personnel_id, full_name, position, department, organization, organization_type, phone, arrival_date, departure_date, personal_code, notes, arrival_status)
            VALUES ('%s', %d, '%s', '%s', '%s', '%s', '%s', '%s', '%s', %s, '%s', '%s', 'expected')
            RETURNING id
        """ % (
            batch_id,
            person_id,
            full_name.replace("'", "''"),
            position.replace("'", "''"),
            department.replace("'", "''"),
            organization.replace("'", "''"),
            org_type.replace("'", "''"),
            phone.replace("'", "''"),
            str(item_arrival).replace("'", "''"),
            dep_sql,
            personal_code,
            notes.replace("'", "''"),
        ))
        aho_id = cur.fetchone()[0]
        created_ids.append({'aho_id': aho_id, 'person_id': person_id, 'personal_code': personal_code, 'qr_code': qr_code, 'full_name': full_name})

        cur.execute("""
            INSERT INTO events (event_type, description, personnel_id)
            VALUES ('aho_upload', 'Загружен через АХО (партия %s): %s', %d)
        """ % (batch_id, full_name.replace("'", "''"), person_id))

    cur.execute("""
        INSERT INTO aho_batches (batch_id, file_name, total_count, arrival_date, departure_date)
        VALUES ('%s', '%s', %d, %s, %s)
    """ % (
        batch_id,
        file_name.replace("'", "''"),
        len(created_ids),
        ("'%s'" % arrival_date) if arrival_date else 'NULL',
        ("'%s'" % departure_date) if departure_date else 'NULL',
    ))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Загружено %d человек' % len(created_ids),
        'batch_id': batch_id,
        'total': len(created_ids),
        'persons': created_ids
    })


def get_arrivals(params, event):
    conn = get_db()
    cur = conn.cursor()

    batch_id = params.get('batch_id', '')
    status = params.get('status', '')
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')

    demo_filter = "AND p.is_demo_data = TRUE" if is_demo_request(event) else "AND p.is_demo_data = FALSE"

    query = """
        SELECT a.id, a.batch_id, a.personnel_id, a.full_name, a.position, a.department,
               a.organization, a.organization_type, a.phone, a.arrival_date, a.departure_date,
               a.arrival_status, a.check_in_at, a.check_out_at,
               COALESCE(pr.room_number, NULLIF(a.room, '')), COALESCE(pb.name, NULLIF(a.building, '')),
               a.medical_status, a.personal_code, a.notes, a.created_at,
               p.medical_status as current_medical, p.status as person_status, p.qr_code
        FROM aho_arrivals a
        LEFT JOIN personnel p ON a.personnel_id = p.id
        LEFT JOIN rooms pr ON pr.id = p.residence_room_id
        LEFT JOIN buildings pb ON pb.id = pr.building_id
        WHERE a.is_hidden = FALSE AND (p.id IS NULL OR p.is_demo_data = %s)
    """ % ('TRUE' if is_demo_request(event) else 'FALSE')
    if batch_id:
        query += " AND a.batch_id = '%s'" % batch_id.replace("'", "''")
    if status:
        query += " AND a.arrival_status = '%s'" % status.replace("'", "''")
    if date_from:
        query += " AND a.arrival_date >= '%s'" % date_from.replace("'", "''")
    if date_to:
        query += " AND a.arrival_date <= '%s'" % date_to.replace("'", "''")
    query += " ORDER BY a.arrival_date DESC, a.full_name ASC LIMIT 500"

    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'batch_id': r[1], 'personnel_id': r[2],
            'full_name': r[3], 'position': r[4], 'department': r[5],
            'organization': r[6], 'organization_type': r[7], 'phone': r[8],
            'arrival_date': r[9], 'departure_date': r[10],
            'arrival_status': r[11], 'check_in_at': r[12], 'check_out_at': r[13],
            'room': r[14], 'building': r[15],
            'medical_status': r[16], 'personal_code': r[17], 'notes': r[18],
            'created_at': r[19],
            'current_medical': r[20], 'person_status': r[21], 'qr_code': r[22],
        })

    return json_response(200, {'items': items, 'total': len(items)})


def get_batches(params):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT b.id, b.batch_id, b.file_name, b.total_count, b.arrived_count, b.departed_count,
               b.arrival_date, b.departure_date, b.created_at,
               (SELECT COUNT(*) FROM aho_arrivals WHERE batch_id = b.batch_id AND arrival_status = 'arrived') as real_arrived,
               (SELECT COUNT(*) FROM aho_arrivals WHERE batch_id = b.batch_id AND arrival_status = 'departed') as real_departed
        FROM aho_batches b
        WHERE b.is_hidden = FALSE
        ORDER BY b.created_at DESC
        LIMIT 50
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    batches = []
    for r in rows:
        batches.append({
            'id': r[0], 'batch_id': r[1], 'file_name': r[2],
            'total_count': r[3], 'arrived_count': r[9], 'departed_count': r[10],
            'arrival_date': r[6], 'departure_date': r[7], 'created_at': r[8],
        })

    return json_response(200, {'batches': batches})


def check_in(body):
    arrival_id = body.get('id')
    if not arrival_id:
        return json_response(400, {'error': 'ID записи обязателен'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE aho_arrivals SET arrival_status = 'arrived', check_in_at = NOW(), updated_at = NOW()
        WHERE id = %d RETURNING personnel_id, full_name
    """ % int(arrival_id))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Запись не найдена'})

    if row[0]:
        cur.execute("""
            UPDATE personnel SET status = 'arrived', updated_at = NOW() WHERE id = %d
        """ % row[0])
        cur.execute("""
            INSERT INTO events (event_type, description, personnel_id)
            VALUES ('check_in', '%s — въехал на территорию (АХО)', %d)
        """ % (row[1].replace("'", "''"), row[0]))
        sync_rooms(cur)
        detect_housing_conflict(cur, row[0])

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': '%s — въезд зафиксирован' % row[1]})


def check_out(body):
    arrival_id = body.get('id')
    if not arrival_id:
        return json_response(400, {'error': 'ID записи обязателен'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE aho_arrivals SET arrival_status = 'departed', check_out_at = NOW(), updated_at = NOW()
        WHERE id = %d RETURNING personnel_id, full_name
    """ % int(arrival_id))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Запись не найдена'})

    if row[0]:
        cur.execute("""
            UPDATE personnel SET status = 'departed', updated_at = NOW() WHERE id = %d
        """ % row[0])
        cur.execute("""
            INSERT INTO events (event_type, description, personnel_id)
            VALUES ('check_out', '%s — выехал с территории (АХО)', %d)
        """ % (row[1].replace("'", "''"), row[0]))
        sync_rooms(cur)

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': '%s — выезд зафиксирован' % row[1]})


def assign_room(body):
    arrival_id = body.get('id')
    personnel_id = body.get('personnel_id')
    room = str(body.get('room', '') or '')
    building = str(body.get('building', '') or '')
    room_id = body.get('room_id')

    if not (arrival_id or personnel_id) or not (room or room_id):
        return json_response(400, {'error': 'Укажите сотрудника и комнату'})

    conn = get_db()
    cur = conn.cursor()

    room_row = find_or_create_room(cur, room, building, room_id)
    if not room_row:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Комната %s не найдена. Сначала добавьте её в разделе «Здания»' % room})
    r_id, r_num, b_id, b_name, capacity = room_row
    cur.execute("SELECT is_residential FROM rooms WHERE id = %d" % int(r_id))
    res_flag = cur.fetchone()
    if res_flag and not res_flag[0]:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Помещение %s нежилое — в него нельзя заселить' % r_num})

    if arrival_id:
        cur.execute("SELECT personnel_id, full_name FROM aho_arrivals WHERE id = %d" % int(arrival_id))
    else:
        cur.execute("SELECT id, full_name FROM personnel WHERE id = %d" % int(personnel_id))
    who = cur.fetchone()
    if not who:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Запись не найдена'})
    pid, full_name = who[0], who[1]
    old_rid = None
    if pid:
        cur.execute("SELECT residence_room_id FROM personnel WHERE id = %d" % int(pid))
        orow = cur.fetchone()
        old_rid = orow[0] if orow else None

    cur.execute("""SELECT COUNT(*) FROM personnel WHERE residence_room_id = %d AND status IN ('arrived', 'on_shift')
                   AND COALESCE(is_hidden, FALSE) = FALSE AND id != %d""" % (r_id, int(pid or 0)))
    occ = cur.fetchone()[0]
    if occ >= capacity:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Комната %s заполнена (%d/%d)' % (r_num, occ, capacity)})

    temp_owner = None
    if pid:
        temp_owner = pick_temp_owner(cur, r_id, capacity, int(pid))
        if old_rid and int(old_rid) != int(r_id):
            release_temp_links(cur, int(pid))
    safe_num = r_num.replace("'", "''")
    safe_b = b_name.replace("'", "''")
    if pid:
        cur.execute("UPDATE personnel SET temp_owner_id = %s, temp_housed_at = %s WHERE id = %d"
                    % (int(temp_owner[0]) if temp_owner else 'NULL', 'NOW()' if temp_owner else 'NULL', int(pid)))
        cur.execute("""
            UPDATE personnel SET residence_room_id = %d, residence_building_id = %d,
                residence = '%s, комн. %s', room = '%s', updated_at = NOW()
            WHERE id = %d
        """ % (r_id, b_id, safe_b, safe_num, safe_num, int(pid)))
        cur.execute("""
            UPDATE aho_arrivals SET room = '%s', building = '%s', updated_at = NOW()
            WHERE personnel_id = %d AND is_hidden = FALSE AND arrival_status != 'departed'
        """ % (safe_num, safe_b, int(pid)))
    if arrival_id:
        cur.execute("UPDATE aho_arrivals SET room = '%s', building = '%s', updated_at = NOW() WHERE id = %d"
                    % (safe_num, safe_b, int(arrival_id)))

    sync_rooms(cur)
    if pid:
        log_housing(cur, pid, old_rid, r_id, 'АХО')
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('housing', '%s — заселён: %s, комн. %s', %s)
    """ % (full_name.replace("'", "''"), safe_b, safe_num, int(pid) if pid else 'NULL'))

    conn.commit()
    cur.close()
    conn.close()

    msg = '%s заселён: %s, комн. %s' % (full_name, b_name, r_num)
    if temp_owner:
        msg += ' — временно, на место %s (в отъезде)' % temp_owner[1]
    return json_response(200, {'message': msg, 'temporary': bool(temp_owner), 'owner_name': temp_owner[1] if temp_owner else ''})


def release_temp_links(cur, pid):
    """Человек покидает своё место навсегда — временные жильцы на его месте становятся постоянными"""
    cur.execute("UPDATE personnel SET temp_owner_id = NULL, temp_housed_at = NULL WHERE temp_owner_id = %d" % pid)
    cur.execute("UPDATE housing_conflicts SET resolved_at = NOW() WHERE resolved_at IS NULL AND (owner_id = %d OR temp_id = %d)" % (pid, pid))


def pick_temp_owner(cur, rid, capacity, pid):
    """Если постоянные места в комнате заняты, новый жилец занимает место отсутствующего — возвращает (id, ФИО) хозяина"""
    cur.execute("""SELECT COUNT(*) FROM personnel WHERE residence_room_id = %d AND id != %d AND temp_owner_id IS NULL
                   AND status NOT IN ('archived') AND COALESCE(is_hidden, FALSE) = FALSE""" % (rid, pid))
    permanent = cur.fetchone()[0]
    if permanent < capacity:
        return None
    cur.execute("""SELECT o.id, o.full_name FROM personnel o
                   WHERE o.residence_room_id = %d AND o.id != %d AND o.temp_owner_id IS NULL
                     AND o.status NOT IN ('arrived', 'on_shift', 'archived') AND COALESCE(o.is_hidden, FALSE) = FALSE
                     AND NOT EXISTS (SELECT 1 FROM personnel t WHERE t.temp_owner_id = o.id AND t.residence_room_id = %d AND t.id != %d)
                   ORDER BY o.updated_at ASC LIMIT 1""" % (rid, pid, rid, pid))
    return cur.fetchone()


def guess_gender(name):
    parts = (name or '').lower().split()
    for w in parts[1:]:
        if w.endswith(('вич', 'ич', 'оглы', 'улы', 'уулу')):
            return 'M'
        if w.endswith(('вна', 'чна', 'кызы', 'гызы')):
            return 'F'
    return ''


def set_gender(body):
    pid = body.get('personnel_id')
    g = body.get('gender', '')
    if not pid or g not in ('M', 'F', ''):
        return json_response(400, {'error': 'Неверные данные'})
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE personnel SET gender = '%s', updated_at = NOW() WHERE id = %d" % (g, int(pid)))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'ok': True})


def suggest_rooms(params, event):
    """Подбор свободных мест с учётом пола и организации работника"""
    pid = params.get('personnel_id', '')
    if not pid.isdigit():
        return json_response(400, {'error': 'Не указан сотрудник'})
    pid = int(pid)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT full_name, COALESCE(organization, ''), COALESCE(gender, ''), residence_room_id FROM personnel WHERE id = %d" % pid)
    me = cur.fetchone()
    if not me:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})
    gender = me[2]
    if not gender:
        gender = guess_gender(me[0])
        if gender:
            cur.execute("UPDATE personnel SET gender = '%s' WHERE id = %d" % (gender, pid))
            conn.commit()
    org = me[1].strip().lower()

    cur.execute("""
        SELECT r.id, r.room_number, r.capacity, COALESCE(r.floor, 0), b.id, b.name
        FROM rooms r JOIN buildings b ON b.id = r.building_id
        WHERE r.is_active = TRUE AND r.is_residential = TRUE AND b.is_active = TRUE AND r.capacity > 0
          AND r.id != %d
    """ % (me[3] or 0))
    rooms = {r[0]: {'room_id': r[0], 'room_number': r[1], 'capacity': r[2], 'floor': r[3],
                    'building_id': r[4], 'building_name': r[5], 'residents': []} for r in cur.fetchall()}
    if not rooms:
        cur.close()
        conn.close()
        return json_response(200, {'items': [], 'gender': gender, 'organization': me[1]})

    cur.execute("""
        SELECT p.residence_room_id, p.id, p.full_name, COALESCE(p.organization, ''), COALESCE(NULLIF(p.gender, ''), ''),
               p.status, p.temp_owner_id
        FROM personnel p
        WHERE p.residence_room_id IS NOT NULL AND p.status NOT IN ('archived') AND COALESCE(p.is_hidden, FALSE) = FALSE
          AND p.id != %d
    """ % pid)
    for r in cur.fetchall():
        if r[0] in rooms:
            g = r[4] or guess_gender(r[2])
            rooms[r[0]]['residents'].append({'id': r[1], 'name': r[2], 'org': r[3], 'gender': g,
                                             'on_site': r[5] in ('arrived', 'on_shift'), 'temp': r[6] is not None})
    cur.close()
    conn.close()

    result = []
    for rm in rooms.values():
        res = rm['residents']
        on_site = [x for x in res if x['on_site']]
        free_now = rm['capacity'] - len(on_site)
        if free_now <= 0:
            continue
        permanent = [x for x in res if not x['temp']]
        free_perm = rm['capacity'] - len(permanent)
        genders = set(x['gender'] for x in res if x['gender'])
        if gender and genders and genders != {gender}:
            continue
        same_org = sum(1 for x in res if org and x['org'].strip().lower() == org)
        other_org = sum(1 for x in res if x['org'] and x['org'].strip().lower() != org)
        score = 0
        reasons = []
        if free_perm > 0:
            score += 40
            reasons.append('Постоянное место')
        else:
            away = [x['name'] for x in permanent if not x['on_site']]
            reasons.append('Временно — хозяин в отъезде: %s' % (away[0] if away else '—'))
        if same_org:
            score += 25 + same_org * 5
            reasons.append('Соседи из той же организации: %d' % same_org)
        elif other_org:
            score -= 5
        if not res:
            score += 8
            reasons.append('Пустая комната')
        elif gender and genders == {gender}:
            score += 10
            reasons.append('Живут только мужчины' if gender == 'M' else 'Живут только женщины')
        elif not gender and genders:
            reasons.append('Пол соседей: %s' % ('мужской' if genders == {'M'} else 'женский' if genders == {'F'} else 'смешанный'))
        if res and not gender:
            score -= 3
        score += min(free_now, 3)
        result.append({
            'room_id': rm['room_id'], 'room_number': rm['room_number'], 'building_name': rm['building_name'],
            'building_id': rm['building_id'], 'floor': rm['floor'], 'capacity': rm['capacity'],
            'occupied': len(on_site), 'free_now': free_now, 'permanent': free_perm > 0,
            'same_org': same_org, 'score': score, 'reasons': reasons,
            'neighbors': [{'name': x['name'], 'org': x['org'], 'on_site': x['on_site']} for x in res][:6]
        })
    result.sort(key=lambda x: (-x['score'], x['building_name'], x['room_number']))
    return json_response(200, {'items': result[:10], 'gender': gender, 'organization': me[1], 'total_found': len(result)})


def make_permanent(body):
    """Временный жилец становится постоянным: хозяин места выписывается из комнаты и попадает в список расселения"""
    pid = body.get('personnel_id')
    if not pid:
        return json_response(400, {'error': 'Не указан сотрудник'})
    pid = int(pid)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""SELECT p.full_name, p.temp_owner_id, p.residence_room_id, o.full_name, o.residence_room_id, o.status
                   FROM personnel p LEFT JOIN personnel o ON o.id = p.temp_owner_id WHERE p.id = %d""" % pid)
    row = cur.fetchone()
    if not row or not row[1]:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Сотрудник не живёт временно'})
    name, owner_id, rid, owner_name, owner_rid, owner_status = row
    cur.execute("UPDATE personnel SET temp_owner_id = NULL, temp_housed_at = NULL, updated_at = NOW() WHERE id = %d" % pid)
    owner_moved = False
    if owner_rid and owner_rid == rid:
        log_housing(cur, owner_id, owner_rid, None, 'АХО')
        cur.execute("""UPDATE personnel SET residence_room_id = NULL,
                       residence = COALESCE((SELECT name FROM buildings WHERE id = residence_building_id), ''),
                       room = '', updated_at = NOW() WHERE id = %d""" % owner_id)
        cur.execute("UPDATE aho_arrivals SET room = '', building = '', updated_at = NOW() WHERE personnel_id = %d AND is_hidden = FALSE" % owner_id)
        cur.execute("UPDATE personnel SET temp_owner_id = %d WHERE temp_owner_id = %d AND id != %d" % (pid, owner_id, pid))
        owner_moved = True
    cur.execute("UPDATE housing_conflicts SET resolved_at = NOW() WHERE resolved_at IS NULL AND (owner_id = %d OR temp_id = %d)" % (owner_id, pid))
    sync_rooms(cur)
    desc = '%s — заселение стало постоянным (место %s)' % (name, owner_name or '—')
    if owner_moved:
        desc += '; %s выписан из комнаты и ожидает расселения' % owner_name
    cur.execute("INSERT INTO events (event_type, description, personnel_id) VALUES ('housing', '%s', %d)" % (desc.replace("'", "''"), pid))
    conn.commit()
    cur.close()
    conn.close()
    msg = '%s теперь живёт постоянно' % name
    if owner_moved:
        msg += '. %s перенесён в список расселения' % owner_name
    return json_response(200, {'message': msg, 'owner_moved': owner_moved})


def get_conflicts(event):
    """Открытые конфликты расселения: вернулся хозяин места, на котором временно живёт другой"""
    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE housing_conflicts c SET resolved_at = NOW()
        WHERE c.resolved_at IS NULL AND NOT (
            EXISTS (SELECT 1 FROM personnel o WHERE o.id = c.owner_id AND o.residence_room_id = c.room_id AND o.status IN ('arrived', 'on_shift'))
            AND EXISTS (SELECT 1 FROM personnel t WHERE t.id = c.temp_id AND t.residence_room_id = c.room_id AND t.status IN ('arrived', 'on_shift'))
            AND (SELECT COUNT(*) FROM personnel p WHERE p.residence_room_id = c.room_id AND p.status IN ('arrived', 'on_shift')
                 AND COALESCE(p.is_hidden, FALSE) = FALSE) > (SELECT capacity FROM rooms WHERE id = c.room_id)
        )
    """)
    conn.commit()
    cur.execute("""
        SELECT c.id, c.created_at, c.room_id, r.room_number, COALESCE(b.name, ''),
               o.id, o.full_name, COALESCE(o.organization, ''), t.id, t.full_name, COALESCE(t.organization, ''), t.temp_housed_at
        FROM housing_conflicts c
        JOIN personnel o ON o.id = c.owner_id AND o.is_demo_data = %s
        JOIN personnel t ON t.id = c.temp_id
        JOIN rooms r ON r.id = c.room_id
        LEFT JOIN buildings b ON b.id = r.building_id
        WHERE c.resolved_at IS NULL
        ORDER BY c.created_at DESC LIMIT 50
    """ % demo_val)
    items = [{
        'id': r[0], 'created_at': r[1], 'room_id': r[2], 'room_number': r[3], 'building_name': r[4],
        'owner': {'personnel_id': r[5], 'full_name': r[6], 'organization': r[7]},
        'temp': {'personnel_id': r[8], 'full_name': r[9], 'organization': r[10], 'housed_at': r[11]}
    } for r in cur.fetchall()]
    cur.close()
    conn.close()
    return json_response(200, {'items': items})


def resolve_conflict(body):
    cid = body.get('id')
    if not cid:
        return json_response(400, {'error': 'Не указан конфликт'})
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE housing_conflicts SET resolved_at = NOW() WHERE id = %d" % int(cid))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'ok': True})


def get_unhoused(event):
    """Список расселения: все действующие сотрудники без комнаты (загруженные списком и внесённые вручную).
    Человек остаётся в списке, пока его не заселят или он не убудет / не будет архивирован."""
    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.id, p.full_name, p.personal_code, COALESCE(p.organization, ''), COALESCE(p.position, ''),
               p.status, p.created_at, COALESCE(p.department, ''), COALESCE(p.phone, ''),
               (SELECT a.arrival_date FROM aho_arrivals a WHERE a.personnel_id = p.id AND a.is_hidden = FALSE
                ORDER BY a.id DESC LIMIT 1),
               EXISTS (SELECT 1 FROM aho_arrivals a WHERE a.personnel_id = p.id AND a.is_hidden = FALSE),
               COALESCE(p.tab_number, ''), COALESCE(p.gender, '')
        FROM personnel p
        WHERE p.residence_room_id IS NULL AND p.status IN ('expected', 'arrived', 'on_shift')
          AND COALESCE(p.is_hidden, FALSE) = FALSE AND p.is_demo_data = %s
        ORDER BY CASE WHEN p.status = 'expected' THEN 1 ELSE 0 END, p.created_at DESC NULLS LAST, p.full_name
        LIMIT 1000
    """ % demo_val)
    items = [{
        'personnel_id': r[0], 'full_name': r[1], 'personal_code': r[2], 'organization': r[3], 'position': r[4],
        'status': r[5], 'created_at': r[6], 'department': r[7], 'phone': r[8],
        'arrival_date': r[9], 'source': 'list' if r[10] else 'manual', 'tab_number': r[11],
        'gender': r[12] or guess_gender(r[1])
    } for r in cur.fetchall()]
    cur.close()
    conn.close()
    return json_response(200, {'items': items, 'total': len(items)})


def evict(body):
    personnel_id = body.get('personnel_id')
    if not personnel_id:
        return json_response(400, {'error': 'Не указан сотрудник'})
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT residence_room_id FROM personnel WHERE id = %d" % int(personnel_id))
    orow = cur.fetchone()
    if orow and orow[0]:
        log_housing(cur, int(personnel_id), orow[0], None, 'АХО')
    release_temp_links(cur, int(personnel_id))
    cur.execute("""UPDATE personnel SET residence_room_id = NULL, residence = COALESCE((SELECT name FROM buildings WHERE id = residence_building_id), ''),
                   room = '', temp_owner_id = NULL, temp_housed_at = NULL, updated_at = NOW() WHERE id = %d RETURNING full_name""" % int(personnel_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})
    cur.execute("UPDATE aho_arrivals SET room = '', building = '', updated_at = NOW() WHERE personnel_id = %d AND is_hidden = FALSE" % int(personnel_id))
    sync_rooms(cur)
    cur.execute("INSERT INTO events (event_type, description, personnel_id) VALUES ('housing', '%s — выселен из комнаты', %d)"
                % (row[0].replace("'", "''"), int(personnel_id)))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': '%s выселен' % row[0]})


def get_stats(event):
    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'

    cur.execute("SELECT COUNT(*) FROM aho_arrivals a LEFT JOIN personnel p ON a.personnel_id = p.id WHERE a.is_hidden = FALSE AND (p.id IS NULL OR p.is_demo_data = %s)" % demo_val)
    total = cur.fetchone()[0]

    cur.execute("SELECT a.arrival_status, COUNT(*) FROM aho_arrivals a LEFT JOIN personnel p ON a.personnel_id = p.id WHERE a.is_hidden = FALSE AND (p.id IS NULL OR p.is_demo_data = %s) GROUP BY a.arrival_status" % demo_val)
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) FROM aho_arrivals a LEFT JOIN personnel p ON a.personnel_id = p.id WHERE a.is_hidden = FALSE AND (p.residence_room_id IS NOT NULL OR (p.id IS NULL AND a.room IS NOT NULL AND a.room != '')) AND (p.id IS NULL OR p.is_demo_data = %s)" % demo_val)
    housed = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM aho_arrivals a LEFT JOIN personnel p ON a.personnel_id = p.id WHERE a.is_hidden = FALSE AND p.residence_room_id IS NULL AND (p.id IS NOT NULL OR a.room IS NULL OR a.room = '') AND (p.id IS NULL OR p.is_demo_data = %s)" % demo_val)
    not_housed = cur.fetchone()[0]

    cur.execute("""
        SELECT p.medical_status, COUNT(*)
        FROM aho_arrivals a
        JOIN personnel p ON a.personnel_id = p.id
        WHERE a.arrival_status = 'arrived' AND a.is_hidden = FALSE AND p.is_demo_data = %s
        GROUP BY p.medical_status
    """ % demo_val)
    medical = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("""
        SELECT COUNT(*) FROM aho_arrivals a LEFT JOIN personnel p ON a.personnel_id = p.id
        WHERE a.is_hidden = FALSE AND a.arrival_date = CURRENT_DATE AND (p.id IS NULL OR p.is_demo_data = %s)
    """ % demo_val)
    today_expected = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*) FROM aho_arrivals a LEFT JOIN personnel p ON a.personnel_id = p.id
        WHERE a.is_hidden = FALSE AND a.departure_date = CURRENT_DATE AND (p.id IS NULL OR p.is_demo_data = %s)
    """ % demo_val)
    today_departing = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM aho_batches WHERE is_hidden = FALSE")
    total_batches = cur.fetchone()[0]

    cur.execute("""SELECT COALESCE(SUM(r.capacity), 0), COALESCE(SUM(%s), 0)::int FROM rooms r
                   JOIN buildings b ON b.id = r.building_id WHERE r.is_active = TRUE AND r.is_residential = TRUE AND b.is_active = TRUE""" % ROOM_OCC)
    rooms_row = cur.fetchone()

    cur.close()
    conn.close()

    return json_response(200, {
        'total': total,
        'by_status': by_status,
        'housed': housed,
        'not_housed': not_housed,
        'medical': medical,
        'today_expected': today_expected,
        'today_departing': today_departing,
        'total_batches': total_batches,
        'rooms_capacity': rooms_row[0],
        'rooms_occupied': rooms_row[1],
    })


def get_medical_status(params, event):
    batch_id = params.get('batch_id', '')
    status_filter = params.get('medical', '')

    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'

    query = """
        SELECT a.id, a.full_name, a.personal_code, a.department, a.organization,
               a.arrival_status, a.room,
               p.medical_status, p.id as person_id,
               mc.status as last_check_status, mc.checked_at as last_check_time,
               mc.blood_pressure, mc.pulse, mc.temperature, mc.alcohol_level, mc.notes as check_notes
        FROM aho_arrivals a
        LEFT JOIN personnel p ON a.personnel_id = p.id
        LEFT JOIN LATERAL (
            SELECT status, checked_at, blood_pressure, pulse, temperature, alcohol_level, notes
            FROM medical_checks
            WHERE personnel_id = p.id
            ORDER BY checked_at DESC
            LIMIT 1
        ) mc ON true
        WHERE a.arrival_status IN ('arrived', 'expected') AND a.is_hidden = FALSE AND (p.id IS NULL OR p.is_demo_data = %s)
    """ % demo_val
    if batch_id:
        query += " AND a.batch_id = '%s'" % batch_id.replace("'", "''")
    if status_filter:
        query += " AND COALESCE(p.medical_status, 'pending') = '%s'" % status_filter.replace("'", "''")
    query += " ORDER BY p.medical_status ASC, a.full_name ASC LIMIT 300"

    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'full_name': r[1], 'personal_code': r[2],
            'department': r[3], 'organization': r[4],
            'arrival_status': r[5], 'room': r[6],
            'medical_status': r[7] or 'pending', 'person_id': r[8],
            'last_check_status': r[9], 'last_check_time': r[10],
            'blood_pressure': r[11], 'pulse': r[12],
            'temperature': str(r[13]) if r[13] else None,
            'alcohol_level': str(r[14]) if r[14] else None,
            'check_notes': r[15],
        })

    return json_response(200, {'items': items, 'total': len(items)})


def get_template():
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Список въезжающих"

    headers = ["ФИО", "Табельный №", "Должность", "Подразделение", "Организация", "Телефон", "Дата прибытия", "Дата отъезда", "Примечание"]
    col_widths = [35, 16, 25, 25, 30, 18, 16, 16, 30]

    header_font = Font(name="Arial", bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill(start_color="2D5A27", end_color="2D5A27", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC"),
    )
    data_font = Font(name="Arial", size=10)
    data_align = Alignment(vertical="center", wrap_text=True)

    for col_idx, (header, width) in enumerate(zip(headers, col_widths), 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    ws.row_dimensions[1].height = 30

    examples = [
        ["Иванов Иван Иванович", "Т-001", "Горный мастер", "Участок №1", "ООО Рудник", "+7 900 123-45-67", "2026-03-01", "2026-03-15", ""],
        ["Петров Пётр Петрович", "Т-002", "Электрослесарь", "Энергоцех", "ООО Рудник", "+7 900 765-43-21", "2026-03-01", "2026-03-15", ""],
        ["Сидорова Анна Сергеевна", "Т-003", "Инженер ОТ", "ОТиПБ", "ООО Подрядчик", "+7 900 111-22-33", "2026-03-01", "2026-03-08", "Командировка"],
    ]

    example_fill = PatternFill(start_color="F5F5F5", end_color="F5F5F5", fill_type="solid")
    for row_idx, row_data in enumerate(examples, 2):
        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = Font(name="Arial", size=10, color="999999", italic=True)
            cell.fill = example_fill
            cell.alignment = data_align
            cell.border = thin_border

    for row_idx in range(5, 55):
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_idx, value="")
            cell.font = data_font
            cell.alignment = data_align
            cell.border = thin_border

    ws_help = wb.create_sheet("Инструкция")
    ws_help.column_dimensions["A"].width = 80

    instructions = [
        "ИНСТРУКЦИЯ ПО ЗАПОЛНЕНИЮ",
        "",
        "1. Заполните список на листе «Список въезжающих»",
        "2. Первая строка (зелёная) — заголовки, НЕ удаляйте и НЕ меняйте их",
        "3. Строки 2-4 (серые) — примеры, можно удалить или заменить",
        "4. Начинайте заполнение с 5 строки",
        "",
        "ОБЯЗАТЕЛЬНЫЕ ПОЛЯ:",
        "• ФИО — полное имя сотрудника",
        "",
        "НЕОБЯЗАТЕЛЬНЫЕ ПОЛЯ:",
        "• Табельный № — табельный номер сотрудника",
        "• Должность, Подразделение, Организация, Телефон",
        "• Дата прибытия/отъезда — формат ГГГГ-ММ-ДД (можно указать при загрузке)",
        "• Примечание — любая дополнительная информация",
        "",
        "ПОСЛЕ ЗАГРУЗКИ:",
        "• Каждому сотруднику автоматически присваивается личный код (МК-XXX)",
        "• Автоматически генерируется QR-код",
        "• Сотрудник появляется в разделе «Персонал»",
        "• Можно отслеживать въезд/выезд и медосмотр в разделе «АХО»",
    ]
    for i, text in enumerate(instructions, 1):
        cell = ws_help.cell(row=i, column=1, value=text)
        if i == 1:
            cell.font = Font(name="Arial", bold=True, size=14)
        elif text.startswith("ОБЯЗАТЕЛЬНЫЕ") or text.startswith("НЕОБЯЗАТЕЛЬНЫЕ") or text.startswith("ПОСЛЕ"):
            cell.font = Font(name="Arial", bold=True, size=11)
        else:
            cell.font = Font(name="Arial", size=10)

    buf = BytesIO()
    wb.save(buf)
    wb.close()
    file_b64 = base64.b64encode(buf.getvalue()).decode()

    return json_response(200, {
        'file': file_b64,
        'file_name': 'Шаблон_списка_въезжающих.xlsx'
    })


def mass_check_in(body):
    ids = body.get('ids', [])
    batch_id = body.get('batch_id', '')
    if not ids and not batch_id:
        return json_response(400, {'error': 'Укажите список ID или партию'})

    conn = get_db()
    cur = conn.cursor()

    if batch_id and not ids:
        cur.execute("SELECT id FROM aho_arrivals WHERE batch_id = '%s' AND arrival_status = 'expected'" % batch_id.replace("'", "''"))
        ids = [r[0] for r in cur.fetchall()]

    count = 0
    for aid in ids:
        cur.execute("""
            UPDATE aho_arrivals SET arrival_status = 'arrived', check_in_at = NOW(), updated_at = NOW()
            WHERE id = %d AND arrival_status = 'expected' RETURNING personnel_id, full_name
        """ % int(aid))
        row = cur.fetchone()
        if row:
            count += 1
            if row[0]:
                cur.execute("UPDATE personnel SET status = 'arrived', updated_at = NOW() WHERE id = %d" % row[0])
                detect_housing_conflict(cur, row[0])
                cur.execute("""
                    INSERT INTO events (event_type, description, personnel_id)
                    VALUES ('check_in', '%s — массовый въезд (АХО)', %d)
                """ % (row[1].replace("'", "''"), row[0]))

    sync_rooms(cur)
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Въезд зафиксирован: %d чел.' % count, 'count': count})


def mass_check_out(body):
    ids = body.get('ids', [])
    batch_id = body.get('batch_id', '')
    if not ids and not batch_id:
        return json_response(400, {'error': 'Укажите список ID или партию'})

    conn = get_db()
    cur = conn.cursor()

    if batch_id and not ids:
        cur.execute("SELECT id FROM aho_arrivals WHERE batch_id = '%s' AND arrival_status = 'arrived'" % batch_id.replace("'", "''"))
        ids = [r[0] for r in cur.fetchall()]

    count = 0
    for aid in ids:
        cur.execute("""
            UPDATE aho_arrivals SET arrival_status = 'departed', check_out_at = NOW(), updated_at = NOW()
            WHERE id = %d AND arrival_status = 'arrived' RETURNING personnel_id, full_name
        """ % int(aid))
        row = cur.fetchone()
        if row:
            count += 1
            if row[0]:
                cur.execute("UPDATE personnel SET status = 'departed', updated_at = NOW() WHERE id = %d" % row[0])
                cur.execute("""
                    INSERT INTO events (event_type, description, personnel_id)
                    VALUES ('check_out', '%s — массовый выезд (АХО)', %d)
                """ % (row[1].replace("'", "''"), row[0]))

    sync_rooms(cur)
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Выезд зафиксирован: %d чел.' % count, 'count': count})


def get_itr_positions():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT value FROM settings WHERE key = 'itr_positions'")
    row = cur.fetchone()
    cur.close()
    conn.close()
    positions = row[0] if row else []
    return json_response(200, {'positions': positions})


def save_itr_positions(body):
    positions = body.get('positions', [])
    if not isinstance(positions, list):
        return json_response(400, {'error': 'positions должен быть массивом'})

    conn = get_db()
    cur = conn.cursor()
    positions_json = json.dumps(positions, ensure_ascii=False)
    cur.execute("""
        INSERT INTO settings (key, value, updated_at) VALUES ('itr_positions', '%s'::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = '%s'::jsonb, updated_at = NOW()
    """ % (positions_json.replace("'", "''"), positions_json.replace("'", "''")))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Список ИТР должностей сохранён', 'count': len(positions)})


CYR_UPPER = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯё'
CYR_LOWER = 'абвгдеежзийклмнопрстуфхцчшщъыьэюяе'


def normalize_position(value):
    s = ' '.join(str(value or '').replace('\u00a0', ' ').split()).lower().replace('ё', 'е')
    return s.replace(' - ', '-').replace(' -', '-').replace('- ', '-')


def sql_normalized(column):
    return ("REPLACE(REPLACE(REPLACE(TRANSLATE(LOWER(TRIM(REGEXP_REPLACE(COALESCE(%s, ''), '\\s+', ' ', 'g'))), '%s', '%s'), ' - ', '-'), ' -', '-'), '- ', '-')"
            % (column, CYR_UPPER, CYR_LOWER))


def build_itr_where(cur, column='p.position'):
    cur.execute("SELECT value FROM settings WHERE key = 'itr_positions'")
    row = cur.fetchone()
    raw = row[0] if row else []
    if isinstance(raw, str):
        raw = json.loads(raw)
    names = sorted({normalize_position(p) for p in (raw or []) if normalize_position(p)})
    if not names:
        return "FALSE"
    col = sql_normalized(column)
    conds = []
    for n in names:
        safe = n.replace("'", "''").replace('%', '').replace('_', '\\_')
        conds.append("%s LIKE '%s%%'" % (col, safe))
    return "(%s)" % " OR ".join(conds)


def get_medical_itr_stats(params, event):
    batch_id = params.get('batch_id', '')

    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'

    cur.execute("SELECT value FROM settings WHERE key = 'itr_positions'")
    row = cur.fetchone()
    itr_positions = (row[0] if row else []) or []
    itr_where = build_itr_where(cur, 'COALESCE(NULLIF(a.position, \'\'), p.position)')

    base_where = "a.arrival_status IN ('arrived', 'expected') AND a.is_hidden = FALSE AND (p.id IS NULL OR p.is_demo_data = %s)" % demo_val
    if batch_id:
        base_where += " AND a.batch_id = '%s'" % batch_id.replace("'", "''")

    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE %s) as itr_total,
            COUNT(*) FILTER (WHERE NOT (%s)) as worker_total,
            COUNT(*) FILTER (WHERE %s AND COALESCE(p.medical_status, 'pending') = 'passed') as itr_passed,
            COUNT(*) FILTER (WHERE %s AND COALESCE(p.medical_status, 'pending') = 'failed') as itr_failed,
            COUNT(*) FILTER (WHERE %s AND COALESCE(p.medical_status, 'pending') = 'pending') as itr_pending,
            COUNT(*) FILTER (WHERE NOT (%s) AND COALESCE(p.medical_status, 'pending') = 'passed') as worker_passed,
            COUNT(*) FILTER (WHERE NOT (%s) AND COALESCE(p.medical_status, 'pending') = 'failed') as worker_failed,
            COUNT(*) FILTER (WHERE NOT (%s) AND COALESCE(p.medical_status, 'pending') = 'pending') as worker_pending,
            COUNT(*) as total
        FROM aho_arrivals a
        LEFT JOIN personnel p ON a.personnel_id = p.id
        WHERE %s
    """ % (itr_where, itr_where, itr_where, itr_where, itr_where, itr_where, itr_where, itr_where, base_where))
    r = cur.fetchone()

    itr_list_query = """
        SELECT a.id, a.full_name, a.personal_code, a.position, a.department, a.organization,
               COALESCE(p.medical_status, 'pending') as medical_status,
               mc.status as last_check, mc.checked_at, mc.blood_pressure, mc.pulse, mc.temperature, mc.alcohol_level,
               p.id as person_id
        FROM aho_arrivals a
        LEFT JOIN personnel p ON a.personnel_id = p.id
        LEFT JOIN LATERAL (
            SELECT status, checked_at, blood_pressure, pulse, temperature, alcohol_level
            FROM medical_checks WHERE personnel_id = p.id ORDER BY checked_at DESC LIMIT 1
        ) mc ON true
        WHERE %s AND %s
        ORDER BY p.medical_status ASC, a.full_name ASC
    """ % (base_where, itr_where)
    cur.execute(itr_list_query)
    itr_rows = cur.fetchall()

    worker_list_query = """
        SELECT a.id, a.full_name, a.personal_code, a.position, a.department, a.organization,
               COALESCE(p.medical_status, 'pending') as medical_status,
               mc.status as last_check, mc.checked_at, mc.blood_pressure, mc.pulse, mc.temperature, mc.alcohol_level,
               p.id as person_id
        FROM aho_arrivals a
        LEFT JOIN personnel p ON a.personnel_id = p.id
        LEFT JOIN LATERAL (
            SELECT status, checked_at, blood_pressure, pulse, temperature, alcohol_level
            FROM medical_checks WHERE personnel_id = p.id ORDER BY checked_at DESC LIMIT 1
        ) mc ON true
        WHERE %s AND NOT (%s)
        ORDER BY p.medical_status ASC, a.full_name ASC
    """ % (base_where, itr_where)
    cur.execute(worker_list_query)
    worker_rows = cur.fetchall()

    cur.close()
    conn.close()

    def map_rows(rows):
        items = []
        for row in rows:
            items.append({
                'id': row[0], 'full_name': row[1], 'personal_code': row[2],
                'position': row[3], 'department': row[4], 'organization': row[5],
                'medical_status': row[6],
                'last_check': row[7], 'checked_at': row[8],
                'blood_pressure': row[9], 'pulse': row[10],
                'temperature': str(row[11]) if row[11] else None,
                'alcohol_level': str(row[12]) if row[12] else None,
                'person_id': row[13],
            })
        return items

    return json_response(200, {
        'summary': {
            'itr_total': r[0], 'worker_total': r[1],
            'itr_passed': r[2], 'itr_failed': r[3], 'itr_pending': r[4],
            'worker_passed': r[5], 'worker_failed': r[6], 'worker_pending': r[7],
            'total': r[8],
        },
        'itr_list': map_rows(itr_rows),
        'worker_list': map_rows(worker_rows),
        'itr_positions': itr_positions,
    })


def perform_reset(body):
    """Обнуление данных системы. Soft-delete скрывает с экрана, full — удаляет из БД"""
    reset_type = body.get('reset_type', '')
    valid_types = ['personnel', 'aho_arrivals', 'aho_departures', 'delete_aho_arrivals', 'delete_aho_departures', 'medical', 'lamp_room', 'full']
    if reset_type not in valid_types:
        return json_response(400, {'error': 'Неизвестный тип обнуления. Допустимые: %s' % ', '.join(valid_types)})

    conn = get_db()
    cur = conn.cursor()
    affected = 0

    if reset_type == 'personnel':
        cur.execute("""
            UPDATE personnel SET is_hidden = TRUE, updated_at = NOW()
            WHERE is_hidden = FALSE AND personal_code != '%s' AND personal_code NOT IN (
                SELECT COALESCE(p.personal_code, '') FROM users u
                LEFT JOIN personnel p ON p.full_name = u.full_name
                WHERE u.role = 'admin' AND p.personal_code IS NOT NULL
            )
        """ % PROTECTED_CODE)
        affected = cur.rowcount
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('personnel', 'Обнуление списка персонала (скрыто %d записей)', %d)
        """ % (affected, affected))
        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('system_reset', 'Обнуление списка персонала — скрыто %d записей')
        """ % affected)

    elif reset_type == 'aho_arrivals':
        cur.execute("""
            UPDATE aho_arrivals SET is_hidden = TRUE, updated_at = NOW()
            WHERE is_hidden = FALSE AND arrival_status IN ('expected', 'arrived')
        """)
        affected = cur.rowcount
        cur.execute("""
            UPDATE aho_batches SET is_hidden = TRUE WHERE is_hidden = FALSE
        """)
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('aho_arrivals', 'Обнуление списка заехавших АХО (скрыто %d записей)', %d)
        """ % (affected, affected))
        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('system_reset', 'Обнуление списка заехавших АХО — скрыто %d записей')
        """ % affected)

    elif reset_type == 'aho_departures':
        cur.execute("""
            UPDATE aho_arrivals SET is_hidden = TRUE, updated_at = NOW()
            WHERE is_hidden = FALSE AND arrival_status = 'departed'
        """)
        affected = cur.rowcount
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('aho_departures', 'Обнуление списка выехавших АХО (скрыто %d записей)', %d)
        """ % (affected, affected))
        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('system_reset', 'Обнуление списка выехавших АХО — скрыто %d записей')
        """ % affected)

    elif reset_type == 'delete_aho_arrivals':
        cur.execute("""
            SELECT COUNT(*) FROM aho_arrivals WHERE arrival_status IN ('expected', 'arrived')
        """)
        affected = cur.fetchone()[0]
        cur.execute("DELETE FROM aho_arrivals WHERE arrival_status IN ('expected', 'arrived')")
        cur.execute("DELETE FROM aho_batches WHERE batch_id NOT IN (SELECT DISTINCT batch_id FROM aho_arrivals)")
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('delete_aho_arrivals', 'Удаление списка заехавших АХО (удалено %d записей)', %d)
        """ % (affected, affected))
        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('system_reset', 'Удаление списка заехавших АХО — удалено %d записей из базы')
        """ % affected)

    elif reset_type == 'delete_aho_departures':
        cur.execute("""
            SELECT COUNT(*) FROM aho_arrivals WHERE arrival_status = 'departed'
        """)
        affected = cur.fetchone()[0]
        cur.execute("DELETE FROM aho_arrivals WHERE arrival_status = 'departed'")
        cur.execute("DELETE FROM aho_batches WHERE batch_id NOT IN (SELECT DISTINCT batch_id FROM aho_arrivals)")
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('delete_aho_departures', 'Удаление списка выехавших АХО (удалено %d записей)', %d)
        """ % (affected, affected))
        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('system_reset', 'Удаление списка выехавших АХО — удалено %d записей из базы')
        """ % affected)

    elif reset_type == 'medical':
        cur.execute("""
            UPDATE medical_checks SET is_hidden = TRUE
            WHERE is_hidden = FALSE
        """)
        affected = cur.rowcount
        cur.execute("""
            UPDATE personnel SET medical_status = 'pending', updated_at = NOW()
            WHERE medical_status != 'pending' AND status != 'archived' AND personal_code != '%s'
        """ % PROTECTED_CODE)
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('medical', 'Обнуление списков медосмотров (скрыто %d записей)', %d)
        """ % (affected, affected))
        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('system_reset', 'Обнуление медосмотров — скрыто %d записей')
        """ % affected)

    elif reset_type == 'lamp_room':
        affected = 0
        for table in ['lamp_room_issues', 'lamp_room_denials']:
            cur.execute("SELECT COUNT(*) FROM %s" % table)
            affected += cur.fetchone()[0]
            cur.execute("DELETE FROM %s" % table)
        cur.execute("UPDATE lamp_room_equipment SET status = 'available', notes = NULL WHERE status = 'issued'")
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('lamp_room', 'Обнуление ламповой — удалено %d записей выдачи/приёма', %d)
        """ % (affected, affected))
        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('system_reset', 'Обнуление ламповой — удалено %d записей выдачи и приёма фонарей/самоспасателей')
        """ % affected)

    elif reset_type == 'full':
        counts = {}
        for table in ['aho_arrivals', 'aho_batches', 'medical_checks', 'events', 'notifications',
                       'dispatcher_messages', 'medical_reset_log', 'lanterns', 'rooms',
                       'lamp_room_issues', 'lamp_room_denials', 'lamp_room_equipment',
                       'security_checks', 'checkpoint_passes']:
            cur.execute("SELECT COUNT(*) FROM %s" % table)
            counts[table] = cur.fetchone()[0]
            cur.execute("DELETE FROM %s" % table)

        cur.execute("SELECT COUNT(*) FROM personnel WHERE full_name NOT IN (SELECT full_name FROM users WHERE role = 'admin') AND personal_code != '%s'" % PROTECTED_CODE)
        counts['personnel'] = cur.fetchone()[0]
        cur.execute("DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'admin')")
        cur.execute("DELETE FROM personnel WHERE full_name NOT IN (SELECT full_name FROM users WHERE role = 'admin') AND personal_code != '%s'" % PROTECTED_CODE)
        cur.execute("DELETE FROM users WHERE role != 'admin'")

        affected = sum(counts.values())
        cur.execute("""
            INSERT INTO reset_log (reset_type, description, affected_rows)
            VALUES ('full', 'Полный сброс системы. Администраторы сохранены. Удалено: %d записей', %d)
        """ % (affected, affected))
    conn.commit()
    cur.close()
    conn.close()

    labels = {
        'personnel': 'Список персонала обнулён',
        'aho_arrivals': 'Список заехавших по АХО обнулён',
        'aho_departures': 'Список выехавших по АХО обнулён',
        'delete_aho_arrivals': 'Список заехавших по АХО удалён из базы',
        'delete_aho_departures': 'Список выехавших по АХО удалён из базы',
        'medical': 'Списки медосмотров обнулены',
        'lamp_room': 'Списки ламповой обнулены',
        'full': 'Система полностью сброшена до заводских настроек',
    }

    return json_response(200, {
        'message': labels.get(reset_type, 'Готово'),
        'affected': affected,
        'reset_type': reset_type,
    })


def export_all_data():
    """Выгрузка всех данных из БД (включая скрытые) в JSON"""
    conn = get_db()
    cur = conn.cursor()

    tables_cols = {
        'personnel': ['id','personal_code','full_name','position','department','category','phone','room','status','qr_code','medical_status','shift','organization','organization_type','tab_number','is_hidden','created_at','updated_at'],
        'aho_arrivals': ['id','batch_id','personnel_id','full_name','position','department','organization','organization_type','phone','arrival_date','departure_date','arrival_status','check_in_at','check_out_at','room','building','medical_status','personal_code','notes','is_hidden','created_at','updated_at'],
        'aho_batches': ['id','batch_id','file_name','total_count','arrived_count','departed_count','arrival_date','departure_date','is_hidden','created_at'],
        'medical_checks': ['id','personnel_id','check_type','status','blood_pressure','pulse','temperature','alcohol_level','shift_type','check_direction','shift_date','doctor_name','notes','is_hidden','checked_at'],
        'events': ['id','event_type','description','personnel_id','user_id','metadata','is_hidden','created_at'],
        'lanterns': ['id','lantern_number','rescuer_number','status','assigned_to','issued_at','returned_at','condition'],
        'rooms': ['id','room_number','building','capacity','occupied','status'],
        'notifications': ['id','type','title','message','person_name','person_code','is_read','created_at'],
        'reset_log': ['id','reset_type','description','affected_rows','performed_by','performed_at'],
    }

    table_filters = {
        'rooms': "WHERE is_active = TRUE AND building_id IN (SELECT id FROM buildings WHERE is_active = TRUE)",
    }

    result = {}
    for table, cols in tables_cols.items():
        cur.execute("SELECT %s FROM %s %s ORDER BY id" % (', '.join(cols), table, table_filters.get(table, '')))
        rows = cur.fetchall()
        result[table] = []
        for r in rows:
            item = {}
            for i, col in enumerate(cols):
                item[col] = r[i]
            result[table].append(item)
        result[table + '_count'] = len(rows)

    cur.close()
    conn.close()

    return json_response(200, {
        'data': result,
        'exported_at': datetime.now().isoformat(),
        'message': 'Полная выгрузка всех данных (включая скрытые)',
    })


def get_buildings():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT b.id, b.name, b.number, b.total_rooms, b.total_capacity, b.sort_order, b.is_active,
               (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id AND r.is_active = TRUE AND r.is_residential = TRUE) as actual_rooms,
               (SELECT COALESCE(SUM(r.capacity), 0) FROM rooms r WHERE r.building_id = b.id AND r.is_active = TRUE AND r.is_residential = TRUE) as actual_capacity,
               (SELECT COALESCE(SUM(%s), 0)::int FROM rooms r WHERE r.building_id = b.id AND r.is_active = TRUE AND r.is_residential = TRUE) as occupied_people
        FROM buildings b
        WHERE b.is_active = TRUE
        ORDER BY b.sort_order, b.id
    """ % ROOM_OCC)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    buildings = []
    for r in rows:
        buildings.append({
            'id': r[0], 'name': r[1], 'number': r[2],
            'total_rooms': r[3], 'total_capacity': r[4],
            'sort_order': r[5], 'is_active': r[6],
            'actual_rooms': r[7], 'actual_capacity': r[8],
            'occupied_people': r[9],
        })
    return json_response(200, {'buildings': buildings})


def create_building(body):
    name = body.get('name', '').strip()
    number = body.get('number', '').strip()
    if not name:
        return json_response(400, {'error': 'Укажите название здания'})
    if not number:
        number = name

    conn = get_db()
    cur = conn.cursor()
    safe_name = name.replace("'", "''")
    safe_number = number.replace("'", "''")
    cur.execute("""
        INSERT INTO buildings (name, number, sort_order)
        VALUES ('%s', '%s', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM buildings))
        RETURNING id
    """ % (safe_name, safe_number))
    building_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'id': building_id, 'message': 'Здание добавлено'})


CLEANUP_WHERE = """b.is_active = FALSE
      AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.building_id = b.id AND r.is_active = TRUE)
      AND NOT EXISTS (SELECT 1 FROM personnel p WHERE p.residence_building_id = b.id
                      OR p.residence_room_id IN (SELECT r2.id FROM rooms r2 WHERE r2.building_id = b.id))
      AND NOT EXISTS (SELECT 1 FROM housing_history h WHERE h.building_id = b.id
                      OR h.room_id IN (SELECT r3.id FROM rooms r3 WHERE r3.building_id = b.id))"""


def buildings_cleanup(apply):
    """Удалённые здания без жильцов и истории: подсчёт или полное удаление из базы"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT b.id FROM buildings b WHERE %s" % CLEANUP_WHERE)
    ids = [r[0] for r in cur.fetchall()]
    if not apply or not ids:
        cur.close()
        conn.close()
        return json_response(200, {'count': len(ids), 'deleted': 0})
    id_list = ', '.join(str(int(i)) for i in ids)
    cur.execute("DELETE FROM rooms WHERE building_id IN (%s)" % id_list)
    rooms_deleted = cur.rowcount
    cur.execute("DELETE FROM buildings WHERE id IN (%s)" % id_list)
    deleted = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'count': 0, 'deleted': deleted, 'rooms_deleted': rooms_deleted,
                               'message': 'Удалено зданий: %d' % deleted})


def update_building(body):
    building_id = body.get('id')
    if not building_id:
        return json_response(400, {'error': 'Не указан id здания'})

    conn = get_db()
    cur = conn.cursor()

    sets = []
    if 'name' in body:
        sets.append("name = '%s'" % str(body['name']).replace("'", "''"))
    if 'number' in body:
        sets.append("number = '%s'" % str(body['number']).replace("'", "''"))
    if 'is_active' in body:
        sets.append("is_active = %s" % ('TRUE' if body['is_active'] else 'FALSE'))
    if 'sort_order' in body:
        sets.append("sort_order = %d" % int(body['sort_order']))

    if not sets:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Нечего обновлять'})

    sets.append("updated_at = NOW()")
    cur.execute("UPDATE buildings SET %s WHERE id = %d" % (', '.join(sets), int(building_id)))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Здание обновлено'})


def get_rooms(params):
    building_id = params.get('building_id', '')
    if not building_id:
        return json_response(400, {'error': 'Не указан building_id'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT r.id, r.room_number, r.capacity, r.floor, r.notes, r.is_active,
               b.name as building_name, %s, COALESCE(r.name, ''), r.is_residential
        FROM rooms r
        JOIN buildings b ON r.building_id = b.id
        WHERE r.building_id = %d AND r.is_active = TRUE
        ORDER BY r.floor, r.room_number
    """ % (ROOM_OCC, int(building_id)))
    rows = cur.fetchall()

    cur.execute("""
        SELECT p.residence_room_id, p.id, p.full_name, COALESCE(p.position, ''), p.status IN ('arrived', 'on_shift'), p.status,
               p.temp_owner_id, o.full_name, o.status IN ('arrived', 'on_shift'),
               COALESCE(p.temp_housed_at,
                        (SELECT MAX(h.created_at) FROM housing_history h WHERE h.personnel_id = p.id AND h.room_id = p.residence_room_id))
        FROM personnel p JOIN rooms r ON r.id = p.residence_room_id
        LEFT JOIN personnel o ON o.id = p.temp_owner_id
        WHERE r.building_id = %d AND p.status != 'archived' AND COALESCE(p.is_hidden, FALSE) = FALSE
        ORDER BY (p.temp_owner_id IS NOT NULL), (p.status IN ('arrived', 'on_shift')) DESC, p.full_name
    """ % int(building_id))
    res_map = {}
    for x in cur.fetchall():
        res_map.setdefault(x[0], []).append({
            'id': x[1], 'full_name': x[2], 'position': x[3], 'on_site': bool(x[4]), 'status': x[5] or '',
            'temporary': x[6] is not None, 'owner_id': x[6], 'owner_name': x[7] or '', 'owner_on_site': bool(x[8]),
            'housed_at': x[9]
        })

    cur.close()
    conn.close()

    rooms = []
    for r in rows:
        room_num = r[1]
        rooms.append({
            'id': r[0], 'room_number': room_num, 'capacity': r[2],
            'floor': r[3], 'notes': r[4] or '', 'is_active': r[5],
            'building_name': r[6],
            'occupied': r[7], 'name': r[8], 'is_residential': bool(r[9]),
            'residents': res_map.get(r[0], []),
        })
    return json_response(200, {'rooms': rooms})


def create_room(body):
    building_id = body.get('building_id')
    room_number = body.get('room_number', '').strip()
    capacity = int(body.get('capacity', 2))
    floor = int(body.get('floor', 1))
    notes = body.get('notes', '').strip()
    room_name = str(body.get('name') or '').strip()[:100]
    is_res = 'FALSE' if body.get('is_residential') is False else 'TRUE'
    if is_res == 'FALSE':
        capacity = 0

    if not building_id or not room_number:
        return json_response(400, {'error': 'Укажите building_id и room_number'})

    conn = get_db()
    cur = conn.cursor()
    safe_num = room_number.replace("'", "''")
    safe_notes = notes.replace("'", "''")

    cur.execute("SELECT id FROM rooms WHERE building_id = %d AND room_number = '%s'" % (int(building_id), safe_num))
    if cur.fetchone():
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Комната %s уже существует в этом здании' % room_number})

    cur.execute("""
        INSERT INTO rooms (building_id, room_number, capacity, floor, notes, name, is_residential)
        VALUES (%d, '%s', %d, %d, '%s', '%s', %s) RETURNING id
    """ % (int(building_id), safe_num, capacity, floor, safe_notes, room_name.replace("'", "''"), is_res))
    room_id = cur.fetchone()[0]

    update_building_totals(cur, int(building_id))
    sync_rooms(cur)
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'id': room_id, 'message': 'Комната добавлена'})


def update_room(body):
    room_id = body.get('id')
    if not room_id:
        return json_response(400, {'error': 'Не указан id комнаты'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT building_id, occupied FROM rooms WHERE id = %d" % int(room_id))
    cur_room = cur.fetchone()
    if not cur_room:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Комната не найдена'})

    sets = []
    if 'room_number' in body:
        new_num = str(body['room_number']).strip()
        if not new_num:
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Укажите номер комнаты'})
        cur.execute("SELECT id FROM rooms WHERE building_id = %d AND is_active = TRUE AND id <> %d AND room_number = '%s'"
                    % (int(cur_room[0]), int(room_id), new_num.replace("'", "''")))
        if cur.fetchone():
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Комната с номером %s уже есть в этом здании' % new_num})
        sets.append("room_number = '%s'" % new_num.replace("'", "''"))
    non_res = 'is_residential' in body and not body['is_residential']
    if non_res:
        body['capacity'] = 0
    if 'capacity' in body and not non_res:
        cap = int(body['capacity'])
        if cap < 1:
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Мест должно быть не меньше 1'})
        if cap < int(cur_room[1] or 0):
            cur.close()
            conn.close()
            return json_response(400, {'error': 'В комнате проживает %d чел. — мест не может быть меньше' % int(cur_room[1] or 0)})
        sets.append("capacity = %d" % cap)
    elif non_res:
        sets.append("capacity = 0")
    if 'floor' in body:
        sets.append("floor = %d" % int(body['floor']))
    if 'notes' in body:
        sets.append("notes = '%s'" % str(body['notes']).replace("'", "''"))
    if 'is_residential' in body:
        if not body['is_residential']:
            cur.execute("SELECT COUNT(*) FROM personnel WHERE residence_room_id = %d AND status != 'archived'" % int(room_id))
            if cur.fetchone()[0] > 0:
                cur.close()
                conn.close()
                return json_response(400, {'error': 'В комнате есть проживающие — сначала выселите их'})
        sets.append("is_residential = %s" % ('TRUE' if body['is_residential'] else 'FALSE'))
    if 'name' in body:
        sets.append("name = '%s'" % str(body['name'] or '').strip()[:100].replace("'", "''"))
    if 'is_active' in body:
        sets.append("is_active = %s" % ('TRUE' if body['is_active'] else 'FALSE'))

    if not sets:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Нечего обновлять'})

    sets.append("updated_at = NOW()")
    cur.execute("UPDATE rooms SET %s WHERE id = %d" % (', '.join(sets), int(room_id)))

    cur.execute("SELECT building_id FROM rooms WHERE id = %d" % int(room_id))
    row = cur.fetchone()
    if row:
        update_building_totals(cur, row[0])
    if 'is_active' in body and not body['is_active']:
        cur.execute("SELECT id FROM personnel WHERE residence_room_id = %d" % int(room_id))
        for ev in cur.fetchall():
            log_housing(cur, ev[0], int(room_id), None, 'АХО — комната удалена')
        cur.execute("UPDATE personnel SET residence_room_id = NULL, updated_at = NOW() WHERE residence_room_id = %d" % int(room_id))
    sync_rooms(cur)

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Комната обновлена'})


def create_rooms_batch(body):
    building_id = body.get('building_id')
    rooms_list = body.get('rooms', [])

    if not building_id or not rooms_list:
        return json_response(400, {'error': 'Укажите building_id и список rooms'})

    conn = get_db()
    cur = conn.cursor()
    created = 0

    for rm in rooms_list:
        room_number = str(rm.get('room_number', '')).strip()
        capacity = int(rm.get('capacity', 2))
        floor = int(rm.get('floor', 1))
        notes = str(rm.get('notes', '')).strip()

        if not room_number:
            continue

        safe_num = room_number.replace("'", "''")
        safe_notes = notes.replace("'", "''")

        cur.execute("SELECT id FROM rooms WHERE building_id = %d AND room_number = '%s'" % (int(building_id), safe_num))
        if cur.fetchone():
            continue

        cur.execute("""
            INSERT INTO rooms (building_id, room_number, capacity, floor, notes)
            VALUES (%d, '%s', %d, %d, '%s')
        """ % (int(building_id), safe_num, capacity, floor, safe_notes))
        created += 1

    update_building_totals(cur, int(building_id))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'created': created, 'message': 'Добавлено комнат: %d' % created})


def update_building_totals(cur, building_id):
    cur.execute("""
        UPDATE buildings SET
            total_rooms = (SELECT COUNT(*) FROM rooms WHERE building_id = %d AND is_active = TRUE AND is_residential = TRUE),
            total_capacity = (SELECT COALESCE(SUM(capacity), 0) FROM rooms WHERE building_id = %d AND is_active = TRUE AND is_residential = TRUE),
            updated_at = NOW()
        WHERE id = %d
    """ % (building_id, building_id, building_id))


def get_housing_stats(params):
    """Статистика расселения: общежития, места, жильцы"""
    detail = params.get('detail', '')
    building_id = params.get('building_id', '')

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT b.id, b.name, b.number,
               (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id AND r.is_active = TRUE AND r.is_residential = TRUE) as rooms_count,
               (SELECT COALESCE(SUM(r.capacity), 0) FROM rooms r WHERE r.building_id = b.id AND r.is_active = TRUE AND r.is_residential = TRUE) as total_beds,
               (SELECT COALESCE(SUM(%s), 0)::int FROM rooms r WHERE r.building_id = b.id AND r.is_active = TRUE AND r.is_residential = TRUE) as occupied_beds
        FROM buildings b
        WHERE b.is_active = TRUE
        ORDER BY b.sort_order, b.id
    """ % ROOM_OCC)
    brows = cur.fetchall()

    buildings_list = []
    total_buildings = 0
    total_beds = 0
    total_occupied = 0

    for r in brows:
        total_buildings += 1
        beds = r[4]
        occ = r[5]
        total_beds += beds
        total_occupied += occ
        buildings_list.append({
            'id': r[0], 'name': r[1], 'number': r[2],
            'rooms_count': r[3], 'total_beds': beds,
            'occupied_beds': occ, 'free_beds': beds - occ,
        })

    cur.execute("""
        SELECT r.building_id, COALESCE(r.floor, 0), COUNT(*), COALESCE(SUM(r.capacity), 0), COALESCE(SUM(%s), 0)::int
        FROM rooms r JOIN buildings b ON b.id = r.building_id
        WHERE r.is_active = TRUE AND r.is_residential = TRUE AND b.is_active = TRUE
        GROUP BY r.building_id, COALESCE(r.floor, 0)
        ORDER BY r.building_id, COALESCE(r.floor, 0)
    """ % ROOM_OCC)
    floors_map = {}
    for fr in cur.fetchall():
        floors_map.setdefault(fr[0], []).append({
            'floor': fr[1], 'rooms_count': fr[2], 'total_beds': fr[3],
            'occupied_beds': fr[4], 'free_beds': max(fr[3] - fr[4], 0),
        })
    for bl in buildings_list:
        bl['floors'] = floors_map.get(bl['id'], [])

    result = {
        'total_buildings': total_buildings,
        'total_beds': total_beds,
        'occupied_beds': total_occupied,
        'free_beds': total_beds - total_occupied,
        'buildings': buildings_list,
    }

    if detail == 'building-rooms' and building_id:
        bid = int(building_id)
        cur.execute("""
            SELECT b.name FROM buildings b WHERE b.id = %d
        """ % bid)
        bname_row = cur.fetchone()
        bname = bname_row[0] if bname_row else ''

        cur.execute("""
            SELECT r.id, r.room_number, r.capacity, r.floor
            FROM rooms r
            WHERE r.building_id = %d AND r.is_active = TRUE AND r.is_residential = TRUE
            ORDER BY r.floor, r.room_number
        """ % bid)
        room_rows = cur.fetchall()

        cur.execute("""
            SELECT r.room_number, p.id, p.full_name, p.position, p.organization, p.personal_code,
                   p.status IN ('arrived', 'on_shift'), p.status
            FROM personnel p JOIN rooms r ON r.id = p.residence_room_id
            WHERE r.building_id = %d AND p.status != 'archived' AND COALESCE(p.is_hidden, FALSE) = FALSE
            ORDER BY r.room_number, (p.status IN ('arrived', 'on_shift')) DESC, p.full_name
        """ % bid)
        residents = cur.fetchall()

        res_map = {}
        for res in residents:
            rm = res[0]
            if rm not in res_map:
                res_map[rm] = []
            res_map[rm].append({
                'id': res[1], 'full_name': res[2], 'position': res[3] or '',
                'organization': res[4] or '', 'personal_code': res[5] or '',
                'on_site': bool(res[6]), 'status': res[7] or '',
            })

        rooms_detail = []
        for rr in room_rows:
            rnum = rr[1]
            room_residents = res_map.get(rnum, [])
            rooms_detail.append({
                'id': rr[0], 'room_number': rnum, 'capacity': rr[2], 'floor': rr[3],
                'occupied': sum(1 for x in room_residents if x['on_site']),
                'free': rr[2] - sum(1 for x in room_residents if x['on_site']),
                'residents': room_residents,
            })

        result['building_detail'] = {
            'building_id': bid, 'building_name': bname,
            'rooms': rooms_detail,
        }

    if detail == 'all-residents':
        cur.execute("""
            SELECT p.id, p.full_name, p.position, p.organization, p.personal_code,
                   r.room_number, b.name
            FROM personnel p JOIN rooms r ON r.id = p.residence_room_id
            JOIN buildings b ON b.id = r.building_id
            WHERE p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE
              AND r.is_active = TRUE AND b.is_active = TRUE
            ORDER BY b.sort_order, b.name, r.room_number, p.full_name
        """)
        all_res = cur.fetchall()
        result['all_residents'] = [{
            'id': r[0], 'full_name': r[1], 'position': r[2] or '',
            'organization': r[3] or '', 'personal_code': r[4] or '',
            'room': r[5], 'building': r[6] or '',
        } for r in all_res]

    cur.close()
    conn.close()
    return json_response(200, result)
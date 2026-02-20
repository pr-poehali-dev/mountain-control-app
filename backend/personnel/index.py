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
    elif method == 'GET' and action == 'search':
        return search_personnel(params)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_personnel(params):
    conn = get_db()
    cur = conn.cursor()

    category = params.get('category', '')
    status = params.get('status', '')
    shift = params.get('shift', '')

    query = """
        SELECT id, personal_code, full_name, position, department, category, 
               phone, room, status, qr_code, medical_status, shift, created_at
        FROM personnel WHERE 1=1
    """
    if category:
        query += " AND category = '%s'" % category.replace("'", "''")
    if status:
        query += " AND status = '%s'" % status.replace("'", "''")
    if shift:
        query += " AND shift = '%s'" % shift.replace("'", "''")
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
            'created_at': r[12]
        })

    return json_response(200, {'personnel': personnel, 'total': len(personnel)})

def get_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM personnel")
    total = cur.fetchone()[0]

    cur.execute("SELECT category, COUNT(*) FROM personnel GROUP BY category")
    by_category = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT status, COUNT(*) FROM personnel GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT medical_status, COUNT(*) FROM personnel GROUP BY medical_status")
    by_medical = {r[0]: r[1] for r in cur.fetchall()}

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

    if not full_name:
        return json_response(400, {'error': 'ФИО обязательно'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM personnel")
    next_id = cur.fetchone()[0]
    personal_code = 'МК-%03d' % next_id
    qr_code = 'QR-MK-%03d' % next_id

    cur.execute("""
        INSERT INTO personnel (personal_code, full_name, position, department, category, phone, room, status, qr_code, shift)
        VALUES ('%s', '%s', '%s', '%s', '%s', '%s', '%s', 'arrived', '%s', '%s')
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
        str(shift).replace("'", "''")
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
               room, status, qr_code, medical_status
        FROM personnel
        WHERE full_name ILIKE '%%%s%%' OR personal_code ILIKE '%%%s%%' 
              OR department ILIKE '%%%s%%' OR qr_code ILIKE '%%%s%%'
        ORDER BY full_name LIMIT 20
    """ % (safe_q, safe_q, safe_q, safe_q))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    results = []
    for r in rows:
        results.append({
            'id': r[0], 'personal_code': r[1], 'full_name': r[2],
            'position': r[3], 'department': r[4], 'category': r[5],
            'room': r[6], 'status': r[7], 'qr_code': r[8], 'medical_status': r[9]
        })

    return json_response(200, {'results': results, 'total': len(results)})
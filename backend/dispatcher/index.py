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
    """Диспетчерская служба — учёт шахтных фонарей и самоспасателей"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and path == '/':
        return get_lanterns()
    elif method == 'GET' and path == '/stats':
        return get_lantern_stats()
    elif method == 'POST' and path == '/issue':
        return issue_lantern(body)
    elif method == 'POST' and path == '/return':
        return return_lantern(body)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_lanterns():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT l.id, l.lantern_number, l.rescuer_number, l.status, l.issued_at, l.returned_at, l.condition,
               p.full_name, p.personal_code
        FROM lanterns l
        LEFT JOIN personnel p ON l.assigned_to = p.id
        ORDER BY l.lantern_number
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    lanterns = []
    for r in rows:
        lanterns.append({
            'id': r[0], 'lantern_number': r[1], 'rescuer_number': r[2],
            'status': r[3], 'issued_at': r[4], 'returned_at': r[5],
            'condition': r[6], 'person_name': r[7], 'person_code': r[8]
        })

    return json_response(200, {'lanterns': lanterns, 'total': len(lanterns)})

def get_lantern_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT status, COUNT(*) FROM lanterns GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) FROM lanterns")
    total = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'total': total,
        'issued': by_status.get('issued', 0),
        'available': by_status.get('available', 0),
        'charging': by_status.get('charging', 0),
        'missing': by_status.get('missing', 0)
    })

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

    cur.execute("""
        UPDATE lanterns SET status = 'issued', assigned_to = %d, issued_at = NOW(), returned_at = NULL
        WHERE id = %d RETURNING lantern_number
    """ % (int(person_id), int(lantern_id)))
    lantern_num = cur.fetchone()[0]

    cur.execute("SELECT full_name FROM personnel WHERE id = %d" % int(person_id))
    person_name = cur.fetchone()[0]

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('lantern_issued', 'Фонарь %s — выдан %s', %d)
    """ % (lantern_num, person_name.replace("'", "''"), int(person_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Фонарь выдан', 'lantern': lantern_num, 'person': person_name})

def return_lantern(body):
    lantern_id = body.get('lantern_id')
    condition = body.get('condition', 'normal')

    if not lantern_id:
        return json_response(400, {'error': 'ID фонаря обязателен'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT l.lantern_number, p.full_name, l.assigned_to
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

    person_name = row[1] or 'неизвестный'
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('lantern_returned', 'Фонарь %s — возвращён (%s)', %s)
    """ % (row[0], condition, str(row[2]) if row[2] else 'NULL'))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Фонарь принят', 'lantern': row[0]})

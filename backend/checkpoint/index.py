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
    """КПП — фиксация входа/выхода через сканер, журнал проходов, связь с АХО"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'POST' and action == 'pass':
        return register_pass(body)
    elif method == 'GET' and action == 'journal':
        return get_journal(params)
    elif method == 'GET' and action == 'stats':
        return get_stats()
    elif method == 'GET' and action == 'on-site':
        return get_on_site(params)
    elif method == 'GET' and action == 'export':
        return export_journal(params)

    return json_response(404, {'error': 'Маршрут не найден'})

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

def register_pass(body):
    raw_code = body.get('code', '').strip()
    direction = body.get('direction', 'in')
    checkpoint_name = body.get('checkpoint_name', 'КПП-1')
    notes = body.get('notes', '')

    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})
    if direction not in ('in', 'out'):
        return json_response(400, {'error': 'direction должен быть in или out'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
               p.category, p.status, p.medical_status, p.organization, p.organization_type
        FROM personnel p
        WHERE (p.personal_code = '%s' OR p.qr_code = '%s') AND p.is_hidden = FALSE
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    person_id = row[0]
    person_name = row[2]
    safe_name = person_name.replace("'", "''")
    medical_ok = row[7] in ('passed', 'expiring')

    if direction == 'in' and not medical_ok:
        cur.execute("""
            INSERT INTO checkpoint_passes (personnel_id, personal_code, full_name, direction, checkpoint_name, medical_ok, notes)
            VALUES (%d, '%s', '%s', 'in', '%s', FALSE, 'ОТКАЗ: медосмотр не пройден')
        """ % (person_id, safe_code, safe_name, checkpoint_name.replace("'", "''")))

        cur.execute("""
            INSERT INTO events (event_type, description, personnel_id)
            VALUES ('checkpoint_denied', 'КПП: %s — ОТКАЗ во входе (медосмотр)', %d)
        """ % (safe_name, person_id))

        conn.commit()
        cur.close()
        conn.close()

        return json_response(200, {
            'result': 'denied',
            'message': 'ОТКАЗ: медосмотр не пройден',
            'person_name': person_name,
            'medical_ok': False,
            'direction': direction
        })

    cur.execute("""
        INSERT INTO checkpoint_passes (personnel_id, personal_code, full_name, direction, checkpoint_name, medical_ok, notes)
        VALUES (%d, '%s', '%s', '%s', '%s', %s, '%s')
        RETURNING id
    """ % (person_id, safe_code, safe_name, direction, checkpoint_name.replace("'", "''"),
           'TRUE' if medical_ok else 'FALSE', notes.replace("'", "''")))
    pass_id = cur.fetchone()[0]

    if direction == 'in':
        new_status = 'arrived'
        event_type = 'checkpoint_in'
        event_desc = 'КПП: %s — вход через %s' % (safe_name, checkpoint_name.replace("'", "''"))

        cur.execute("""
            UPDATE personnel SET status = 'arrived', updated_at = NOW() WHERE id = %d
        """ % person_id)

        cur.execute("""
            UPDATE aho_arrivals SET arrival_status = 'arrived', check_in_at = NOW(), updated_at = NOW()
            WHERE personnel_id = %d AND arrival_status = 'expected' AND is_hidden = FALSE
        """ % person_id)

    else:
        new_status = 'departed'
        event_type = 'checkpoint_out'
        event_desc = 'КПП: %s — выход через %s' % (safe_name, checkpoint_name.replace("'", "''"))

        cur.execute("""
            UPDATE personnel SET status = 'departed', updated_at = NOW() WHERE id = %d
        """ % person_id)

        cur.execute("""
            UPDATE aho_arrivals SET arrival_status = 'departed', check_out_at = NOW(), updated_at = NOW()
            WHERE personnel_id = %d AND arrival_status = 'arrived' AND is_hidden = FALSE
        """ % person_id)

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('%s', '%s', %d)
    """ % (event_type, event_desc, person_id))

    conn.commit()
    cur.close()
    conn.close()

    category_labels = {
        'mine': 'Рудничный', 'contractor': 'Подрядчик',
        'business_trip': 'Командированный', 'guest': 'Гость'
    }
    org_type_labels = {
        'rudnik': 'Рудник', 'guest': 'Гость',
        'contractor': 'Подрядная организация', 'gov': 'Гос.органы'
    }

    dir_label = 'Вход зафиксирован' if direction == 'in' else 'Выход зафиксирован'

    return json_response(200, {
        'result': 'allowed',
        'pass_id': pass_id,
        'message': dir_label,
        'direction': direction,
        'person_name': person_name,
        'medical_ok': medical_ok,
        'person': {
            'id': row[0],
            'personal_code': row[1],
            'full_name': row[2],
            'position': row[3] or '—',
            'department': row[4] or '—',
            'category': category_labels.get(row[5], row[5]),
            'organization': row[8] or '—',
            'organization_type': org_type_labels.get(row[9] or '', row[9] or '—')
        }
    })

def get_journal(params):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')
    direction = params.get('direction', '')
    page = int(params.get('page', '1'))
    per_page = int(params.get('per_page', '50'))
    offset = (page - 1) * per_page

    conn = get_db()
    cur = conn.cursor()

    where = "WHERE 1=1"
    if date_from:
        where += " AND cp.created_at >= '%s 00:00:00'" % date_from.replace("'", "''")
    if date_to:
        where += " AND cp.created_at <= '%s 23:59:59'" % date_to.replace("'", "''")
    if direction:
        where += " AND cp.direction = '%s'" % direction.replace("'", "''")

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes cp %s" % where)
    total = cur.fetchone()[0]

    cur.execute("""
        SELECT cp.id, cp.personnel_id, cp.personal_code, cp.full_name,
               cp.direction, cp.checkpoint_name, cp.medical_ok, cp.notes, cp.created_at,
               COALESCE(p.tab_number, '')
        FROM checkpoint_passes cp
        LEFT JOIN personnel p ON cp.personnel_id = p.id
        %s
        ORDER BY cp.created_at DESC
        LIMIT %d OFFSET %d
    """ % (where, per_page, offset))
    rows = cur.fetchall()

    cur.close()
    conn.close()

    items = [{
        'id': r[0], 'personnel_id': r[1], 'personal_code': r[2],
        'full_name': r[3],
        'direction': 'Вход' if r[4] == 'in' else 'Выход',
        'direction_raw': r[4],
        'checkpoint_name': r[5],
        'medical_ok': r[6],
        'notes': r[7] or '',
        'created_at': r[8],
        'tab_number': r[9] or ''
    } for r in rows]

    return json_response(200, {
        'items': items, 'total': total,
        'page': page, 'per_page': per_page,
        'pages': (total + per_page - 1) // per_page if per_page > 0 else 1
    })

def get_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes WHERE direction = 'in' AND created_at::date = CURRENT_DATE")
    today_in = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes WHERE direction = 'out' AND created_at::date = CURRENT_DATE")
    today_out = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes WHERE medical_ok = FALSE AND created_at::date = CURRENT_DATE")
    today_denied = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes")
    total_passes = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(DISTINCT personnel_id)
        FROM checkpoint_passes
        WHERE direction = 'in' AND created_at::date = CURRENT_DATE
        AND personnel_id NOT IN (
            SELECT DISTINCT personnel_id FROM checkpoint_passes
            WHERE direction = 'out' AND created_at::date = CURRENT_DATE
            AND personnel_id IS NOT NULL
        )
        AND personnel_id IS NOT NULL
    """)
    currently_on_site = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'today_in': today_in,
        'today_out': today_out,
        'today_denied': today_denied,
        'total_passes': total_passes,
        'currently_on_site': currently_on_site
    })

def get_on_site(params):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT ON (cp.personnel_id)
            cp.personnel_id, cp.personal_code, cp.full_name, cp.direction,
            cp.checkpoint_name, cp.created_at,
            p.position, p.department, p.organization, p.organization_type,
            COALESCE(p.tab_number, '')
        FROM checkpoint_passes cp
        LEFT JOIN personnel p ON cp.personnel_id = p.id
        WHERE cp.personnel_id IS NOT NULL
        AND cp.created_at::date = CURRENT_DATE
        ORDER BY cp.personnel_id, cp.created_at DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    on_site = []
    for r in rows:
        if r[3] == 'in':
            org_type_labels = {
                'rudnik': 'Рудник', 'guest': 'Гость',
                'contractor': 'Подрядная организация', 'gov': 'Гос.органы'
            }
            on_site.append({
                'personnel_id': r[0], 'personal_code': r[1], 'full_name': r[2],
                'checkpoint_name': r[4], 'entered_at': r[5],
                'position': r[6] or '—', 'department': r[7] or '—',
                'organization': r[8] or '—',
                'organization_type': org_type_labels.get(r[9] or '', r[9] or '—'),
                'tab_number': r[10] or ''
            })

    return json_response(200, {'items': on_site, 'total': len(on_site)})

def export_journal(params):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')

    conn = get_db()
    cur = conn.cursor()

    where = "WHERE 1=1"
    if date_from:
        where += " AND cp.created_at >= '%s 00:00:00'" % date_from.replace("'", "''")
    if date_to:
        where += " AND cp.created_at <= '%s 23:59:59'" % date_to.replace("'", "''")

    cur.execute("""
        SELECT cp.personal_code, cp.full_name, cp.direction, cp.checkpoint_name,
               cp.medical_ok, cp.notes, cp.created_at, COALESCE(p.tab_number, '')
        FROM checkpoint_passes cp
        LEFT JOIN personnel p ON cp.personnel_id = p.id
        %s
        ORDER BY cp.created_at DESC
        LIMIT 5000
    """ % where)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    lines = ['Код;ФИО;Таб. №;Направление;КПП;Медосмотр;Примечание;Дата и время']
    for r in rows:
        dt = r[6].strftime('%d.%m.%Y %H:%M') if r[6] else ''
        direction = 'Вход' if r[2] == 'in' else 'Выход'
        medical = 'Да' if r[4] else 'Нет'
        lines.append('%s;%s;%s;%s;%s;%s;%s;%s' % (
            r[0], r[1], r[7] or '', direction, r[3], medical, r[5] or '', dt
        ))

    csv_content = '\n'.join(lines)

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="checkpoint_journal.csv"',
            'Access-Control-Allow-Origin': '*'
        },
        'body': csv_content
    }
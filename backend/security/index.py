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
    """СБ — проверка подлинности пропусков, данные сотрудников, журнал проверок"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'POST' and action == 'verify':
        return verify_pass(body)
    elif method == 'GET' and action == 'person':
        return get_person_full(params)
    elif method == 'GET' and action == 'journal':
        return get_journal(params)
    elif method == 'GET' and action == 'stats':
        return get_stats()
    elif method == 'GET' and action == 'export':
        return export_journal(params)

    return json_response(404, {'error': 'Маршрут не найден'})

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

def verify_pass(body):
    raw_code = body.get('code', '').strip()
    notes = body.get('notes', '')
    checked_by = body.get('checked_by', '')

    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
               p.category, p.status, p.medical_status, p.room, p.shift,
               p.organization, p.organization_type, p.phone, p.tabular_number,
               p.qr_code, p.created_at
        FROM personnel p
        WHERE (p.personal_code = '%s' OR p.qr_code = '%s') AND p.is_hidden = FALSE
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.execute("""
            INSERT INTO security_checks (personal_code, full_name, check_type, result, notes, checked_by)
            VALUES ('%s', 'НЕ НАЙДЕН', 'pass_verification', 'not_found', '%s', '%s')
        """ % (safe_code, notes.replace("'", "''"), checked_by.replace("'", "''")))

        cur.execute("""
            INSERT INTO events (event_type, description)
            VALUES ('security_check_failed', 'СБ: Пропуск %s — не найден в системе')
        """ % safe_code)

        conn.commit()
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден в системе' % code, 'result': 'not_found'})

    person_id = row[0]
    person_name = row[2]
    safe_name = person_name.replace("'", "''")

    medical_ok = row[7] in ('passed', 'expiring')
    result = 'valid' if medical_ok else 'medical_issue'

    cur.execute("""
        INSERT INTO security_checks (personnel_id, personal_code, full_name, check_type, result, notes, checked_by)
        VALUES (%d, '%s', '%s', 'pass_verification', '%s', '%s', '%s')
        RETURNING id
    """ % (person_id, row[1].replace("'", "''"), safe_name, result, notes.replace("'", "''"), checked_by.replace("'", "''")))
    check_id = cur.fetchone()[0]

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('security_check', 'СБ: %s — пропуск %s', %d)
    """ % (safe_name, 'подтверждён' if result == 'valid' else 'ВНИМАНИЕ: медосмотр', person_id))

    category_labels = {
        'mine': 'Рудничный', 'contractor': 'Подрядчик',
        'business_trip': 'Командированный', 'guest': 'Гость'
    }
    status_labels = {
        'on_shift': 'На смене', 'arrived': 'Прибыл', 'departed': 'Убыл',
        'business_trip': 'Командировка'
    }
    medical_labels = {
        'passed': 'Пройден', 'failed': 'Не пройден',
        'pending': 'Ожидает', 'expiring': 'Истекает'
    }
    org_type_labels = {
        'rudnik': 'Рудник', 'guest': 'Гость',
        'contractor': 'Подрядная организация', 'gov': 'Гос.органы'
    }

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'result': result,
        'check_id': check_id,
        'message': 'Пропуск подтверждён' if result == 'valid' else 'Внимание: проблема с медосмотром',
        'person': {
            'id': row[0],
            'personal_code': row[1],
            'full_name': row[2],
            'position': row[3] or '—',
            'department': row[4] or '—',
            'category': category_labels.get(row[5], row[5]),
            'status': status_labels.get(row[6], row[6]),
            'medical_status': medical_labels.get(row[7], row[7] or '—'),
            'medical_ok': medical_ok,
            'room': row[8] or '—',
            'shift': row[9] or '—',
            'organization': row[10] or '—',
            'organization_type': org_type_labels.get(row[11] or '', row[11] or '—'),
            'phone': row[12] or '—',
            'tabular_number': row[13] or '—',
            'qr_code': row[14] or '',
            'registered_at': row[15]
        }
    })

def get_person_full(params):
    person_id = params.get('id', '')
    code = params.get('code', '')

    if not person_id and not code:
        return json_response(400, {'error': 'Укажите id или code'})

    conn = get_db()
    cur = conn.cursor()

    if person_id:
        cur.execute("""
            SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
                   p.category, p.status, p.medical_status, p.room, p.shift,
                   p.organization, p.organization_type, p.phone, p.tabular_number,
                   p.qr_code, p.created_at
            FROM personnel p
            WHERE p.id = %d AND p.is_hidden = FALSE
        """ % int(person_id))
    else:
        safe_code = code.replace("'", "''")
        cur.execute("""
            SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
                   p.category, p.status, p.medical_status, p.room, p.shift,
                   p.organization, p.organization_type, p.phone, p.tabular_number,
                   p.qr_code, p.created_at
            FROM personnel p
            WHERE (p.personal_code = '%s' OR p.qr_code = '%s') AND p.is_hidden = FALSE
            LIMIT 1
        """ % (safe_code, safe_code))

    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})

    pid = row[0]

    cur.execute("""
        SELECT id, check_type, result, notes, checked_by, created_at
        FROM security_checks
        WHERE personnel_id = %d
        ORDER BY created_at DESC LIMIT 10
    """ % pid)
    checks = cur.fetchall()

    cur.execute("""
        SELECT id, direction, checkpoint_name, medical_ok, created_at
        FROM checkpoint_passes
        WHERE personnel_id = %d
        ORDER BY created_at DESC LIMIT 10
    """ % pid)
    passes = cur.fetchall()

    cur.execute("""
        SELECT id, event_type, description, created_at
        FROM events
        WHERE personnel_id = %d AND is_hidden = FALSE
        ORDER BY created_at DESC LIMIT 20
    """ % pid)
    events = cur.fetchall()

    cur.close()
    conn.close()

    category_labels = {
        'mine': 'Рудничный', 'contractor': 'Подрядчик',
        'business_trip': 'Командированный', 'guest': 'Гость'
    }
    status_labels = {
        'on_shift': 'На смене', 'arrived': 'Прибыл', 'departed': 'Убыл',
        'business_trip': 'Командировка'
    }
    medical_labels = {
        'passed': 'Пройден', 'failed': 'Не пройден',
        'pending': 'Ожидает', 'expiring': 'Истекает'
    }
    org_type_labels = {
        'rudnik': 'Рудник', 'guest': 'Гость',
        'contractor': 'Подрядная организация', 'gov': 'Гос.органы'
    }
    result_labels = {
        'valid': 'Подтверждён', 'medical_issue': 'Проблема с медосмотром',
        'not_found': 'Не найден', 'expired': 'Просрочен'
    }

    return json_response(200, {
        'person': {
            'id': row[0],
            'personal_code': row[1],
            'full_name': row[2],
            'position': row[3] or '—',
            'department': row[4] or '—',
            'category': category_labels.get(row[5], row[5]),
            'status': status_labels.get(row[6], row[6]),
            'medical_status': medical_labels.get(row[7], row[7] or '—'),
            'medical_ok': row[7] in ('passed', 'expiring'),
            'room': row[8] or '—',
            'shift': row[9] or '—',
            'organization': row[10] or '—',
            'organization_type': org_type_labels.get(row[11] or '', row[11] or '—'),
            'phone': row[12] or '—',
            'tabular_number': row[13] or '—',
            'qr_code': row[14] or '',
            'registered_at': row[15]
        },
        'security_checks': [{
            'id': c[0], 'check_type': c[1],
            'result': result_labels.get(c[2], c[2]),
            'result_raw': c[2],
            'notes': c[3] or '', 'checked_by': c[4] or '',
            'created_at': c[5]
        } for c in checks],
        'checkpoint_passes': [{
            'id': p[0],
            'direction': 'Вход' if p[1] == 'in' else 'Выход',
            'direction_raw': p[1],
            'checkpoint_name': p[2],
            'medical_ok': p[3],
            'created_at': p[4]
        } for p in passes],
        'events': [{
            'id': e[0], 'type': e[1], 'description': e[2], 'created_at': e[3]
        } for e in events]
    })

def get_journal(params):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')
    result_filter = params.get('result', '')
    page = int(params.get('page', '1'))
    per_page = int(params.get('per_page', '50'))
    offset = (page - 1) * per_page

    conn = get_db()
    cur = conn.cursor()

    where = "WHERE 1=1"
    if date_from:
        where += " AND sc.created_at >= '%s 00:00:00'" % date_from.replace("'", "''")
    if date_to:
        where += " AND sc.created_at <= '%s 23:59:59'" % date_to.replace("'", "''")
    if result_filter:
        where += " AND sc.result = '%s'" % result_filter.replace("'", "''")

    cur.execute("""
        SELECT COUNT(*) FROM security_checks sc %s
    """ % where)
    total = cur.fetchone()[0]

    cur.execute("""
        SELECT sc.id, sc.personnel_id, sc.personal_code, sc.full_name,
               sc.check_type, sc.result, sc.notes, sc.checked_by, sc.created_at
        FROM security_checks sc
        %s
        ORDER BY sc.created_at DESC
        LIMIT %d OFFSET %d
    """ % (where, per_page, offset))
    rows = cur.fetchall()

    cur.close()
    conn.close()

    result_labels = {
        'valid': 'Подтверждён', 'medical_issue': 'Проблема с медосмотром',
        'not_found': 'Не найден', 'expired': 'Просрочен'
    }

    items = [{
        'id': r[0], 'personnel_id': r[1], 'personal_code': r[2],
        'full_name': r[3], 'check_type': r[4],
        'result': result_labels.get(r[5], r[5]),
        'result_raw': r[5],
        'notes': r[6] or '', 'checked_by': r[7] or '',
        'created_at': r[8]
    } for r in rows]

    return json_response(200, {
        'items': items, 'total': total,
        'page': page, 'per_page': per_page,
        'pages': (total + per_page - 1) // per_page if per_page > 0 else 1
    })

def get_stats():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM security_checks WHERE created_at::date = CURRENT_DATE")
    today_checks = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM security_checks WHERE result = 'valid' AND created_at::date = CURRENT_DATE")
    today_valid = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM security_checks WHERE result != 'valid' AND created_at::date = CURRENT_DATE")
    today_issues = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM security_checks")
    total_checks = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'today_checks': today_checks,
        'today_valid': today_valid,
        'today_issues': today_issues,
        'total_checks': total_checks
    })

def export_journal(params):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')

    conn = get_db()
    cur = conn.cursor()

    where = "WHERE 1=1"
    if date_from:
        where += " AND sc.created_at >= '%s 00:00:00'" % date_from.replace("'", "''")
    if date_to:
        where += " AND sc.created_at <= '%s 23:59:59'" % date_to.replace("'", "''")

    cur.execute("""
        SELECT sc.personal_code, sc.full_name, sc.result, sc.notes, sc.checked_by, sc.created_at
        FROM security_checks sc
        %s
        ORDER BY sc.created_at DESC
        LIMIT 5000
    """ % where)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    result_labels = {
        'valid': 'Подтверждён', 'medical_issue': 'Проблема с медосмотром',
        'not_found': 'Не найден', 'expired': 'Просрочен'
    }

    lines = ['Код;ФИО;Результат;Примечание;Проверил;Дата и время']
    for r in rows:
        dt = r[5].strftime('%d.%m.%Y %H:%M') if r[5] else ''
        lines.append('%s;%s;%s;%s;%s;%s' % (
            r[0], r[1], result_labels.get(r[2], r[2]), r[3] or '', r[4] or '', dt
        ))

    csv_content = '\n'.join(lines)

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="security_journal.csv"',
            'Access-Control-Allow-Origin': '*'
        },
        'body': csv_content
    }

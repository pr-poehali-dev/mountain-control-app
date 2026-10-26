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

def handler(event, context):
    """КПП — фиксация входа/выхода через сканер, журнал проходов, связь с АХО"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')
    HIDE_CODES['on'] = not caller_is_admin(event)

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'POST' and action == 'pass':
        return register_pass(body)
    elif method == 'GET' and action == 'journal':
        return get_journal(params, event)
    elif method == 'GET' and action == 'stats':
        return get_stats(event)
    elif method == 'GET' and action == 'on-site':
        return get_on_site(params, event)
    elif method == 'GET' and action == 'export':
        return export_journal(params, event)
    elif method == 'PUT' and action == 'pass-update':
        return update_pass(event, body)
    elif method == 'DELETE' and action == 'pass-delete':
        return delete_pass(event, body, params)
    elif method == 'GET' and action == 'vehicle-search':
        return vehicle_search(params, event)
    elif method == 'POST' and action == 'vehicle-pass':
        return vehicle_pass(body, event)
    elif method == 'GET' and action == 'vehicle-journal':
        return vehicle_journal(params, event)
    elif method == 'GET' and action == 'vehicle-export':
        return vehicle_export(params, event)

    return json_response(404, {'error': 'Маршрут не найден'})

def fmt_date(d):
    return d.strftime('%d.%m.%Y') if d else ''


def pass_period(permanent, d_from, d_to):
    if permanent:
        return 'Бессрочно'
    if d_from and d_to:
        return 'с %s по %s' % (fmt_date(d_from), fmt_date(d_to))
    if d_from:
        return 'с %s' % fmt_date(d_from)
    if d_to:
        return 'по %s' % fmt_date(d_to)
    return ''


def check_pass(number, permanent, d_from, d_to, title):
    """Возвращает состояние пропуска и причину отказа"""
    today = date_type.today()
    if permanent:
        return 'active', ''
    if not (number or '').strip() and not d_from and not d_to:
        return 'none', '%s не оформлен' % title
    if d_to and d_to < today:
        return 'expired', '%s истёк %s' % (title, fmt_date(d_to))
    if d_from and d_from > today:
        return 'future', '%s начнёт действовать с %s' % (title, fmt_date(d_from))
    if not d_from and not d_to:
        return 'none', 'У пропуска не указан срок действия'
    return 'active', ''


LAT = 'ABEKMHOPCTYX'
CYR = 'АВЕКМНОРСТУХ'


def norm_plate(val):
    v = ''.join(str(val or '').upper().split()).replace('-', '')
    return v.translate(str.maketrans(LAT, CYR))


PLATE_SQL = "TRANSLATE(REPLACE(REPLACE(UPPER(p.vehicle_number), ' ', ''), '-', ''), '%s', '%s')" % (LAT, CYR)


def find_vehicle(cur, plate, event):
    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    cur.execute("""
        SELECT p.id, p.full_name, p.position, p.organization, COALESCE(p.photo_url, ''),
               p.vehicle_number, p.vehicle_brand, p.vehicle_pass_number,
               p.vehicle_pass_permanent, p.vehicle_pass_valid_from, p.vehicle_pass_valid_to, p.personal_code
        FROM personnel p
        WHERE %s = '%s' AND p.status != 'archived' AND p.is_demo_data = %s
        ORDER BY p.id DESC LIMIT 1
    """ % (PLATE_SQL, plate.replace("'", "''"), demo_val))
    r = cur.fetchone()
    if not r:
        return None
    state, reason = check_pass(r[7], r[8], r[9], r[10], 'Пропуск на автомобиль')
    return {
        'personnel_id': r[0], 'owner_name': r[1], 'position': r[2] or '', 'organization': r[3] or '',
        'photo_url': r[4], 'vehicle_number': r[5], 'vehicle_brand': r[6] or '',
        'pass_number': r[7] or '', 'pass_period': pass_period(r[8], r[9], r[10]),
        'state': state, 'reason': reason, 'personal_code': r[11]
    }


def last_vehicle_direction(cur, plate):
    cur.execute("""
        SELECT direction FROM vehicle_passes
        WHERE TRANSLATE(REPLACE(REPLACE(UPPER(vehicle_number), ' ', ''), '-', ''), '%s', '%s') = '%s' AND allowed = TRUE
        ORDER BY created_at DESC, id DESC LIMIT 1
    """ % (LAT, CYR, plate.replace("'", "''")))
    r = cur.fetchone()
    return r[0] if r else ''


def vehicle_search(params, event):
    plate = norm_plate(params.get('number', ''))
    if len(plate) < 3:
        return json_response(400, {'error': 'Введите госномер полностью'})
    conn = get_db()
    cur = conn.cursor()
    v = find_vehicle(cur, plate, event)
    if v:
        v['on_site'] = last_vehicle_direction(cur, plate) == 'in'
    cur.close()
    conn.close()
    if not v:
        return json_response(404, {'error': 'Автомобиль %s не найден в базе пропусков' % plate})
    return json_response(200, {'vehicle': v})


def vehicle_pass(body, event):
    plate = norm_plate(body.get('number', ''))
    direction = body.get('direction', 'in')
    checkpoint_name = str(body.get('checkpoint_name') or 'КПП-1')[:100]
    if len(plate) < 3:
        return json_response(400, {'error': 'Введите госномер полностью'})
    if direction not in ('in', 'out'):
        return json_response(400, {'error': 'direction должен быть in или out'})
    conn = get_db()
    cur = conn.cursor()
    v = find_vehicle(cur, plate, event)
    if v:
        allowed = direction == 'out' or v['state'] == 'active'
        reason = '' if allowed else v['reason']
    else:
        allowed = False
        reason = 'Автомобиль не найден в базе пропусков'
    if direction == 'out' and not v:
        allowed = True
        reason = ''
    notes = '' if allowed else 'ОТКАЗ: ' + reason
    cur.execute("""
        INSERT INTO vehicle_passes (personnel_id, vehicle_number, vehicle_brand, owner_name, direction, checkpoint_name, allowed, notes)
        VALUES (%s, '%s', '%s', '%s', '%s', '%s', %s, '%s') RETURNING id, created_at
    """ % (v['personnel_id'] if v else 'NULL', plate, (v['vehicle_brand'] if v else '').replace("'", "''"),
           (v['owner_name'] if v else '').replace("'", "''"), direction, checkpoint_name.replace("'", "''"),
           'TRUE' if allowed else 'FALSE', notes.replace("'", "''")))
    rec = cur.fetchone()
    if v:
        desc = 'КПП: автомобиль %s (%s) — %s' % (plate, v['owner_name'],
               ('въезд' if direction == 'in' else 'выезд') if allowed else 'отказ во въезде. ' + reason)
        cur.execute("INSERT INTO events (event_type, description, personnel_id) VALUES ('%s', '%s', %d)" % (
            'vehicle_' + (direction if allowed else 'denied'), desc.replace("'", "''"), v['personnel_id']))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {
        'result': 'allowed' if allowed else 'denied',
        'message': ('Въезд разрешён' if direction == 'in' else 'Выезд зафиксирован') if allowed else 'Въезд запрещён',
        'reason': reason,
        'direction': direction,
        'vehicle': v,
        'vehicle_number': plate,
        'pass_id': rec[0]
    })


def vehicle_journal(params, event):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')
    page = max(1, int(params.get('page', '1')))
    per_page = 50
    where = "WHERE 1=1"
    if date_from:
        where += " AND vp.created_at >= '%s 00:00:00'" % date_from.replace("'", "''")
    if date_to:
        where += " AND vp.created_at <= '%s 23:59:59'" % date_to.replace("'", "''")
    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    where += " AND (p.id IS NULL OR p.is_demo_data = %s)" % demo_val
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM vehicle_passes vp LEFT JOIN personnel p ON p.id = vp.personnel_id %s" % where)
    total = cur.fetchone()[0]
    cur.execute("""
        SELECT vp.id, vp.vehicle_number, vp.vehicle_brand, vp.owner_name, vp.direction,
               vp.checkpoint_name, vp.allowed, vp.notes, vp.created_at
        FROM vehicle_passes vp LEFT JOIN personnel p ON p.id = vp.personnel_id
        %s ORDER BY vp.created_at DESC, vp.id DESC LIMIT %d OFFSET %d
    """ % (where, per_page, (page - 1) * per_page))
    rows = cur.fetchall()
    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT DISTINCT ON (vehicle_number) vehicle_number, direction FROM vehicle_passes
            WHERE allowed = TRUE ORDER BY vehicle_number, created_at DESC, id DESC
        ) t WHERE t.direction = 'in'
    """)
    on_site = cur.fetchone()[0]
    cur.close()
    conn.close()
    items = [{
        'id': r[0], 'vehicle_number': r[1], 'vehicle_brand': r[2], 'owner_name': r[3],
        'direction': 'Въезд' if r[4] == 'in' else 'Выезд', 'direction_raw': r[4],
        'checkpoint_name': r[5], 'allowed': r[6], 'notes': r[7], 'created_at': r[8]
    } for r in rows]
    return json_response(200, {'items': items, 'total': total, 'page': page,
                               'pages': max(1, (total + per_page - 1) // per_page), 'on_site': on_site})


def vehicle_export(params, event):
    """Выгрузка журнала автомобилей в Excel с фильтром по датам"""
    import base64
    from io import BytesIO
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')
    try:
        if date_from:
            datetime.strptime(date_from, '%Y-%m-%d')
        if date_to:
            datetime.strptime(date_to, '%Y-%m-%d')
    except ValueError:
        return json_response(400, {'error': 'Неверный формат даты'})
    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    where = "WHERE (p.id IS NULL OR p.is_demo_data = %s)" % demo_val
    if date_from:
        where += " AND vp.created_at >= '%s 00:00:00'" % date_from
    if date_to:
        where += " AND vp.created_at <= '%s 23:59:59'" % date_to
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT vp.created_at, vp.vehicle_number, vp.vehicle_brand, vp.owner_name,
               COALESCE(p.position, ''), COALESCE(p.organization, ''),
               vp.direction, vp.allowed, vp.notes, vp.checkpoint_name
        FROM vehicle_passes vp LEFT JOIN personnel p ON p.id = vp.personnel_id
        %s ORDER BY vp.created_at DESC, vp.id DESC LIMIT 20000
    """ % where)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Журнал автомобилей'
    thin = Side(style='thin', color='CCCCCC')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    period = 'за всё время'
    if date_from or date_to:
        period = 'с %s по %s' % (
            datetime.strptime(date_from, '%Y-%m-%d').strftime('%d.%m.%Y') if date_from else '…',
            datetime.strptime(date_to, '%Y-%m-%d').strftime('%d.%m.%Y') if date_to else '…')
    ws.cell(row=1, column=1, value='Журнал въезда и выезда автомобилей %s' % period).font = Font(name='Arial', bold=True, size=13)
    allowed_cnt = sum(1 for r in rows if r[7])
    ws.cell(row=2, column=1, value='Всего записей: %d · въездов: %d · выездов: %d · отказов: %d' % (
        len(rows), sum(1 for r in rows if r[7] and r[6] == 'in'), sum(1 for r in rows if r[7] and r[6] == 'out'),
        len(rows) - allowed_cnt)).font = Font(name='Arial', size=10, color='666666')

    headers = ['Дата', 'Время', 'Госномер', 'Марка, модель', 'Владелец', 'Должность', 'Организация', 'Направление', 'Результат', 'Причина отказа', 'КПП']
    widths = [12, 8, 14, 20, 32, 24, 28, 12, 12, 40, 10]
    head_fill = PatternFill(start_color='1F2937', end_color='1F2937', fill_type='solid')
    for i, (h, w) in enumerate(zip(headers, widths), 1):
        c = ws.cell(row=4, column=i, value=h)
        c.font = Font(name='Arial', bold=True, color='FFFFFF', size=10)
        c.fill = head_fill
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        c.border = border
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    denied_fill = PatternFill(start_color='FDE2E2', end_color='FDE2E2', fill_type='solid')
    for n, r in enumerate(rows, 5):
        reason = (r[8] or '').replace('ОТКАЗ:', '').strip() if not r[7] else ''
        vals = [r[0].strftime('%d.%m.%Y'), r[0].strftime('%H:%M'), r[1], r[2] or '', r[3] or 'Не найден в базе',
                r[4], r[5], 'Въезд' if r[6] == 'in' else 'Выезд', 'Разрешён' if r[7] else 'Отказ', reason, r[9] or '']
        for i, v in enumerate(vals, 1):
            c = ws.cell(row=n, column=i, value=v)
            c.font = Font(name='Arial', size=10, bold=(i == 3), color=('B91C1C' if not r[7] and i in (9, 10) else '000000'))
            c.border = border
            c.alignment = Alignment(vertical='center', wrap_text=(i == 10))
            if not r[7]:
                c.fill = denied_fill
    ws.freeze_panes = 'A5'
    if rows:
        ws.auto_filter.ref = 'A4:K%d' % (len(rows) + 4)

    buf = BytesIO()
    wb.save(buf)
    name = 'Журнал_автомобилей'
    if date_from or date_to:
        name += '_%s_%s' % (date_from or 'начало', date_to or 'сегодня')
    return json_response(200, {'file': base64.b64encode(buf.getvalue()).decode(), 'file_name': name + '.xlsx', 'total': len(rows)})


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
               p.category, p.status, p.medical_status, p.organization, p.organization_type,
               COALESCE(p.pass_number, ''), p.pass_permanent, p.pass_valid_from, p.pass_valid_to
        FROM personnel p
        WHERE (p.personal_code = '%s' OR p.qr_code = '%s') AND p.is_hidden = FALSE AND p.status != 'archived'
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

    category_labels = {
        'mine': 'Рудничный', 'contractor': 'Подрядчик',
        'business_trip': 'Командированный', 'guest': 'Гость'
    }
    org_type_labels = {
        'rudnik': 'Рудник', 'guest': 'Гость',
        'contractor': 'Подрядная организация', 'gov': 'Гос.органы'
    }
    person_info = {
        'id': row[0],
        'personal_code': row[1],
        'full_name': row[2],
        'position': row[3] or '—',
        'department': row[4] or '—',
        'category': category_labels.get(row[5], row[5]),
        'organization': row[8] or '—',
        'organization_type': org_type_labels.get(row[9] or '', row[9] or '—'),
        'pass_number': row[10] or '',
        'pass_period': pass_period(row[11], row[12], row[13])
    }

    if direction == 'in':
        state, reason = check_pass(row[10], row[11], row[12], row[13], 'Личный пропуск')
        if state != 'active':
            cur.execute("""
                INSERT INTO checkpoint_passes (personnel_id, personal_code, full_name, direction, checkpoint_name, medical_ok, notes)
                VALUES (%d, '%s', '%s', 'in', '%s', %s, '%s')
            """ % (person_id, safe_code, safe_name, checkpoint_name.replace("'", "''"),
                   'TRUE' if medical_ok else 'FALSE', ('ОТКАЗ: ' + reason).replace("'", "''")))
            cur.execute("""
                INSERT INTO events (event_type, description, personnel_id)
                VALUES ('checkpoint_denied', '%s', %d)
            """ % (('КПП: %s — отказ во входе. %s' % (person_name, reason)).replace("'", "''"), person_id))
            conn.commit()
            cur.close()
            conn.close()
            return json_response(200, {
                'result': 'denied',
                'message': 'Проход запрещён',
                'reason': reason,
                'direction': direction,
                'person_name': person_name,
                'medical_ok': medical_ok,
                'person': person_info
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
    sync_rooms(cur)

    conn.commit()
    cur.close()
    conn.close()

    dir_label = 'Вход зафиксирован' if direction == 'in' else 'Выход зафиксирован'

    return json_response(200, {
        'result': 'allowed',
        'pass_id': pass_id,
        'message': dir_label,
        'direction': direction,
        'person_name': person_name,
        'medical_ok': medical_ok,
        'person': person_info
    })

def get_journal(params, event):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')
    direction = params.get('direction', '')
    page = int(params.get('page', '1'))
    per_page = int(params.get('per_page', '50'))
    offset = (page - 1) * per_page

    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    where = "WHERE (p.id IS NULL OR p.is_demo_data = %s)" % demo_val
    if date_from:
        where += " AND cp.created_at >= '%s 00:00:00'" % date_from.replace("'", "''")
    if date_to:
        where += " AND cp.created_at <= '%s 23:59:59'" % date_to.replace("'", "''")
    if direction:
        where += " AND cp.direction = '%s'" % direction.replace("'", "''")

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes cp LEFT JOIN personnel p ON cp.personnel_id = p.id %s" % where)
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

def get_stats(event):
    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    demo_join = "JOIN personnel p ON cp.personnel_id = p.id AND p.is_demo_data = %s" % demo_val

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes cp %s WHERE cp.direction = 'in' AND cp.created_at::date = CURRENT_DATE" % demo_join)
    today_in = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes cp %s WHERE cp.direction = 'out' AND cp.created_at::date = CURRENT_DATE" % demo_join)
    today_out = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes cp %s WHERE cp.notes LIKE 'ОТКАЗ%%' AND cp.created_at::date = CURRENT_DATE" % demo_join)
    today_denied = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM checkpoint_passes cp LEFT JOIN personnel p ON cp.personnel_id = p.id WHERE (p.id IS NULL OR p.is_demo_data = %s)" % demo_val)
    total_passes = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT DISTINCT ON (cp.personnel_id) cp.personnel_id, cp.direction
            FROM checkpoint_passes cp
            JOIN personnel p ON cp.personnel_id = p.id AND p.is_demo_data = %s AND p.status <> 'archived'
            WHERE cp.personnel_id IS NOT NULL AND COALESCE(cp.notes, '') NOT LIKE 'ОТКАЗ%%'
            ORDER BY cp.personnel_id, cp.created_at DESC, cp.id DESC
        ) last_pass WHERE last_pass.direction = 'in'
    """ % demo_val)
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

def get_on_site(params, event):
    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'

    cur.execute("""
        SELECT DISTINCT ON (cp.personnel_id)
            cp.personnel_id, cp.personal_code, cp.full_name, cp.direction,
            cp.checkpoint_name, cp.created_at,
            p.position, p.department, p.organization, p.organization_type,
            COALESCE(p.tab_number, '')
        FROM checkpoint_passes cp
        LEFT JOIN personnel p ON cp.personnel_id = p.id
        WHERE cp.personnel_id IS NOT NULL
        AND COALESCE(cp.notes, '') NOT LIKE 'ОТКАЗ%%'
        AND (p.id IS NULL OR (p.is_demo_data = %s AND p.status <> 'archived'))
        ORDER BY cp.personnel_id, cp.created_at DESC, cp.id DESC
    """ % demo_val)
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

def export_journal(params, event):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')

    conn = get_db()
    cur = conn.cursor()

    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    where = "WHERE (p.id IS NULL OR p.is_demo_data = %s)" % demo_val
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

    show_code = caller_is_admin(event)
    lines = [('Код;' if show_code else '') + 'ФИО;Таб. №;Направление;КПП;Медосмотр;Примечание;Дата и время']
    for r in rows:
        dt = r[6].strftime('%d.%m.%Y %H:%M') if r[6] else ''
        direction = 'Вход' if r[2] == 'in' else 'Выход'
        medical = 'Да' if r[4] else 'Нет'
        lines.append(('%s;' % r[0] if show_code else '') + '%s;%s;%s;%s;%s;%s;%s' % (
            r[1], r[7] or '', direction, r[3], medical, r[5] or '', dt
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

def get_auth_token(event):
    headers = event.get('headers') or {}
    for key in ['X-Authorization', 'x-authorization', 'Authorization', 'authorization']:
        val = headers.get(key, '')
        if val:
            return val[7:] if val.startswith('Bearer ') else val
    return ''


def get_admin(cur, event):
    token = get_auth_token(event)
    if not token:
        return None
    cur.execute("""
        SELECT u.id, u.full_name FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE AND u.role = 'admin'
    """ % token.replace("'", "''"))
    return cur.fetchone()


def sync_person_status(cur, personnel_id):
    if not personnel_id:
        return
    cur.execute("""
        SELECT direction FROM checkpoint_passes
        WHERE personnel_id = %d AND COALESCE(notes, '') NOT LIKE 'ОТКАЗ%%'
        ORDER BY created_at DESC, id DESC LIMIT 1
    """ % int(personnel_id))
    row = cur.fetchone()
    if not row:
        return
    new_status = 'arrived' if row[0] == 'in' else 'departed'
    cur.execute("""
        UPDATE personnel SET status = '%s', updated_at = NOW()
        WHERE id = %d AND status IN ('arrived', 'departed', 'on_shift')
    """ % (new_status, int(personnel_id)))
    sync_rooms(cur)


def update_pass(event, body):
    pass_id = body.get('id')
    if not pass_id:
        return json_response(400, {'error': 'Не указана запись'})

    conn = get_db()
    cur = conn.cursor()
    admin = get_admin(cur, event)
    if not admin:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Редактировать журнал может только администратор'})

    cur.execute("SELECT id, personnel_id, full_name FROM checkpoint_passes WHERE id = %d" % int(pass_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Запись не найдена'})

    sets = []
    direction = body.get('direction')
    if direction is not None:
        if direction not in ('in', 'out'):
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Неверное направление'})
        sets.append("direction = '%s'" % direction)
    if body.get('checkpoint_name') is not None:
        name = str(body['checkpoint_name']).strip()[:100] or 'КПП-1'
        sets.append("checkpoint_name = '%s'" % name.replace("'", "''"))
    if body.get('notes') is not None:
        sets.append("notes = '%s'" % str(body['notes']).replace("'", "''"))
    if body.get('medical_ok') is not None:
        sets.append("medical_ok = %s" % ('TRUE' if body['medical_ok'] else 'FALSE'))
    if body.get('created_at'):
        raw = str(body['created_at']).strip().replace('Z', '+00:00')
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Неверная дата'})
        if dt.tzinfo is not None:
            from datetime import timezone
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        sets.append("created_at = '%s'" % dt.strftime('%Y-%m-%d %H:%M:%S'))

    if not sets:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Нет изменений'})

    cur.execute("UPDATE checkpoint_passes SET %s WHERE id = %d" % (', '.join(sets), int(pass_id)))
    sync_person_status(cur, row[1])
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'success': True})


def delete_pass(event, body, params):
    pass_id = body.get('id') or params.get('id')
    if not pass_id:
        return json_response(400, {'error': 'Не указана запись'})

    conn = get_db()
    cur = conn.cursor()
    admin = get_admin(cur, event)
    if not admin:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Удалять записи журнала может только администратор'})

    cur.execute("SELECT id, personnel_id, full_name, direction, created_at FROM checkpoint_passes WHERE id = %d" % int(pass_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Запись не найдена'})

    cur.execute("DELETE FROM checkpoint_passes WHERE id = %d" % int(pass_id))
    sync_person_status(cur, row[1])
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'success': True})

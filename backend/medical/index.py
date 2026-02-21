import json
import os
import csv
import io
from datetime import datetime, time, date as date_type
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

def csv_response(csv_text):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="medical_report.csv"',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': csv_text
    }

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

def get_shift_schedule():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT value FROM settings WHERE key = 'shift_schedule' LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        v = row[0] if isinstance(row[0], dict) else json.loads(row[0])
        return v
    return {'day_start': '05:00', 'day_end': '17:00', 'night_start': '17:00', 'night_end': '05:00'}

def parse_hm(s):
    parts = s.split(':')
    return int(parts[0]), int(parts[1])

def detect_shift():
    """Определяет текущую смену и направление по времени"""
    now = datetime.utcnow()
    try:
        import pytz
        tz = pytz.timezone('Asia/Yakutsk')
        now = datetime.now(tz)
    except Exception:
        pass

    schedule = get_shift_schedule()
    day_start_h, day_start_m = parse_hm(schedule.get('day_start', '05:00'))
    day_end_h, day_end_m = parse_hm(schedule.get('day_end', '17:00'))

    hour = now.hour
    minute = now.minute
    current_minutes = hour * 60 + minute
    day_start_minutes = day_start_h * 60 + day_start_m
    day_end_minutes = day_end_h * 60 + day_end_m

    shift_date = now.date()

    if day_start_minutes <= current_minutes < day_end_minutes:
        shift_type = 'day'
        mid = day_start_minutes + (day_end_minutes - day_start_minutes) // 2
        if current_minutes < mid:
            check_direction = 'to_shift'
        else:
            check_direction = 'from_shift'
    else:
        shift_type = 'night'
        if current_minutes >= day_end_minutes:
            check_direction = 'to_shift'
        else:
            check_direction = 'from_shift'
            from datetime import timedelta
            shift_date = (now - timedelta(days=1)).date()

    return shift_type, check_direction, str(shift_date)

SHIFT_LABELS = {'day': 'Дневная', 'night': 'Ночная'}
DIRECTION_LABELS = {'to_shift': 'На смену', 'from_shift': 'Со смены'}

def auto_reset_if_needed():
    """Сбрасывает medical_status всех сотрудников в pending при начале новой смены"""
    shift_type, check_direction, shift_date = detect_shift()
    if check_direction != 'to_shift':
        return

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id FROM medical_reset_log
            WHERE shift_type = '%s' AND shift_date = '%s'
        """ % (shift_type, shift_date))
        exists = cur.fetchone()

        if not exists:
            cur.execute("""
                UPDATE personnel SET medical_status = 'pending', updated_at = NOW()
                WHERE status != 'archived' AND medical_status != 'pending'
            """)
            reset_count = cur.rowcount

            cur.execute("""
                INSERT INTO medical_reset_log (shift_type, shift_date, reset_count)
                VALUES ('%s', '%s', %d)
            """ % (shift_type, shift_date, reset_count))

            if reset_count > 0:
                shift_label = SHIFT_LABELS.get(shift_type, shift_type)
                cur.execute("""
                    INSERT INTO events (event_type, description)
                    VALUES ('medical_reset', 'Автосброс медосмотров: %s смена %s — %d чел.')
                """ % (shift_label, shift_date, reset_count))

                cur.execute("""
                    INSERT INTO notifications (type, title, message)
                    VALUES ('medical_reset', 'Автосброс медосмотров', '%s смена %s — сброшено %d чел. Требуется повторный медосмотр.')
                """ % (shift_label, shift_date, reset_count))

            conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def handler(event, context):
    """Медицинский контроль — предсменные/послесменные осмотры, смены, история, экспорт, автосброс"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    auto_reset_if_needed()

    if method == 'GET' and action in ('list', ''):
        return get_checks(params)
    elif method == 'GET' and action == 'stats':
        return get_medical_stats(params)
    elif method == 'GET' and action == 'shift':
        return get_current_shift()
    elif method == 'GET' and action == 'export':
        return export_csv(params)
    elif method == 'POST' and action == 'add':
        return add_check(body)
    elif method == 'POST' and action == 'scan':
        return scan_medical(body)
    elif method == 'POST' and action == 'deny':
        return deny_medical(body)
    elif method == 'GET' and action == 'schedule':
        return get_schedule()
    elif method == 'POST' and action == 'schedule':
        return save_schedule(body)

    return json_response(404, {'error': 'Маршрут не найден'})

def get_current_shift():
    shift_type, check_direction, shift_date = detect_shift()
    schedule = get_shift_schedule()
    return json_response(200, {
        'shift_type': shift_type,
        'shift_label': SHIFT_LABELS.get(shift_type, shift_type),
        'check_direction': check_direction,
        'direction_label': DIRECTION_LABELS.get(check_direction, check_direction),
        'shift_date': shift_date,
        'schedule': schedule
    })

def get_schedule():
    return json_response(200, get_shift_schedule())

def save_schedule(body):
    day_start = body.get('day_start', '').strip()
    day_end = body.get('day_end', '').strip()
    night_start = body.get('night_start', '').strip()
    night_end = body.get('night_end', '').strip()

    if not day_start or not day_end:
        return json_response(400, {'error': 'Укажите время начала и конца дневной смены'})

    if not night_start:
        night_start = day_end
    if not night_end:
        night_end = day_start

    value = json.dumps({'day_start': day_start, 'day_end': day_end, 'night_start': night_start, 'night_end': night_end}, ensure_ascii=False)
    safe_value = value.replace("'", "''")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM settings WHERE key = 'shift_schedule' LIMIT 1")
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE settings SET value = '%s'::jsonb, updated_at = NOW() WHERE key = 'shift_schedule'" % safe_value)
    else:
        cur.execute("INSERT INTO settings (key, value) VALUES ('shift_schedule', '%s'::jsonb)" % safe_value)
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Расписание смен сохранено', 'schedule': {'day_start': day_start, 'day_end': day_end, 'night_start': night_start, 'night_end': night_end}})

def get_checks(params):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')
    shift_type = params.get('shift_type', '')
    direction = params.get('direction', '')
    limit = int(params.get('limit', '100'))

    conn = get_db()
    cur = conn.cursor()

    where = ["p.status != 'archived'", "p.is_hidden = FALSE", "mc.is_hidden = FALSE"]
    if date_from:
        where.append("mc.shift_date >= '%s'" % date_from.replace("'", ""))
    if date_to:
        where.append("mc.shift_date <= '%s'" % date_to.replace("'", ""))
    if shift_type and shift_type in ('day', 'night'):
        where.append("mc.shift_type = '%s'" % shift_type)
    if direction and direction in ('to_shift', 'from_shift'):
        where.append("mc.check_direction = '%s'" % direction)

    where_sql = ' AND '.join(where)

    cur.execute("""
        SELECT mc.id, mc.check_type, mc.status, mc.blood_pressure, mc.pulse,
               mc.alcohol_level, mc.temperature, mc.doctor_name, mc.checked_at, mc.notes,
               p.full_name, p.personal_code, p.department, p.organization,
               mc.shift_type, mc.check_direction, mc.shift_date
        FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE %s
        ORDER BY mc.checked_at DESC
        LIMIT %d
    """ % (where_sql, limit))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    checks = []
    for r in rows:
        checks.append({
            'id': r[0], 'check_type': r[1], 'status': r[2],
            'blood_pressure': r[3], 'pulse': r[4],
            'alcohol_level': float(r[5]) if r[5] else 0,
            'temperature': float(r[6]) if r[6] else 0,
            'doctor_name': r[7], 'checked_at': r[8], 'notes': r[9],
            'person_name': r[10], 'person_code': r[11], 'department': r[12],
            'organization': r[13] or '',
            'shift_type': r[14] or 'day',
            'shift_label': SHIFT_LABELS.get(r[14] or 'day', ''),
            'check_direction': r[15] or 'to_shift',
            'direction_label': DIRECTION_LABELS.get(r[15] or 'to_shift', ''),
            'shift_date': r[16]
        })

    return json_response(200, {'checks': checks, 'total': len(checks)})

def get_medical_stats(params):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')

    conn = get_db()
    cur = conn.cursor()

    date_filter = "checked_at::date = CURRENT_DATE"
    if date_from and date_to:
        date_filter = "mc.shift_date >= '%s' AND mc.shift_date <= '%s'" % (
            date_from.replace("'", ""), date_to.replace("'", ""))
    elif date_from:
        date_filter = "mc.shift_date >= '%s'" % date_from.replace("'", "")

    cur.execute("""
        SELECT mc.status, COUNT(*) FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE p.status != 'archived' AND p.is_hidden = FALSE AND mc.is_hidden = FALSE AND %s
        GROUP BY mc.status
    """ % date_filter)
    period = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("""
        SELECT mc.shift_type, mc.check_direction, mc.status, COUNT(*)
        FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE p.status != 'archived' AND p.is_hidden = FALSE AND mc.is_hidden = FALSE AND %s
        GROUP BY mc.shift_type, mc.check_direction, mc.status
    """ % date_filter)
    by_shift = {}
    for r in cur.fetchall():
        key = '%s_%s' % (r[0] or 'day', r[1] or 'to_shift')
        if key not in by_shift:
            by_shift[key] = {'passed': 0, 'failed': 0}
        by_shift[key][r[2]] = by_shift[key].get(r[2], 0) + r[3]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE")
    total_personnel = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE AND medical_status = 'passed'")
    med_passed = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE AND medical_status = 'failed'")
    med_failed = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' AND is_hidden = FALSE AND medical_status IN ('pending', '')")
    med_pending = cur.fetchone()[0]

    cur.close()
    conn.close()

    return json_response(200, {
        'period': {
            'passed': period.get('passed', 0),
            'failed': period.get('failed', 0),
        },
        'by_shift': by_shift,
        'passed': med_passed,
        'failed': med_failed,
        'pending': med_pending,
        'total': total_personnel
    })

def scan_medical(body):
    raw_code = body.get('code', '').strip()
    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")
    shift_type, check_direction, shift_date = detect_shift()

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, full_name, personal_code, position, department, medical_status, organization
        FROM personnel
        WHERE (personal_code = '%s' OR qr_code = '%s') AND status != 'archived'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    person_id = row[0]
    person_name = row[1]
    person_code = row[2]
    position = row[3]
    department = row[4]
    old_medical = row[5]
    organization = row[6] or ''

    shift_label = SHIFT_LABELS.get(shift_type, shift_type)
    dir_label = DIRECTION_LABELS.get(check_direction, check_direction)

    cur.execute("""
        INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes, shift_type, check_direction, shift_date)
        VALUES (%d, 'pre_shift', 'passed', '', 0, 0, 0, 'QR-скан', '%s — %s', '%s', '%s', '%s')
        RETURNING id
    """ % (person_id, shift_label, dir_label, shift_type, check_direction, shift_date))
    check_id = cur.fetchone()[0]

    cur.execute("""
        UPDATE personnel SET medical_status = 'passed', updated_at = NOW() WHERE id = %d
    """ % person_id)

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('medical_pass', '%s — прошёл медосмотр (%s, %s)', %d)
    """ % (person_name.replace("'", "''"), shift_label, dir_label, person_id))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'result': 'passed',
        'check_id': check_id,
        'shift_type': shift_type,
        'shift_label': shift_label,
        'check_direction': check_direction,
        'direction_label': dir_label,
        'shift_date': shift_date,
        'person': {
            'id': person_id,
            'full_name': person_name,
            'personal_code': person_code,
            'position': position,
            'department': department,
            'organization': organization,
            'old_medical': old_medical,
            'new_medical': 'passed'
        },
        'message': '%s — медосмотр пройден (%s, %s)' % (person_name, shift_label, dir_label)
    })

def deny_medical(body):
    raw_code = body.get('code', '').strip()
    reason = body.get('reason', '').strip()
    if not raw_code:
        return json_response(400, {'error': 'Код не указан'})

    code = parse_qr_code(raw_code)
    safe_code = code.replace("'", "''")
    safe_reason = reason.replace("'", "''") if reason else 'Без указания причины'
    shift_type, check_direction, shift_date = detect_shift()

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, full_name, personal_code, position, department, medical_status, organization
        FROM personnel
        WHERE (personal_code = '%s' OR qr_code = '%s') AND status != 'archived'
        LIMIT 1
    """ % (safe_code, safe_code))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник с кодом %s не найден' % code})

    person_id = row[0]
    person_name = row[1]
    person_code = row[2]
    position = row[3]
    department = row[4]
    old_medical = row[5]
    organization = row[6] or ''

    shift_label = SHIFT_LABELS.get(shift_type, shift_type)
    dir_label = DIRECTION_LABELS.get(check_direction, check_direction)

    cur.execute("""
        INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes, shift_type, check_direction, shift_date)
        VALUES (%d, 'pre_shift', 'failed', '', 0, 0, 0, 'QR-скан', '%s | %s — %s', '%s', '%s', '%s')
        RETURNING id
    """ % (person_id, safe_reason, shift_label, dir_label, shift_type, check_direction, shift_date))
    check_id = cur.fetchone()[0]

    cur.execute("""
        UPDATE personnel SET medical_status = 'failed', updated_at = NOW() WHERE id = %d
    """ % person_id)

    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('medical_fail', '%s — отказ в медосмотре: %s (%s, %s)', %d)
    """ % (person_name.replace("'", "''"), safe_reason, shift_label, dir_label, person_id))

    cur.execute("""
        INSERT INTO notifications (type, title, message, person_name, person_code)
        VALUES ('medical_deny', 'Отказ в медосмотре', '%s — %s (%s, %s)', '%s', '%s')
    """ % (person_name.replace("'", "''"), safe_reason, shift_label, dir_label, person_name.replace("'", "''"), person_code.replace("'", "''")))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'result': 'denied',
        'check_id': check_id,
        'shift_type': shift_type,
        'shift_label': shift_label,
        'check_direction': check_direction,
        'direction_label': dir_label,
        'shift_date': shift_date,
        'person': {
            'id': person_id,
            'full_name': person_name,
            'personal_code': person_code,
            'position': position,
            'department': department,
            'organization': organization,
            'old_medical': old_medical,
            'new_medical': 'failed'
        },
        'message': '%s — отказ: %s (%s, %s)' % (person_name, reason or 'без причины', shift_label, dir_label)
    })

def add_check(body):
    personnel_id = body.get('personnel_id')
    check_type = body.get('check_type', 'pre_shift')
    blood_pressure = body.get('blood_pressure', '')
    pulse = body.get('pulse', 0)
    alcohol_level = body.get('alcohol_level', 0.0)
    temperature = body.get('temperature', 0.0)
    doctor_name = body.get('doctor_name', '')
    notes = body.get('notes', '')

    if not personnel_id:
        return json_response(400, {'error': 'ID сотрудника обязателен'})

    status = 'passed'
    if float(alcohol_level) > 0.0:
        status = 'failed'
    if float(temperature) > 37.0:
        status = 'failed'

    bp_parts = blood_pressure.split('/')
    if len(bp_parts) == 2:
        systolic = int(bp_parts[0])
        if systolic > 150 or systolic < 90:
            status = 'failed'

    shift_type, check_direction, shift_date = detect_shift()

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature, doctor_name, notes, shift_type, check_direction, shift_date)
        VALUES (%d, '%s', '%s', '%s', %d, %s, %s, '%s', '%s', '%s', '%s', '%s')
        RETURNING id
    """ % (
        int(personnel_id),
        check_type.replace("'", "''"),
        status,
        blood_pressure.replace("'", "''"),
        int(pulse),
        float(alcohol_level),
        float(temperature),
        doctor_name.replace("'", "''"),
        notes.replace("'", "''"),
        shift_type,
        check_direction,
        shift_date
    ))
    check_id = cur.fetchone()[0]

    cur.execute("""
        UPDATE personnel SET medical_status = '%s', updated_at = NOW() WHERE id = %d
    """ % (status, int(personnel_id)))

    cur.execute("SELECT full_name FROM personnel WHERE id = %d" % int(personnel_id))
    person_name = cur.fetchone()[0]

    shift_label = SHIFT_LABELS.get(shift_type, shift_type)
    dir_label = DIRECTION_LABELS.get(check_direction, check_direction)
    event_type = 'medical_pass' if status == 'passed' else 'medical_fail'
    event_desc = '%s — %s медосмотр (%s, %s)' % (person_name.replace("'", "''"), 'прошёл' if status == 'passed' else 'не прошёл', shift_label, dir_label)
    cur.execute("""
        INSERT INTO events (event_type, description, personnel_id)
        VALUES ('%s', '%s', %d)
    """ % (event_type, event_desc, int(personnel_id)))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'id': check_id,
        'status': status,
        'shift_type': shift_type,
        'shift_label': shift_label,
        'check_direction': check_direction,
        'direction_label': dir_label,
        'message': 'Медосмотр записан. Результат: %s' % ('допущен' if status == 'passed' else 'не допущен')
    })

def export_csv(params):
    date_from = params.get('date_from', '')
    date_to = params.get('date_to', '')
    shift_type = params.get('shift_type', '')
    direction = params.get('direction', '')

    conn = get_db()
    cur = conn.cursor()

    where = ["p.status != 'archived'"]
    if date_from:
        where.append("mc.shift_date >= '%s'" % date_from.replace("'", ""))
    if date_to:
        where.append("mc.shift_date <= '%s'" % date_to.replace("'", ""))
    if shift_type and shift_type in ('day', 'night'):
        where.append("mc.shift_type = '%s'" % shift_type)
    if direction and direction in ('to_shift', 'from_shift'):
        where.append("mc.check_direction = '%s'" % direction)

    where_sql = ' AND '.join(where)

    cur.execute("""
        SELECT mc.shift_date, mc.shift_type, mc.check_direction, mc.status,
               p.full_name, p.personal_code, p.department, p.organization,
               mc.blood_pressure, mc.pulse, mc.alcohol_level, mc.temperature,
               mc.doctor_name, mc.notes, mc.checked_at
        FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE %s
        ORDER BY mc.shift_date DESC, mc.checked_at DESC
    """ % where_sql)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output, delimiter=';')
    writer.writerow(['Дата', 'Смена', 'Направление', 'Результат', 'ФИО', 'Код', 'Подразделение', 'Организация', 'Давление', 'Пульс', 'Алкоголь', 'Температура', 'Врач', 'Примечание', 'Время'])

    status_map = {'passed': 'Допущен', 'failed': 'Не допущен'}
    for r in rows:
        writer.writerow([
            r[0],
            SHIFT_LABELS.get(r[1] or 'day', ''),
            DIRECTION_LABELS.get(r[2] or 'to_shift', ''),
            status_map.get(r[3], r[3]),
            r[4], r[5], r[6], r[7] or '',
            r[8] or '', r[9] or '', r[10] or '', r[11] or '',
            r[12] or '', r[13] or '', r[14]
        ])

    return csv_response(output.getvalue())
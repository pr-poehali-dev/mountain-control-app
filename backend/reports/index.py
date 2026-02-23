import json
import os
import csv
import io
from datetime import datetime, date as date_type, timedelta
import psycopg2
from decimal import Decimal

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def serialize_default(obj):
    if isinstance(obj, datetime):
        if obj.tzinfo is None:
            return obj.isoformat() + '+00:00'
        return obj.isoformat()
    if isinstance(obj, (date_type,)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
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

def csv_response(csv_text, filename):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="%s"' % filename,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': csv_text
    }

def handler(event, context):
    """Формирование и экспорт отчётной документации — посещаемость, медосмотры, оборудование, персонал, события"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if method == 'GET' and action == 'attendance':
        return report_attendance(params)
    elif method == 'GET' and action == 'medical':
        return report_medical(params)
    elif method == 'GET' and action == 'equipment':
        return report_equipment(params)
    elif method == 'GET' and action == 'housing':
        return report_housing(params)
    elif method == 'GET' and action == 'personnel-summary':
        return report_personnel_summary(params)
    elif method == 'GET' and action == 'events-log':
        return report_events_log(params)
    elif method == 'GET' and action == 'export':
        return export_report(params)

    return json_response(404, {'error': 'Маршрут не найден'})

def date_range(params):
    today = date_type.today()
    df = params.get('date_from', str(today))
    dt = params.get('date_to', str(today))
    return df.replace("'", ""), dt.replace("'", "")

def report_attendance(params):
    df, dt = date_range(params)
    shift = params.get('shift_type', '')
    conn = get_db()
    cur = conn.cursor()

    shift_filter = ""
    if shift in ('day', 'night'):
        shift_filter = "AND mc.shift_type = '%s'" % shift

    cur.execute("""
        SELECT p.full_name, p.personal_code, p.department, p.category, p.organization,
               p.status, p.medical_status, p.shift, COALESCE(p.tab_number, ''),
               (SELECT COUNT(*) FROM medical_checks mc
                WHERE mc.personnel_id = p.id AND mc.shift_date >= '%s' AND mc.shift_date <= '%s'
                AND mc.check_direction = 'to_shift' AND mc.status = 'passed' %s) as check_in_count,
               (SELECT COUNT(*) FROM medical_checks mc
                WHERE mc.personnel_id = p.id AND mc.shift_date >= '%s' AND mc.shift_date <= '%s'
                AND mc.check_direction = 'from_shift' %s) as check_out_count
        FROM personnel p
        WHERE p.status != 'archived'
        ORDER BY p.department, p.full_name
    """ % (df, dt, shift_filter, df, dt, shift_filter))
    rows = cur.fetchall()

    cur.execute("""
        SELECT COUNT(DISTINCT mc.personnel_id)
        FROM medical_checks mc JOIN personnel p ON mc.personnel_id = p.id
        WHERE mc.shift_date >= '%s' AND mc.shift_date <= '%s'
        AND mc.check_direction = 'to_shift' AND mc.status = 'passed'
        AND p.status != 'archived' %s
    """ % (df, dt, shift_filter))
    total_arrived = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived'")
    total_all = cur.fetchone()[0]

    cur.execute("""
        SELECT p.category, COUNT(DISTINCT mc.personnel_id)
        FROM medical_checks mc JOIN personnel p ON mc.personnel_id = p.id
        WHERE mc.shift_date >= '%s' AND mc.shift_date <= '%s'
        AND mc.check_direction = 'to_shift' AND mc.status = 'passed'
        AND p.status != 'archived' %s
        GROUP BY p.category
    """ % (df, dt, shift_filter))
    by_category = {r[0]: r[1] for r in cur.fetchall()}

    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'full_name': r[0], 'personal_code': r[1], 'department': r[2],
            'category': r[3], 'organization': r[4] or '',
            'status': r[5], 'medical_status': r[6], 'shift': r[7] or '',
            'tab_number': r[8] or '', 'check_in_count': r[9], 'check_out_count': r[10]
        })

    return json_response(200, {
        'report': 'attendance',
        'date_from': df, 'date_to': dt,
        'items': items,
        'summary': {
            'total_personnel': total_all,
            'total_arrived': total_arrived,
            'attendance_pct': round(total_arrived / total_all * 100) if total_all > 0 else 0,
            'by_category': by_category
        }
    })

def report_medical(params):
    df, dt = date_range(params)
    shift = params.get('shift_type', '')
    direction = params.get('direction', '')
    conn = get_db()
    cur = conn.cursor()

    where = ["mc.shift_date >= '%s'" % df, "mc.shift_date <= '%s'" % dt, "p.status != 'archived'"]
    if shift in ('day', 'night'):
        where.append("mc.shift_type = '%s'" % shift)
    if direction in ('to_shift', 'from_shift'):
        where.append("mc.check_direction = '%s'" % direction)
    where_sql = ' AND '.join(where)

    cur.execute("""
        SELECT mc.id, p.full_name, p.personal_code, p.department, p.organization,
               COALESCE(p.tab_number, ''),
               mc.status, mc.check_type, mc.shift_type, mc.check_direction, mc.shift_date,
               mc.blood_pressure, mc.pulse, mc.alcohol_level, mc.temperature,
               mc.doctor_name, mc.notes, mc.checked_at
        FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE %s
        ORDER BY mc.checked_at DESC
        LIMIT 500
    """ % where_sql)
    rows = cur.fetchall()

    cur.execute("""
        SELECT mc.status, COUNT(*) FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE %s GROUP BY mc.status
    """ % where_sql)
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("""
        SELECT mc.shift_type, COUNT(*) FROM medical_checks mc
        JOIN personnel p ON mc.personnel_id = p.id
        WHERE %s GROUP BY mc.shift_type
    """ % where_sql)
    by_shift = {r[0]: r[1] for r in cur.fetchall()}

    cur.close()
    conn.close()

    shift_labels = {'day': 'Дневная', 'night': 'Ночная'}
    dir_labels = {'to_shift': 'На смену', 'from_shift': 'Со смены'}

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'full_name': r[1], 'personal_code': r[2],
            'department': r[3], 'organization': r[4] or '',
            'tab_number': r[5] or '',
            'status': r[6], 'check_type': r[7],
            'shift_type': r[8], 'shift_label': shift_labels.get(r[8] or '', ''),
            'check_direction': r[9], 'direction_label': dir_labels.get(r[9] or '', ''),
            'shift_date': r[10],
            'blood_pressure': r[11], 'pulse': r[12],
            'alcohol_level': float(r[13]) if r[13] else 0,
            'temperature': float(r[14]) if r[14] else 0,
            'doctor_name': r[15], 'notes': r[16], 'checked_at': r[17]
        })

    total = sum(by_status.values())
    return json_response(200, {
        'report': 'medical',
        'date_from': df, 'date_to': dt,
        'items': items,
        'summary': {
            'total': total,
            'passed': by_status.get('passed', 0),
            'failed': by_status.get('failed', 0),
            'pending': by_status.get('pending', 0),
            'pass_rate': round(by_status.get('passed', 0) / total * 100) if total > 0 else 0,
            'by_shift': by_shift
        }
    })

def report_equipment(params):
    df, dt = date_range(params)
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT l.id, l.lantern_number, l.rescuer_number, l.status, l.condition,
               l.issued_at, l.returned_at,
               p.full_name, p.personal_code, p.department, COALESCE(p.tab_number, '')
        FROM lanterns l
        LEFT JOIN personnel p ON l.assigned_to = p.id
        ORDER BY l.status = 'issued' DESC, l.lantern_number
    """)
    rows = cur.fetchall()

    cur.execute("SELECT status, COUNT(*) FROM lanterns GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT condition, COUNT(*) FROM lanterns GROUP BY condition")
    by_condition = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("""
        SELECT COUNT(*) FROM events
        WHERE event_type = 'lantern_issued' AND created_at::date >= '%s' AND created_at::date <= '%s'
    """ % (df, dt))
    issues_in_period = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*) FROM events
        WHERE event_type = 'lantern_returned' AND created_at::date >= '%s' AND created_at::date <= '%s'
    """ % (df, dt))
    returns_in_period = cur.fetchone()[0]

    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'lantern_number': r[1], 'rescuer_number': r[2],
            'status': r[3], 'condition': r[4],
            'issued_at': r[5], 'returned_at': r[6],
            'person_name': r[7], 'person_code': r[8], 'department': r[9] or '',
            'tab_number': r[10] or ''
        })

    total = sum(by_status.values())
    return json_response(200, {
        'report': 'equipment',
        'date_from': df, 'date_to': dt,
        'items': items,
        'summary': {
            'total': total,
            'issued': by_status.get('issued', 0),
            'available': by_status.get('available', 0),
            'charging': by_status.get('charging', 0),
            'missing': by_status.get('missing', 0),
            'by_condition': by_condition,
            'issues_in_period': issues_in_period,
            'returns_in_period': returns_in_period
        }
    })

def report_housing(params):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT r.id, r.room_number, r.building, r.capacity, r.occupied, r.status
        FROM rooms r ORDER BY r.building, r.room_number
    """)
    rows = cur.fetchall()

    cur.execute("SELECT COALESCE(SUM(capacity), 0), COALESCE(SUM(occupied), 0) FROM rooms")
    totals = cur.fetchone()

    cur.execute("SELECT status, COUNT(*) FROM rooms GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT building, COALESCE(SUM(capacity), 0), COALESCE(SUM(occupied), 0) FROM rooms GROUP BY building ORDER BY building")
    by_building = []
    for r in cur.fetchall():
        by_building.append({'building': r[0], 'capacity': r[1], 'occupied': r[2]})

    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'room_number': r[1], 'building': r[2] or '',
            'capacity': r[3], 'occupied': r[4], 'status': r[5],
            'free': r[3] - r[4]
        })

    total_cap = totals[0]
    total_occ = totals[1]
    return json_response(200, {
        'report': 'housing',
        'items': items,
        'summary': {
            'total_capacity': total_cap,
            'total_occupied': total_occ,
            'total_free': total_cap - total_occ,
            'occupancy_pct': round(total_occ / total_cap * 100) if total_cap > 0 else 0,
            'by_status': by_status,
            'by_building': by_building
        }
    })

def report_personnel_summary(params):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.id, p.personal_code, p.full_name, p.position, p.department,
               p.category, p.organization, p.organization_type, p.status,
               p.medical_status, p.shift, p.room, p.phone, p.created_at,
               COALESCE(p.tab_number, '')
        FROM personnel p
        WHERE p.status != 'archived'
        ORDER BY p.department, p.full_name
    """)
    rows = cur.fetchall()

    cur.execute("SELECT category, COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY category")
    by_category = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COALESCE(organization_type, ''), COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY COALESCE(organization_type, '')")
    by_org_type = {}
    for r in cur.fetchall():
        by_org_type[r[0] if r[0] else 'unknown'] = r[1]

    cur.execute("SELECT status, COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT medical_status, COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY medical_status")
    by_medical = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT department, COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY department ORDER BY COUNT(*) DESC")
    by_dept = []
    for r in cur.fetchall():
        by_dept.append({'department': r[0] or 'Без подразделения', 'count': r[1]})

    cur.close()
    conn.close()

    org_labels = {'rudnik': 'Рудник', 'guest': 'Гость', 'contractor': 'Подрядная', 'gov': 'Гос.органы'}
    cat_labels = {'mine': 'Рудничный', 'office': 'Офисный', 'contractor': 'Подрядчик', 'guest': 'Гость', 'gov': 'Гос.органы'}
    status_labels = {'arrived': 'На объекте', 'departed': 'Убыл', 'on_shift': 'На смене', 'day_off': 'Выходной', 'sick_leave': 'Больничный', 'vacation': 'Отпуск', 'business_trip': 'Командировка'}

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'personal_code': r[1], 'full_name': r[2],
            'position': r[3], 'department': r[4],
            'category': r[5], 'category_label': cat_labels.get(r[5], r[5]),
            'organization': r[6] or '', 'organization_type': r[7] or '',
            'org_type_label': org_labels.get(r[7] or '', ''),
            'status': r[8], 'status_label': status_labels.get(r[8], r[8]),
            'medical_status': r[9], 'shift': r[10] or '',
            'room': r[11] or '', 'phone': r[12] or '', 'created_at': r[13],
            'tab_number': r[14] or ''
        })

    return json_response(200, {
        'report': 'personnel-summary',
        'items': items,
        'summary': {
            'total': len(items),
            'by_category': by_category,
            'by_org_type': by_org_type,
            'by_status': by_status,
            'by_medical': by_medical,
            'by_department': by_dept
        }
    })

def report_events_log(params):
    df, dt = date_range(params)
    event_type = params.get('event_type', '')
    limit = min(int(params.get('limit', '500')), 1000)
    conn = get_db()
    cur = conn.cursor()

    where = ["e.created_at::date >= '%s'" % df, "e.created_at::date <= '%s'" % dt]
    if event_type:
        where.append("e.event_type = '%s'" % event_type.replace("'", "''"))
    where_sql = ' AND '.join(where)

    cur.execute("""
        SELECT e.id, e.event_type, e.description, e.created_at,
               p.full_name, p.personal_code
        FROM events e
        LEFT JOIN personnel p ON e.personnel_id = p.id
        WHERE %s
        ORDER BY e.created_at DESC
        LIMIT %d
    """ % (where_sql, limit))
    rows = cur.fetchall()

    cur.execute("""
        SELECT e.event_type, COUNT(*) FROM events e WHERE %s GROUP BY e.event_type ORDER BY COUNT(*) DESC
    """ % where_sql)
    by_type = []
    for r in cur.fetchall():
        by_type.append({'type': r[0], 'count': r[1]})

    cur.close()
    conn.close()

    type_labels = {
        'checkin': 'Вход', 'checkout': 'Выход', 'medical_pass': 'Медосмотр пройден',
        'medical_deny': 'Медосмотр не пройден', 'medical_reset': 'Автосброс медосмотров',
        'medical_change': 'Изменение медстатуса', 'lantern_issued': 'Выдача фонаря',
        'lantern_returned': 'Возврат фонаря', 'status_change': 'Смена статуса',
        'person_added': 'Добавлен сотрудник', 'person_edited': 'Редактирование сотрудника'
    }

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'event_type': r[1],
            'type_label': type_labels.get(r[1], r[1]),
            'description': r[2], 'created_at': r[3],
            'person_name': r[4], 'person_code': r[5]
        })

    return json_response(200, {
        'report': 'events-log',
        'date_from': df, 'date_to': dt,
        'items': items,
        'summary': {
            'total': len(items),
            'by_type': by_type
        }
    })

EXPORT_CONFIGS = {
    'attendance': {
        'filename': 'attendance_report.csv',
        'headers': ['ФИО', 'Таб. №', 'Код', 'Подразделение', 'Категория', 'Организация', 'Статус', 'Медосмотр', 'Смена', 'Явок', 'Уходов'],
        'fields': ['full_name', 'tab_number', 'personal_code', 'department', 'category', 'organization', 'status', 'medical_status', 'shift', 'check_in_count', 'check_out_count']
    },
    'medical': {
        'filename': 'medical_report.csv',
        'headers': ['ФИО', 'Таб. №', 'Код', 'Подразделение', 'Организация', 'Статус', 'Смена', 'Направление', 'Дата', 'Давление', 'Пульс', 'Алкоголь', 'Температура', 'Врач', 'Примечание', 'Время'],
        'fields': ['full_name', 'tab_number', 'personal_code', 'department', 'organization', 'status', 'shift_label', 'direction_label', 'shift_date', 'blood_pressure', 'pulse', 'alcohol_level', 'temperature', 'doctor_name', 'notes', 'checked_at']
    },
    'equipment': {
        'filename': 'equipment_report.csv',
        'headers': ['Номер фонаря', 'Номер СС', 'Статус', 'Состояние', 'Выдан', 'Возвращён', 'Сотрудник', 'Код', 'Подразделение'],
        'fields': ['lantern_number', 'rescuer_number', 'status', 'condition', 'issued_at', 'returned_at', 'person_name', 'person_code', 'department']
    },
    'housing': {
        'filename': 'housing_report.csv',
        'headers': ['Комната', 'Корпус', 'Вместимость', 'Заселено', 'Свободно', 'Статус'],
        'fields': ['room_number', 'building', 'capacity', 'occupied', 'free', 'status']
    },
    'personnel-summary': {
        'filename': 'personnel_report.csv',
        'headers': ['Код', 'ФИО', 'Таб. №', 'Должность', 'Подразделение', 'Категория', 'Организация', 'Тип орг.', 'Статус', 'Медосмотр', 'Смена', 'Комната', 'Телефон'],
        'fields': ['personal_code', 'full_name', 'tab_number', 'position', 'department', 'category_label', 'organization', 'org_type_label', 'status_label', 'medical_status', 'shift', 'room', 'phone']
    },
    'events-log': {
        'filename': 'events_report.csv',
        'headers': ['Дата/Время', 'Тип', 'Описание', 'Сотрудник', 'Код'],
        'fields': ['created_at', 'type_label', 'description', 'person_name', 'person_code']
    }
}

STATUS_LABELS = {
    'passed': 'Пройден', 'failed': 'Не пройден', 'pending': 'Ожидание',
    'arrived': 'На объекте', 'departed': 'Убыл', 'on_shift': 'На смене',
    'day_off': 'Выходной', 'sick_leave': 'Больничный', 'vacation': 'Отпуск',
    'issued': 'Выдан', 'available': 'Доступен', 'charging': 'Зарядка', 'missing': 'Утерян',
    'normal': 'Норма', 'damaged': 'Повреждён', 'needs_repair': 'Требует ремонта',
    'active': 'Активна', 'maintenance': 'Обслуживание'
}

def export_report(params):
    report_type = params.get('report_type', '')
    if report_type not in EXPORT_CONFIGS:
        return json_response(400, {'error': 'Неизвестный тип отчёта'})

    config = EXPORT_CONFIGS[report_type]

    handlers = {
        'attendance': report_attendance,
        'medical': report_medical,
        'equipment': report_equipment,
        'housing': report_housing,
        'personnel-summary': report_personnel_summary,
        'events-log': report_events_log
    }

    raw = json.loads(handlers[report_type](params)['body'])
    items = raw.get('items', [])

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output, delimiter=';')
    writer.writerow(config['headers'])

    for item in items:
        row = []
        for f in config['fields']:
            val = item.get(f, '')
            if val is None:
                val = ''
            val_str = str(val)
            if val_str in STATUS_LABELS:
                val_str = STATUS_LABELS[val_str]
            row.append(val_str)
        writer.writerow(row)

    return csv_response(output.getvalue(), config['filename'])
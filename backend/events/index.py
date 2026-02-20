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
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': json.dumps(body, ensure_ascii=False, default=serialize_default)
    }

def handler(event, context):
    """Лента событий, дашборд, уведомления диспетчеру"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and action in ('list', ''):
        return get_events(params)
    elif method == 'GET' and action == 'dashboard':
        return get_dashboard()
    elif method == 'GET' and action == 'notifications':
        return get_notifications(params)
    elif method == 'PUT' and action == 'read':
        return mark_read(body)
    elif method == 'PUT' and action == 'read-all':
        return mark_all_read()

    return json_response(404, {'error': 'Маршрут не найден'})

def get_notifications(params):
    limit = int(params.get('limit', '30'))
    unread_only = params.get('unread', '') == '1'

    conn = get_db()
    cur = conn.cursor()

    where = "WHERE is_read = FALSE" if unread_only else ""
    cur.execute("""
        SELECT id, type, title, message, person_name, person_code, is_read, created_at
        FROM notifications %s
        ORDER BY created_at DESC LIMIT %d
    """ % (where, min(limit, 100)))
    rows = cur.fetchall()

    cur.execute("SELECT COUNT(*) FROM notifications WHERE is_read = FALSE")
    unread_count = cur.fetchone()[0]

    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'id': r[0], 'type': r[1], 'title': r[2], 'message': r[3],
            'person_name': r[4], 'person_code': r[5],
            'is_read': r[6], 'created_at': r[7]
        })

    return json_response(200, {'notifications': items, 'unread': unread_count})

def mark_read(body):
    nid = body.get('id')
    if not nid:
        return json_response(400, {'error': 'ID обязателен'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE notifications SET is_read = TRUE WHERE id = %d" % int(nid))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Прочитано'})

def mark_all_read():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE")
    count = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Все прочитаны', 'count': count})

def get_events(params):
    limit = int(params.get('limit', '20'))
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT e.id, e.event_type, e.description, e.created_at,
               p.full_name, p.personal_code
        FROM events e
        LEFT JOIN personnel p ON e.personnel_id = p.id
        ORDER BY e.created_at DESC
        LIMIT %d
    """ % min(limit, 100))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    events = []
    for r in rows:
        events.append({
            'id': r[0], 'type': r[1], 'description': r[2],
            'created_at': r[3], 'person_name': r[4], 'person_code': r[5]
        })

    return json_response(200, {'events': events})

def get_dashboard():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status IN ('on_shift', 'arrived', 'business_trip') AND status != 'archived'")
    on_site = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM lanterns WHERE status = 'issued'")
    lanterns_issued = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM lanterns")
    lanterns_total = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*) FROM medical_checks
        WHERE checked_at::date = CURRENT_DATE AND status = 'passed'
    """)
    medical_passed = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived'")
    total_personnel = cur.fetchone()[0]

    cur.execute("SELECT COALESCE(SUM(capacity), 0), COALESCE(SUM(occupied), 0) FROM rooms")
    room_row = cur.fetchone()
    housing_total = room_row[0]
    housing_occupied = room_row[1]

    cur.execute("SELECT category, COUNT(*) FROM personnel WHERE status IN ('on_shift', 'arrived', 'business_trip') AND status != 'archived' GROUP BY category")
    by_category = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COALESCE(organization_type, ''), COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY COALESCE(organization_type, '')")
    by_org_type = {}
    for r in cur.fetchall():
        key = r[0] if r[0] else 'unknown'
        by_org_type[key] = r[1]

    cur.execute("SELECT medical_status, COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY medical_status")
    by_medical = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT status, COUNT(*) FROM personnel WHERE status != 'archived' GROUP BY status")
    by_status = {r[0]: r[1] for r in cur.fetchall()}

    cur.close()
    conn.close()

    medical_pct = round((medical_passed / total_personnel * 100)) if total_personnel > 0 else 0
    housing_pct = round((housing_occupied / housing_total * 100)) if housing_total > 0 else 0

    return json_response(200, {
        'on_site': on_site,
        'total_personnel': total_personnel,
        'lanterns_issued': lanterns_issued,
        'lanterns_total': lanterns_total,
        'medical_passed_pct': medical_pct,
        'medical_not_passed': total_personnel - medical_passed,
        'housing_pct': housing_pct,
        'housing_occupied': housing_occupied,
        'housing_total': housing_total,
        'by_category': by_category,
        'by_org_type': by_org_type,
        'by_medical': by_medical,
        'by_status': by_status
    })

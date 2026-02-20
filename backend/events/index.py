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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': json.dumps(body, ensure_ascii=False, default=str)
    }

def handler(event, context):
    """Лента событий и общая статистика дашборда"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if method == 'GET' and action in ('list', ''):
        return get_events(params)
    elif method == 'GET' and action == 'dashboard':
        return get_dashboard()

    return json_response(404, {'error': 'Маршрут не найден'})

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
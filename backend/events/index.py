import json
import os
from datetime import datetime, date as date_type
import psycopg2
import secrets
import smtplib
import ssl
import html as html_lib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header


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

def handler(event, context):
    """Лента событий, дашборд, уведомления диспетчеру"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')
    HIDE_CODES['on'] = not caller_is_admin(event)

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'GET' and action in ('list', ''):
        return get_events(params, event)
    elif method == 'GET' and action == 'dashboard':
        return get_dashboard(event)
    elif method == 'GET' and action == 'notifications':
        return get_notifications(params)
    elif method == 'GET' and action == 'expiring-passes':
        return get_expiring_passes(params, event)
    elif method == 'GET' and action == 'pass-alert-settings':
        return pass_alert_get(event)
    elif method == 'PUT' and action == 'pass-alert-settings':
        return pass_alert_save(event, body)
    elif method == 'POST' and action == 'pass-alert-send':
        return pass_alert_send_now(event)
    elif action == 'pass-alert-auto':
        return pass_alert_auto(params)
    elif method == 'PUT' and action == 'edit':
        return edit_event(body, event)
    elif method in ('PUT', 'DELETE') and action == 'hide':
        return hide_event(body, params, event)
    elif method == 'PUT' and action == 'read':
        return mark_read(body)
    elif method == 'PUT' and action == 'read-all':
        return mark_all_read()

    return json_response(404, {'error': 'Маршрут не найден'})

def query_expiring(cur, days, demo_val='FALSE'):
    cur.execute("""
        SELECT id, full_name, COALESCE(position, ''), COALESCE(organization, ''), 'personal' AS kind,
               COALESCE(pass_number, ''), '' AS vehicle, pass_valid_to, pass_valid_from
        FROM personnel
        WHERE status != 'archived' AND COALESCE(is_hidden, FALSE) = FALSE AND is_demo_data = %s
          AND pass_permanent = FALSE AND pass_valid_to IS NOT NULL
          AND pass_valid_to <= CURRENT_DATE + %d AND pass_valid_to >= CURRENT_DATE - 30
        UNION ALL
        SELECT id, full_name, COALESCE(position, ''), COALESCE(organization, ''), 'vehicle',
               COALESCE(vehicle_pass_number, ''), TRIM(COALESCE(vehicle_number, '') || ' ' || COALESCE(vehicle_brand, '')),
               vehicle_pass_valid_to, vehicle_pass_valid_from
        FROM personnel
        WHERE status != 'archived' AND COALESCE(is_hidden, FALSE) = FALSE AND is_demo_data = %s
          AND vehicle_pass_permanent = FALSE AND vehicle_pass_valid_to IS NOT NULL
          AND vehicle_pass_valid_to <= CURRENT_DATE + %d AND vehicle_pass_valid_to >= CURRENT_DATE - 30
        ORDER BY 8, 2
        LIMIT 200
    """ % (demo_val, days, demo_val, days))
    today = date_type.today()
    return [{
        'personnel_id': r[0], 'full_name': r[1], 'position': r[2], 'organization': r[3],
        'kind': r[4], 'pass_number': r[5], 'vehicle': r[6],
        'valid_to': r[7].isoformat(), 'valid_from': r[8].isoformat() if r[8] else '',
        'days_left': (r[7] - today).days
    } for r in cur.fetchall()]


def get_expiring_passes(params, event):
    """Пропуска (личные и на автомобиль), истекающие в ближайшие дни или уже истёкшие"""
    days = max(1, min(90, int(params.get('days', '7') or 7)))
    demo_val = 'TRUE' if is_demo_request(event) else 'FALSE'
    conn = get_db()
    cur = conn.cursor()
    items = query_expiring(cur, days, demo_val)
    cur.close()
    conn.close()
    return json_response(200, {
        'items': items,
        'days': days,
        'expired': sum(1 for i in items if i['days_left'] < 0),
        'expiring': sum(1 for i in items if i['days_left'] >= 0)
    })


ALERT_DEFAULTS = {'enabled': False, 'emails': [], 'hour': 8, 'tz': 'Asia/Chita', 'last_sent': '', 'cron_key': ''}


def load_alert(cur):
    cur.execute("SELECT value FROM settings WHERE key = 'pass_alert'")
    row = cur.fetchone()
    data = dict(ALERT_DEFAULTS)
    if row:
        data.update(row[0] if isinstance(row[0], dict) else json.loads(row[0]))
    if not data.get('cron_key'):
        data['cron_key'] = secrets.token_hex(16)
        save_alert(cur, data)
    return data


def save_alert(cur, data):
    raw = json.dumps(data, ensure_ascii=False).replace("'", "''")
    cur.execute("""
        INSERT INTO settings (key, value, updated_at) VALUES ('pass_alert', '%s'::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = '%s'::jsonb, updated_at = NOW()
    """ % (raw, raw))


def local_now(tz):
    from zoneinfo import ZoneInfo
    try:
        return datetime.now(ZoneInfo(tz or 'Asia/Chita'))
    except Exception:
        return datetime.now(ZoneInfo('Asia/Chita'))


def smtp_ready():
    return bool(os.environ.get('SMTP_HOST') and os.environ.get('SMTP_USER') and os.environ.get('SMTP_PASSWORD'))


def pass_alert_get(event):
    conn = get_db()
    cur = conn.cursor()
    if not is_admin_request(cur, event):
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Только для администратора'})
    data = load_alert(cur)
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'settings': data, 'smtp_ready': smtp_ready()})


def pass_alert_save(event, body):
    conn = get_db()
    cur = conn.cursor()
    if not is_admin_request(cur, event):
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Только для администратора'})
    data = load_alert(cur)
    emails = []
    for e in body.get('emails') or []:
        e = str(e).strip().lower()
        if e and '@' in e and '.' in e.split('@')[-1] and e not in emails:
            emails.append(e[:200])
    data['emails'] = emails[:10]
    data['enabled'] = bool(body.get('enabled')) and bool(emails)
    data['hour'] = max(0, min(23, int(body.get('hour', data['hour']))))
    if body.get('tz'):
        data['tz'] = str(body['tz'])[:50]
    save_alert(cur, data)
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'settings': data, 'message': 'Настройки рассылки сохранены'})


def fmt_d(iso_str):
    y, m, d = iso_str.split('-')
    return '%s.%s.%s' % (d, m, y)


def days_text(n):
    def pl(x):
        if x % 10 == 1 and x % 100 != 11:
            return 'день'
        if 2 <= x % 10 <= 4 and not 12 <= x % 100 <= 14:
            return 'дня'
        return 'дней'
    if n < 0:
        return 'истёк %d %s назад' % (-n, pl(-n))
    if n == 0:
        return 'истекает сегодня'
    if n == 1:
        return 'истекает завтра'
    return 'через %d %s' % (n, pl(n))


def build_alert_email(items, today_str):
    expired = [i for i in items if i['days_left'] < 0]
    soon = [i for i in items if i['days_left'] >= 0]
    lines = ['Сводка по пропускам на %s' % today_str, '']

    def rows_html(group, color):
        out = ''
        for i in group:
            kind = 'Авто %s' % i['vehicle'] if i['kind'] == 'vehicle' else 'Личный пропуск'
            if i['pass_number']:
                kind += ' № %s' % i['pass_number']
            out += ('<tr><td style="padding:8px;border-bottom:1px solid #eee;">%s<br><span style="color:#6b7280;font-size:12px;">%s</span></td>'
                    '<td style="padding:8px;border-bottom:1px solid #eee;">%s</td>'
                    '<td style="padding:8px;border-bottom:1px solid #eee;color:%s;white-space:nowrap;">до %s<br><span style="font-size:12px;">%s</span></td></tr>') % (
                html_lib.escape(i['full_name']), html_lib.escape(i['position'] or ''), html_lib.escape(kind),
                color, fmt_d(i['valid_to']), days_text(i['days_left']))
            lines.append('- %s — %s — до %s (%s)' % (i['full_name'], kind, fmt_d(i['valid_to']), days_text(i['days_left'])))
        return out

    def table(title, group, color):
        if not group:
            return ''
        lines.append(title + ':')
        body_rows = rows_html(group, color)
        lines.append('')
        return ('<h3 style="color:%s;font-size:15px;margin:20px 0 8px;">%s: %d</h3>'
                '<table width="100%%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">'
                '<tr style="background:#f9fafb;color:#6b7280;font-size:12px;"><td style="padding:8px;">Сотрудник</td><td style="padding:8px;">Пропуск</td><td style="padding:8px;">Срок</td></tr>%s</table>') % (
            color, title, len(group), body_rows)

    content = table('Уже истекли', expired, '#dc2626') + table('Истекают в ближайшие 7 дней', soon, '#d97706')
    html_body = """<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0e1218;padding:20px 24px;color:#f59e0b;font-size:20px;font-weight:bold;">Горный контроль
<div style="color:#9ca3af;font-size:13px;font-weight:normal;margin-top:4px;">Пропуска требуют продления — %s</div></td></tr>
<tr><td style="padding:8px 24px 24px;color:#111827;">%s
<p style="color:#6b7280;font-size:13px;margin-top:20px;">Продлить пропуск можно на главной панели системы кнопкой «Продлить».</p></td></tr>
<tr><td align="center" style="background:#f9fafb;padding:12px;color:#9ca3af;font-size:12px;">Письмо отправлено автоматически</td></tr>
</table></td></tr></table></body></html>""" % (today_str, content)
    subject = 'Пропуска: истекли %d, истекают %d' % (len(expired), len(soon))
    return subject, '\n'.join(lines), html_body


def send_mail(to_list, subject, text, html_body):
    host = os.environ.get('SMTP_HOST', '')
    user = os.environ.get('SMTP_USER', '')
    password = os.environ.get('SMTP_PASSWORD', '')
    port = int(os.environ.get('SMTP_PORT', '465') or 465)
    msg = MIMEMultipart('alternative')
    msg.attach(MIMEText(text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))
    msg['Subject'] = Header(subject, 'utf-8')
    msg['From'] = '%s <%s>' % (Header('Горный контроль', 'utf-8').encode(), user)
    msg['To'] = ', '.join(to_list)
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=8) as srv:
            srv.login(user, password)
            srv.sendmail(user, to_list, msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=8) as srv:
            srv.starttls(context=ssl.create_default_context())
            srv.login(user, password)
            srv.sendmail(user, to_list, msg.as_string())


def deliver(cur, data, force=False):
    items = query_expiring(cur, 7)
    if not items and not force:
        return 'empty', 0
    now = local_now(data.get('tz'))
    subject, text, html_body = build_alert_email(items, now.strftime('%d.%m.%Y'))
    if not items:
        subject = 'Пропуска: всё в порядке'
        html_body = html_body.replace('<tr><td style="padding:8px 24px 24px;color:#111827;">',
                                      '<tr><td style="padding:8px 24px 24px;color:#111827;"><p style="color:#16a34a;font-size:15px;">В ближайшие 7 дней ни один пропуск не истекает.</p>')
    send_mail(data['emails'], subject, text, html_body)
    return 'sent', len(items)


def pass_alert_send_now(event):
    """Тестовая отправка сводки по пропускам прямо сейчас"""
    conn = get_db()
    cur = conn.cursor()
    if not is_admin_request(cur, event):
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Только для администратора'})
    data = load_alert(cur)
    conn.commit()
    if not data['emails']:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Укажите хотя бы один адрес почты'})
    if not smtp_ready():
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Почта для отправки не настроена'})
    try:
        _, count = deliver(cur, data, force=True)
    except Exception as e:
        cur.close()
        conn.close()
        return json_response(502, {'error': 'Почтовый сервер не принял письмо: %s' % str(e)[:150]})
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Письмо отправлено на %s' % ', '.join(data['emails']), 'count': count})


def pass_alert_auto(params):
    """Автоматическая утренняя рассылка: отправляет не чаще раза в сутки после заданного часа"""
    conn = get_db()
    cur = conn.cursor()
    data = load_alert(cur)
    conn.commit()
    key_ok = params.get('key', '') == data['cron_key']
    now = local_now(data.get('tz'))
    today = now.strftime('%Y-%m-%d')
    if not data['enabled'] or not data['emails'] or not smtp_ready():
        cur.close()
        conn.close()
        return json_response(200, {'status': 'disabled'})
    if data.get('last_sent') == today or now.hour < int(data['hour']):
        cur.close()
        conn.close()
        return json_response(200, {'status': 'skip'})
    cur.execute("""
        UPDATE settings SET value = jsonb_set(value, '{last_sent}', '"%s"'::jsonb), updated_at = NOW()
        WHERE key = 'pass_alert' AND COALESCE(value->>'last_sent', '') <> '%s'
        RETURNING id
    """ % (today, today))
    claimed = cur.fetchone() is not None
    conn.commit()
    if not claimed:
        cur.close()
        conn.close()
        return json_response(200, {'status': 'skip'})
    try:
        status, count = deliver(cur, data)
    except Exception as e:
        cur.execute("UPDATE settings SET value = jsonb_set(value, '{last_sent}', '\"\"'::jsonb) WHERE key = 'pass_alert'")
        conn.commit()
        cur.close()
        conn.close()
        return json_response(200, {'status': 'error', 'error': str(e)[:150]})
    cur.close()
    conn.close()
    return json_response(200, {'status': status, 'count': count, 'by_key': key_ok})


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

ADMIN_EVENTS_HIDDEN = (
    "e.event_type NOT IN ('checkpoint_edit', 'checkpoint_delete', 'system_reset') "
    "AND e.event_type NOT LIKE 'admin\\_%' "
    "AND COALESCE(e.description, '') NOT LIKE '%администратор%'"
)


def is_admin_request(cur, event):
    headers = event.get('headers') or {}
    token = ''
    for key in ('X-Authorization', 'x-authorization', 'Authorization', 'authorization'):
        val = headers.get(key, '')
        if val:
            token = val[7:] if val.startswith('Bearer ') else val
            break
    if not token:
        return False
    cur.execute("""
        SELECT u.id FROM users u JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE AND u.role = 'admin'
    """ % token.replace("'", "''"))
    return cur.fetchone() is not None


def edit_event(body, event):
    event_id = body.get('id')
    description = str(body.get('description', '')).strip()
    if not event_id or not description:
        return json_response(400, {'error': 'Укажите событие и текст'})
    conn = get_db()
    cur = conn.cursor()
    if not is_admin_request(cur, event):
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Редактировать ленту может только администратор'})
    cur.execute("UPDATE events SET description = '%s' WHERE id = %d RETURNING id" % (
        description[:1000].replace("'", "''"), int(event_id)))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        return json_response(404, {'error': 'Событие не найдено'})
    return json_response(200, {'success': True})


def hide_event(body, params, event):
    event_id = body.get('id') or params.get('id')
    if not event_id:
        return json_response(400, {'error': 'Укажите событие'})
    conn = get_db()
    cur = conn.cursor()
    if not is_admin_request(cur, event):
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Убирать события может только администратор'})
    cur.execute("UPDATE events SET is_hidden = TRUE WHERE id = %d RETURNING id" % int(event_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        return json_response(404, {'error': 'Событие не найдено'})
    return json_response(200, {'success': True})


def get_events(params, event):
    limit = int(params.get('limit', '20'))
    demo_filter = "AND p.is_demo_data = TRUE" if is_demo_request(event) else "AND p.is_demo_data = FALSE"
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT e.id, e.event_type, e.description, e.created_at,
               p.full_name, p.personal_code
        FROM events e
        LEFT JOIN personnel p ON e.personnel_id = p.id
        WHERE (p.id IS NULL OR p.is_demo_data = %s)
          AND COALESCE(e.is_hidden, FALSE) = FALSE
          AND %s
        ORDER BY e.created_at DESC
        LIMIT %d
    """ % ('TRUE' if is_demo_request(event) else 'FALSE', ADMIN_EVENTS_HIDDEN, min(limit, 100)))
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

def get_dashboard(event):
    conn = get_db()
    cur = conn.cursor()

    demo_filter = "AND is_demo_data = TRUE" if is_demo_request(event) else "AND is_demo_data = FALSE"

    p_demo = demo_filter.replace('is_demo_data', 'p.is_demo_data')
    on_site_from = """personnel p WHERE p.status <> 'archived' %s AND p.id IN (
            SELECT ls.personnel_id FROM (
                SELECT DISTINCT ON (cp.personnel_id) cp.personnel_id, cp.direction
                FROM checkpoint_passes cp
                WHERE cp.personnel_id IS NOT NULL AND COALESCE(cp.notes, '') NOT LIKE 'ОТКАЗ%%%%'
                ORDER BY cp.personnel_id, cp.created_at DESC, cp.id DESC
            ) ls WHERE ls.direction = 'in'
        )""" % p_demo
    cur.execute("SELECT COUNT(*) FROM " + on_site_from)
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

    cur.execute("SELECT COUNT(*) FROM personnel WHERE status != 'archived' %s" % demo_filter)
    total_personnel = cur.fetchone()[0]

    cur.execute("""SELECT COALESCE(SUM(r.capacity), 0), COALESCE(SUM(%s), 0)::int
                   FROM rooms r JOIN buildings b ON b.id = r.building_id
                   WHERE r.is_active = TRUE AND r.is_residential = TRUE AND b.is_active = TRUE""" % "(SELECT COUNT(*) FROM personnel p WHERE p.residence_room_id = r.id AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE)")
    room_row = cur.fetchone()
    housing_total = room_row[0]
    housing_occupied = room_row[1]

    cur.execute("SELECT p.category, COUNT(*) FROM " + on_site_from + " GROUP BY p.category")
    by_category = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT COALESCE(organization_type, ''), COUNT(*) FROM personnel WHERE status != 'archived' %s GROUP BY COALESCE(organization_type, '')" % demo_filter)
    by_org_type = {}
    for r in cur.fetchall():
        key = r[0] if r[0] else 'unknown'
        by_org_type[key] = r[1]

    cur.execute("SELECT medical_status, COUNT(*) FROM personnel WHERE status != 'archived' %s GROUP BY medical_status" % demo_filter)
    by_medical = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT status, COUNT(*) FROM personnel WHERE status != 'archived' %s GROUP BY status" % demo_filter)
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
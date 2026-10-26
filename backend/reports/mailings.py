import os
import ssl
import json
import html as html_lib
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.header import Header
from email import encoders

ACTIONS = ('mailings', 'mailing-save', 'mailing-remove', 'mailing-send', 'mailings-auto', 'cron')

EVENTS_URL = 'https://functions.poehali.dev/7ddc9847-facb-4e59-8cfe-6b535f9fa0cd'

STATIC_REPORTS = [
    ('attendance', 'Посещаемость за смену'),
    ('medical', 'Медосмотры'),
    ('equipment', 'Выдача фонарей и СС'),
    ('housing', 'Жилой фонд'),
    ('personnel-summary', 'Сводный по персоналу'),
    ('housing-history', 'История проживания'),
    ('events-log', 'Журнал событий'),
]

PERIODS = {
    'today': 'За сегодня',
    'yesterday': 'За вчера',
    'week': 'За последние 7 дней',
    'month': 'За прошлый месяц',
}

FREQS = ('daily', 'weekly', 'monthly')
WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']

SUMMARY_LABELS = {
    'attendance': [('total_personnel', 'Всего персонала'), ('total_arrived', 'Прибыло'), ('attendance_pct', 'Посещаемость, %')],
    'medical': [('total', 'Осмотров'), ('passed', 'Пройден'), ('failed', 'Не пройден'), ('pass_rate', 'Прохождение, %')],
    'equipment': [('total', 'Всего'), ('issued', 'Выдано'), ('available', 'Доступно'), ('missing', 'Утеряно'),
                  ('issues_in_period', 'Выдач за период'), ('returns_in_period', 'Возвратов за период')],
    'housing': [('total_capacity', 'Мест'), ('total_occupied', 'Заселено'), ('total_free', 'Свободно'), ('occupancy_pct', 'Загрузка, %')],
    'personnel-summary': [('total', 'Всего сотрудников')],
    'housing-history': [('total', 'Записей'), ('checkin', 'Заселений'), ('move', 'Переселений'), ('evict', 'Выселений')],
    'events-log': [('total', 'Событий')],
    'point-passes': [('total', 'Проходов'), ('entries', 'Входов'), ('exits', 'Выходов'), ('denied', 'Отказов'), ('people', 'Человек')],
}

NO_PERIOD = ('housing', 'personnel-summary')


def smtp_ready():
    return bool(os.environ.get('SMTP_HOST') and os.environ.get('SMTP_USER') and os.environ.get('SMTP_PASSWORD'))


TZ_OFFSETS = {'Asia/Chita': 9, 'Asia/Yakutsk': 9, 'Asia/Irkutsk': 8, 'Asia/Krasnoyarsk': 7, 'Asia/Novosibirsk': 7,
              'Asia/Vladivostok': 10, 'Asia/Yekaterinburg': 5, 'Europe/Moscow': 3}


def local_now(tz):
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(tz or 'Asia/Chita'))
    except Exception:
        from datetime import timezone
        return datetime.now(timezone(timedelta(hours=TZ_OFFSETS.get(tz, 9))))


def catalog(cur):
    """Все доступные для рассылки отчёты, включая отчёты по каждому объекту контроля"""
    cur.execute("SELECT id, name, is_main FROM control_points WHERE is_active = TRUE ORDER BY is_main DESC, sort_order, id")
    points = cur.fetchall()
    items = [{'key': 'point:%d' % r[0], 'title': 'Проходы: %s' % r[1], 'group': 'Объекты контроля'} for r in points]
    if len(points) > 1:
        items.append({'key': 'point:all', 'title': 'Проходы: все объекты', 'group': 'Объекты контроля'})
    items += [{'key': k, 'title': t, 'group': 'Отчёты'} for k, t in STATIC_REPORTS]
    return items


def clean_emails(raw):
    if isinstance(raw, str):
        raw = raw.replace(';', ',').replace('\n', ',').split(',')
    out = []
    for e in raw or []:
        e = str(e).strip().lower()
        if e and '@' in e and '.' in e.split('@')[-1] and e not in out:
            out.append(e[:200])
    return out[:20]


def row_to_mailing(r, titles):
    reports = r[4] if isinstance(r[4], list) else json.loads(r[4] or '[]')
    return {
        'id': r[0], 'name': r[1], 'enabled': r[2],
        'emails': [e for e in (r[3] or '').split(',') if e],
        'reports': reports,
        'reports_missing': [k for k in reports if k not in titles],
        'frequency': r[5], 'weekday': r[6], 'month_day': r[7], 'hour': r[8], 'tz': r[9], 'period': r[10],
        'last_sent': r[11], 'last_status': r[12], 'last_error': r[13], 'last_sent_at': r[14],
    }


COLS = ("id, name, enabled, emails, reports, frequency, weekday, month_day, hour, tz, period, "
        "last_sent, last_status, last_error, last_sent_at")


def period_dates(period, now):
    today = now.date()
    if period == 'today':
        return today, today
    if period == 'week':
        return today - timedelta(days=7), today - timedelta(days=1)
    if period == 'month':
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        return last_prev.replace(day=1), last_prev
    y = today - timedelta(days=1)
    return y, y


def fmt(d):
    return d.strftime('%d.%m.%Y')


def build_email(m, titles, deps, now):
    df, dt = period_dates(m['period'], now)
    fake_event = {'headers': {}, 'queryStringParameters': {}}
    blocks = []
    attachments = []
    text_lines = []
    for key in m['reports']:
        if key not in titles:
            continue
        title = titles[key]
        params = {'date_from': str(df), 'date_to': str(dt)}
        rtype = key
        if key.startswith('point:'):
            rtype = 'point-passes'
            params['control_point_id'] = key.split(':', 1)[1]
        if rtype == 'events-log':
            params['limit'] = '1000'
        err, csv_text, raw = deps['build_csv'](rtype, params, fake_event, False)
        if err:
            blocks.append('<p style="color:#dc2626;">%s — не удалось сформировать</p>' % html_lib.escape(title))
            continue
        summary = (raw or {}).get('summary') or {}
        rows = len((raw or {}).get('items') or [])
        stats = ''.join(
            '<td style="padding:6px 10px;background:#f9fafb;border-radius:8px;text-align:center;">'
            '<div style="font-size:18px;font-weight:bold;color:#111827;">%s</div>'
            '<div style="font-size:11px;color:#6b7280;">%s</div></td><td width="6"></td>' % (summary.get(f, 0), html_lib.escape(lbl))
            for f, lbl in SUMMARY_LABELS.get(rtype, []) if f in summary)
        per = 'текущее состояние' if rtype in NO_PERIOD else (fmt(df) if df == dt else '%s — %s' % (fmt(df), fmt(dt)))
        blocks.append(
            '<h3 style="font-size:15px;margin:22px 0 6px;color:#111827;">%s</h3>'
            '<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">%s · строк в таблице: %d</div>'
            '<table cellpadding="0" cellspacing="0"><tr>%s</tr></table>' % (html_lib.escape(title), per, rows, stats))
        text_lines.append('%s (%s): строк %d' % (title, per, rows))
        safe = ''.join(c if c.isalnum() or c in '-_' else '_' for c in title.replace(' ', '_'))[:60]
        attachments.append(('%s_%s.csv' % (safe, dt.strftime('%Y%m%d')), csv_text))

    period_title = PERIODS.get(m['period'], '')
    html_body = """<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0e1218;padding:20px 24px;color:#f59e0b;font-size:20px;font-weight:bold;">Горный контроль
<div style="color:#9ca3af;font-size:13px;font-weight:normal;margin-top:4px;">%s · %s</div></td></tr>
<tr><td style="padding:8px 24px 24px;color:#111827;">%s
<p style="color:#6b7280;font-size:13px;margin-top:22px;">Полные таблицы — во вложениях (CSV, открываются в Excel).</p></td></tr>
<tr><td align="center" style="background:#f9fafb;padding:12px;color:#9ca3af;font-size:12px;">Письмо отправлено автоматически · %s</td></tr>
</table></td></tr></table></body></html>""" % (
        html_lib.escape(m['name']), period_title.lower(), ''.join(blocks) or '<p>Нет отчётов для отправки.</p>', now.strftime('%d.%m.%Y %H:%M'))
    subject = '%s — %s' % (m['name'], fmt(df) if df == dt else '%s–%s' % (fmt(df), fmt(dt)))
    return subject, '\n'.join(text_lines), html_body, attachments


def send_mail(to_list, subject, text, html_body, attachments):
    host = os.environ.get('SMTP_HOST', '')
    user = os.environ.get('SMTP_USER', '')
    password = os.environ.get('SMTP_PASSWORD', '')
    port = int(os.environ.get('SMTP_PORT', '465') or 465)
    msg = MIMEMultipart('mixed')
    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(text, 'plain', 'utf-8'))
    alt.attach(MIMEText(html_body, 'html', 'utf-8'))
    msg.attach(alt)
    for name, content in attachments:
        part = MIMEBase('text', 'csv')
        part.set_payload(content.encode('utf-8'))
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment', filename=('utf-8', '', name))
        msg.attach(part)
    msg['Subject'] = Header(subject, 'utf-8')
    msg['From'] = '%s <%s>' % (Header('Горный контроль', 'utf-8').encode(), user)
    msg['To'] = ', '.join(to_list)
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=10) as srv:
            srv.login(user, password)
            srv.sendmail(user, to_list, msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=10) as srv:
            srv.starttls(context=ssl.create_default_context())
            srv.login(user, password)
            srv.sendmail(user, to_list, msg.as_string())


def deliver(cur, conn, m, titles, deps):
    now = local_now(m['tz'])
    try:
        subject, text, html_body, att = build_email(m, titles, deps, now)
        send_mail(m['emails'], subject, text, html_body, att)
        cur.execute("UPDATE report_mailings SET last_status = 'ok', last_error = '', last_sent_at = NOW() WHERE id = %d" % m['id'])
        conn.commit()
        return None
    except Exception as e:
        msg = str(e)[:300]
        cur.execute("UPDATE report_mailings SET last_status = 'error', last_error = '%s', last_sent_at = NOW() WHERE id = %d"
                    % (msg.replace("'", "''"), m['id']))
        conn.commit()
        return msg


def slot_key(m, now):
    """Ключ «окна» отправки: день / неделя / месяц, либо None — если сегодня не день отправки"""
    if now.hour < int(m['hour']):
        return None
    if m['frequency'] == 'weekly':
        if now.isoweekday() != int(m['weekday']):
            return None
        return now.strftime('%G-W%V')
    if m['frequency'] == 'monthly':
        import calendar
        last = calendar.monthrange(now.year, now.month)[1]
        if now.day != min(int(m['month_day']), last):
            return None
        return now.strftime('%Y-%m')
    return now.strftime('%Y-%m-%d')


def route(action, method, params, body, event, deps):
    json_response = deps['json_response']
    conn = deps['get_db']()
    cur = conn.cursor()

    def done(status, payload):
        cur.close()
        conn.close()
        return json_response(status, payload)

    items = catalog(cur)
    titles = {i['key']: i['title'] for i in items}

    if action == 'cron':
        import urllib.request
        pass_alert = ''
        try:
            with urllib.request.urlopen(EVENTS_URL + '?action=pass-alert-auto', timeout=4) as r:
                pass_alert = json.loads(r.read().decode()).get('status', '')
        except Exception as e:
            pass_alert = 'error: %s' % str(e)[:60]
        stamp = json.dumps({'at': datetime.utcnow().isoformat() + 'Z', 'pass_alert': pass_alert}).replace("'", "''")
        cur.execute("""INSERT INTO settings (key, value, updated_at) VALUES ('cron_last', '%s'::jsonb, NOW())
                       ON CONFLICT (key) DO UPDATE SET value = '%s'::jsonb, updated_at = NOW()""" % (stamp, stamp))
        conn.commit()
        action = 'mailings-auto'

    if action == 'mailings-auto':
        if not smtp_ready():
            return done(200, {'status': 'smtp_off'})
        cur.execute("SELECT %s FROM report_mailings WHERE enabled = TRUE AND is_archived = FALSE ORDER BY id" % COLS)
        sent = []
        for r in cur.fetchall():
            if len(sent) >= 2:
                break
            m = row_to_mailing(r, titles)
            key = slot_key(m, local_now(m['tz']))
            if not key or m['last_sent'] == key or not m['emails'] or not [k for k in m['reports'] if k in titles]:
                continue
            cur.execute("UPDATE report_mailings SET last_sent = '%s' WHERE id = %d AND last_sent <> '%s' RETURNING id"
                        % (key, m['id'], key))
            claimed = cur.fetchone()
            conn.commit()
            if not claimed:
                continue
            deliver(cur, conn, m, titles, deps)
            sent.append(m['id'])
        return done(200, {'status': 'ok', 'sent': sent})

    if not deps['is_admin'](event):
        return done(403, {'error': 'Рассылки настраивает только администратор'})

    if action == 'mailings':
        cur.execute("SELECT %s FROM report_mailings WHERE is_archived = FALSE ORDER BY id" % COLS)
        rows = [row_to_mailing(r, titles) for r in cur.fetchall()]
        cur.execute("SELECT value FROM settings WHERE key = 'cron_last'")
        cl = cur.fetchone()
        cron_last = (cl[0] if isinstance(cl[0], dict) else json.loads(cl[0])) if cl else None
        return done(200, {'mailings': rows, 'catalog': items, 'periods': PERIODS, 'smtp_ready': smtp_ready(),
                          'cron_last': cron_last})

    if action == 'mailing-save' and method == 'POST':
        name = str(body.get('name') or '').strip()[:150]
        emails = clean_emails(body.get('emails'))
        reports = [k for k in (body.get('reports') or []) if k in titles][:30]
        if not name:
            return done(400, {'error': 'Укажите название рассылки'})
        if not emails:
            return done(400, {'error': 'Укажите хотя бы один адрес почты'})
        if not reports:
            return done(400, {'error': 'Выберите хотя бы один отчёт'})
        freq = body.get('frequency') if body.get('frequency') in FREQS else 'daily'
        period = body.get('period') if body.get('period') in PERIODS else 'yesterday'
        hour = max(0, min(23, int(body.get('hour', 8))))
        weekday = max(1, min(7, int(body.get('weekday', 1))))
        month_day = max(1, min(31, int(body.get('month_day', 1))))
        tz = str(body.get('tz') or 'Asia/Chita')[:50]
        enabled = 'TRUE' if body.get('enabled', True) else 'FALSE'
        q = lambda v: v.replace("'", "''")
        rep_json = q(json.dumps(reports, ensure_ascii=False))
        mid = body.get('id')
        if mid:
            cur.execute("""UPDATE report_mailings SET name = '%s', enabled = %s, emails = '%s', reports = '%s'::jsonb,
                           frequency = '%s', weekday = %d, month_day = %d, hour = %d, tz = '%s', period = '%s', updated_at = NOW()
                           WHERE id = %d AND is_archived = FALSE RETURNING id"""
                        % (q(name), enabled, q(','.join(emails)), rep_json, freq, weekday, month_day, hour, q(tz), period, int(mid)))
            if not cur.fetchone():
                return done(404, {'error': 'Рассылка не найдена'})
        else:
            now = local_now(tz)
            draft = {'frequency': freq, 'hour': hour, 'weekday': weekday, 'month_day': month_day}
            first_key = slot_key(draft, now) or ''
            cur.execute("""INSERT INTO report_mailings (name, enabled, emails, reports, frequency, weekday, month_day, hour, tz, period, last_sent)
                           VALUES ('%s', %s, '%s', '%s'::jsonb, '%s', %d, %d, %d, '%s', '%s', '%s') RETURNING id"""
                        % (q(name), enabled, q(','.join(emails)), rep_json, freq, weekday, month_day, hour, q(tz), period, first_key))
            mid = cur.fetchone()[0]
        conn.commit()
        cur.execute("SELECT %s FROM report_mailings WHERE id = %d" % (COLS, int(mid)))
        return done(200, {'mailing': row_to_mailing(cur.fetchone(), titles)})

    if action == 'mailing-remove' and method == 'POST':
        cur.execute("UPDATE report_mailings SET is_archived = TRUE, enabled = FALSE, updated_at = NOW() WHERE id = %d" % int(body.get('id') or 0))
        conn.commit()
        return done(200, {'success': True})

    if action == 'mailing-send' and method == 'POST':
        if not smtp_ready():
            return done(400, {'error': 'Почта для отправки не настроена'})
        cur.execute("SELECT %s FROM report_mailings WHERE id = %d AND is_archived = FALSE" % (COLS, int(body.get('id') or 0)))
        r = cur.fetchone()
        if not r:
            return done(404, {'error': 'Рассылка не найдена'})
        m = row_to_mailing(r, titles)
        if not [k for k in m['reports'] if k in titles]:
            return done(400, {'error': 'В рассылке не осталось доступных отчётов'})
        err = deliver(cur, conn, m, titles, deps)
        if err:
            return done(502, {'error': 'Почтовый сервер не принял письмо: %s' % err[:150]})
        return done(200, {'message': 'Письмо отправлено на %s' % ', '.join(m['emails'])})

    return done(404, {'error': 'Маршрут не найден'})

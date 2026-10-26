import json
import os
import re
import psycopg2

NAME_KEYS = {
    'full_name', 'person_name', 'owner_name', 'sender_name', 'doctor_name', 'issued_by', 'returned_by',
    'checked_by', 'denied_by', 'performed_by', 'created_by', 'updated_by', 'temp_owner_name', 'owner_full_name',
    'temp_name', 'resident_name', 'name_owner', 'employee_name', 'author', 'author_name', 'user_name', 'fio',
}
ORG_KEYS = {'organization', 'company', 'company_name', 'org_name', 'organization_name', 'contractor', 'employer', 'owner_org'}
LEGAL_RX = re.compile(r'^(?:ООО|ОАО|ЗАО|ПАО|АО|НАО|ИП|ФГУП|МУП|ГУП|ТОО|LLC|ООО\s*УК)\s+', re.IGNORECASE)
QUOTES = '"«»„“”\''
GENERIC_WORDS = {
    'горно', 'горный', 'горная', 'рудник', 'рудника', 'компания', 'группа', 'холдинг', 'сервис', 'строй', 'проект',
    'управление', 'монтаж', 'ремонт', 'техника', 'транспорт', 'охрана', 'безопасность', 'подрядчик', 'гости',
    'добыча', 'золото', 'металл', 'энерго', 'регион', 'сибирь', 'восток', 'забайкалье', 'россия', 'русский',
}
BLANK_KEYS = {
    'email', 'login_email', 'phone', 'passport', 'birth_date', 'photo_url', 'face_photo_url', 'snils', 'inn',
    'personal_code', 'person_code', 'qr_code', 'tab_number', 'login_code', 'phone_number', 'mobile',
    'vehicle_number', 'pass_number', 'vehicle_pass_number', 'passport_number',
}
WRITE_OK = {
    'login', 'login-code', 'logout', 'register', 'email-send-code', 'email-verify-code', 'face-login', 'demo-enter',
}
PUBLIC_RAW = {'pass-alert-auto', 'mailings-auto', 'cron', 'demo-default', 'demo-validate'}
BLOCK_FILES = {'export-all', 'vehicle-export', 'download', 'file', 'photo'}
DENY_MSG = 'Режим просмотра: сохранение недоступно, пока администратор не откроет полный доступ'


def _token(event):
    headers = event.get('headers') or {}
    for key in ('X-Authorization', 'x-authorization', 'Authorization', 'authorization'):
        val = headers.get(key, '')
        if val:
            return val[7:] if val.startswith('Bearer ') else val
    return (event.get('queryStringParameters') or {}).get('auth', '')


_state_cache = {}


def caller_state(event):
    """Возвращает (ограничен ли доступ, id пользователя)"""
    headers = event.get('headers') or {}
    params = event.get('queryStringParameters') or {}
    demo = headers.get('X-Demo', headers.get('x-demo', '')) == 'true' or params.get('demo') == '1'
    token = _token(event)
    if not token:
        return demo, None
    import time
    hit = _state_cache.get(token)
    if hit and time.time() - hit[0] < 30:
        return demo or hit[1], hit[2]
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, COALESCE(u.access_status, 'active'), COALESCE(s.is_demo, FALSE)
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = '%s' AND s.expires_at > NOW()
    """ % token.replace("'", "''"))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return demo, None
    restricted = row[1] == 'pending' or bool(row[2])
    if len(_state_cache) > 500:
        _state_cache.clear()
    _state_cache[token] = (time.time(), restricted, row[0])
    return demo or restricted, row[0]


def _load_orgs():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute("""SELECT DISTINCT n FROM (
        SELECT organization FROM personnel UNION ALL SELECT organization FROM users
        UNION ALL SELECT organization FROM aho_arrivals) t(n)
        WHERE COALESCE(n, '') <> '' LIMIT 5000""")
    rows = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def org_variants(name):
    """Полное название, название без формы собственности и кавычек, характерные слова для поиска внутри текста"""
    full = ' '.join(str(name).split())
    bare = LEGAL_RX.sub('', full)
    plain = ' '.join(bare.translate({ord(c): ' ' for c in QUOTES}).split())
    exact = {v for v in (full, bare, plain) if len(v) >= 3}
    stems = set()
    abbr = set()
    for w in re.findall(r'[A-Za-zА-Яа-яЁё0-9\-]+', plain):
        lw = w.lower()
        if w.isupper() and 2 <= len(w) <= 6 and not w.isdigit():
            abbr.add(w)
        elif len(w) >= 6 and lw not in GENERIC_WORDS and not any(lw.startswith(g) for g in GENERIC_WORDS):
            stems.add(lw[:max(5, len(lw) - 2)])
    return exact, stems, abbr


def _load_names(self_id):
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    sources = [
        "SELECT full_name FROM personnel",
        "SELECT full_name FROM users WHERE id <> %d" % int(self_id or 0),
        "SELECT full_name FROM aho_arrivals",
        "SELECT full_name FROM checkpoint_passes",
        "SELECT owner_name FROM vehicle_passes",
        "SELECT full_name FROM security_checks",
        "SELECT person_name FROM lamp_room_issues",
        "SELECT person_name FROM lamp_room_denials",
        "SELECT person_name FROM notifications",
        "SELECT sender_name FROM dispatcher_messages",
        "SELECT doctor_name FROM medical_checks",
    ]
    cur.execute("SELECT DISTINCT n FROM (%s) t(n) WHERE COALESCE(n, '') <> '' LIMIT 50000" % ' UNION ALL '.join(sources))
    rows = [(None, r[0]) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


PHONE_RX = re.compile(r'(?<!\d)(?:\+7|8)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)')
CSV_BLANK_COLS = ('код', 'таб', 'телефон', 'email', 'почт', 'паспорт', 'снилс', 'инн', 'фото', 'qr', 'дата рожд')
CSV_ORG_COLS = ('организац', 'компани', 'подрядчик', 'работодател')
CSV_NAME_COLS = ('фио', 'сотрудник', 'владелец', 'выдал', 'принял', 'врач', 'проверил', 'отправитель')


def mask_csv(masker, body):
    import csv
    import io
    bom = body.startswith('\ufeff')
    raw = body[1:] if bom else body
    rows = list(csv.reader(io.StringIO(raw), delimiter=';'))
    if not rows:
        return body
    head = [h.strip().lower() for h in rows[0]]
    blank = {i for i, h in enumerate(head) if any(k in h for k in CSV_BLANK_COLS)}
    names = {i for i, h in enumerate(head) if any(k in h for k in CSV_NAME_COLS)}
    orgs = {i for i, h in enumerate(head) if any(k in h for k in CSV_ORG_COLS)}
    out = io.StringIO()
    w = csv.writer(out, delimiter=';')
    w.writerow(rows[0])
    for r in rows[1:]:
        nr = []
        for i, v in enumerate(r):
            if i in blank and v:
                nr.append('***')
            elif i in names and v:
                nr.append(masker.name(v))
            elif i in orgs and v:
                nr.append(masker.org(v))
            else:
                nr.append(PHONE_RX.sub('***', masker.text(v)))
        w.writerow(nr)
    return ('\ufeff' if bom else '') + out.getvalue()


class Masker:
    def __init__(self, self_id):
        self.full = {}
        self.parts = {}
        self.counter = 0
        for key, name in _load_names(self_id):
            clean = ' '.join(str(name).split())
            if len(clean) < 3:
                continue
            alias = self.full.get(clean.lower()) or self._alias()
            self.full[clean.lower()] = alias
            words = clean.split(' ')
            if len(words) >= 2 and len(words[0]) >= 4:
                self.parts.setdefault(words[0].lower(), alias)
                if len(words) >= 2:
                    initials = ' '.join(w[0] + '.' for w in words[1:3])
                    self.parts.setdefault(('%s %s' % (words[0], initials)).lower(), alias)
                    self.parts.setdefault(('%s %s' % (words[0], initials.replace(' ', ''))).lower(), alias)
        self.orgs = {}
        org_exact = {}
        org_stems = set()
        org_abbr = set()
        for org in _load_orgs():
            key = ' '.join(str(org).split()).lower()
            if key in self.orgs:
                continue
            alias = 'Организация %d' % (len(self.orgs) + 1)
            exact, stems, abbr = org_variants(org)
            for v in exact:
                org_exact.setdefault(v.lower(), alias)
            self.orgs[key] = alias
            org_stems |= stems
            org_abbr |= abbr
        keys = sorted(list(self.full.keys()) + list(self.parts.keys()) + list(org_exact.keys()), key=len, reverse=True)
        self.lookup = dict(self.parts)
        self.lookup.update(self.full)
        self.lookup.update(org_exact)
        self.rx = re.compile('|'.join(re.escape(k) for k in keys), re.IGNORECASE) if keys else None
        self.org_rx = None
        pats = [r'(?<![A-Za-zА-Яа-яЁё])%s[A-Za-zА-Яа-яЁё]*' % re.escape(st) for st in sorted(org_stems, key=len, reverse=True)]
        pats += [r'(?<![A-Za-zА-Яа-яЁё])%s(?![A-Za-zА-Яа-яЁё])' % re.escape(a) for a in sorted(org_abbr, key=len, reverse=True)]
        if pats:
            self.org_rx = re.compile('|'.join(pats), re.IGNORECASE)

    def _alias(self):
        self.counter += 1
        return 'Сотрудник %03d' % self.counter

    def text(self, s):
        if (not self.rx and not getattr(self, 'org_rx', None)) or not s:
            return s
        if not self.rx:
            return self.org_rx.sub('Компания', s)
        def repl(m):
            start, end = m.start(), m.end()
            if start > 0 and s[start - 1].isalpha():
                return m.group(0)
            if end < len(s) and s[end].isalpha():
                return m.group(0)
            return self.lookup.get(m.group(0).lower(), 'Сотрудник')
        out = self.rx.sub(repl, s)
        if self.org_rx:
            out = self.org_rx.sub('Компания', out)
        return out

    def org(self, s):
        if not isinstance(s, str) or not s.strip() or s.strip() in ('—', '-'):
            return s
        key = ' '.join(s.split()).lower()
        return self.orgs.get(key) or self.text(s)

    def name(self, s):
        if not isinstance(s, str) or not s.strip() or s.strip() in ('—', '-'):
            return s
        key = ' '.join(s.split()).lower()
        if key in self.full:
            return self.full[key]
        masked = self.text(s)
        return masked if masked != s else 'Сотрудник'

    def walk(self, obj):
        if isinstance(obj, dict):
            out = {}
            for k, v in obj.items():
                if k in BLANK_KEYS and isinstance(v, str):
                    out[k] = ''
                elif k in NAME_KEYS and isinstance(v, str):
                    out[k] = self.name(v)
                elif k in ORG_KEYS and isinstance(v, str):
                    out[k] = self.org(v)
                else:
                    out[self.text(k) if isinstance(k, str) else k] = self.walk(v)
            return out
        if isinstance(obj, list):
            return [self.walk(v) for v in obj]
        if isinstance(obj, str):
            return PHONE_RX.sub('***', self.text(obj))
        return obj


def _deny():
    return {
        'statusCode': 403,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': DENY_MSG, 'restricted': True}, ensure_ascii=False),
    }


SKIP_MASK = {'me', 'login', 'login-code', 'register', 'email-verify-code', 'face-login', 'demo-enter', 'demo-validate', 'demo-default'}

_cache = {'at': 0, 'self': None, 'm': None}


def get_masker(self_id):
    import time
    now = time.time()
    if _cache['m'] is None or _cache['self'] != self_id or now - _cache['at'] > 300:
        _cache.update({'m': Masker(self_id), 'self': self_id, 'at': now})
    return _cache['m']


def _deny_files():
    return {
        'statusCode': 403,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Режим просмотра: выгрузка файлов с персональными данными недоступна', 'restricted': True}, ensure_ascii=False),
    }


def guard(event, context, handler, write_ok=()):
    """Режим просмотра для демо и новых пользователей: запрет записи, скрытие реальных ФИО и названий компаний"""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return handler(event, context)
    restricted, self_id = caller_state(event)
    anonymous = not restricted and not _token(event)
    if not restricted and not anonymous:
        return handler(event, context)
    action = (event.get('queryStringParameters') or {}).get('action', '')
    if restricted and method != 'GET' and action not in WRITE_OK and action not in write_ok:
        return _deny()
    if anonymous and action in PUBLIC_RAW:
        return handler(event, context)
    if restricted and action in BLOCK_FILES:
        return _deny_files()
    res = handler(event, context)
    body = res.get('body')
    if action in SKIP_MASK or not isinstance(body, str) or not body or res.get('isBase64Encoded'):
        return res
    masker = get_masker(self_id)
    ctype = str((res.get('headers') or {}).get('Content-Type', ''))
    if 'json' in ctype or body[:1] in ('{', '['):
        try:
            data = json.loads(body)
        except ValueError:
            res['body'] = masker.text(body)
            return res
        res['body'] = json.dumps(masker.walk(data), ensure_ascii=False)
    elif 'csv' in ctype or ';' in body.split('\n', 1)[0]:
        res['body'] = mask_csv(masker, body)
    else:
        res['body'] = PHONE_RX.sub('***', masker.text(body))
    return res

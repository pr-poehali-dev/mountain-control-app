import json
import os
import hashlib
import secrets
import psycopg2
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import base64
import html as html_lib
from logo_data import LOGO_PNG_B64
from email.header import Header
from datetime import datetime, timedelta, date as date_type

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

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
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization, X-Demo'
        },
        'body': json.dumps(body, ensure_ascii=False, default=serialize_default)
    }

ALL_PAGES = ['dashboard', 'personnel', 'dispatcher', 'medical', 'lampa', 'scanner', 'security', 'checkpoint', 'aho', 'ohs', 'reports', 'profile', 'admin']

VALID_ROLES = ['admin', 'operator', 'dispatcher', 'doctor', 'aho_specialist', 'security', 'checkpoint_officer']

DEFAULT_PERMISSIONS = {
    'admin': ALL_PAGES[:],
    'operator': ['dashboard', 'profile'],
    'dispatcher': ['dashboard', 'profile'],
    'doctor': ['dashboard', 'profile'],
    'aho_specialist': ['dashboard', 'profile'],
    'security': ['dashboard', 'security', 'profile'],
    'checkpoint_officer': ['dashboard', 'checkpoint', 'profile'],
}


def get_auth_token(event):
    headers = event.get('headers') or {}
    for key in ['X-Authorization', 'x-authorization', 'Authorization', 'authorization']:
        val = headers.get(key, '')
        if val:
            return val.replace('Bearer ', '') if val.startswith('Bearer ') else val
    return ''


BUILTIN_ROLES = [
    {'key': 'admin', 'label': 'Администратор'},
    {'key': 'operator', 'label': 'Оператор'},
    {'key': 'dispatcher', 'label': 'Диспетчер'},
    {'key': 'doctor', 'label': 'Врач'},
    {'key': 'aho_specialist', 'label': 'АХО'},
    {'key': 'security', 'label': 'СБ'},
    {'key': 'checkpoint_officer', 'label': 'КПП'},
]


def load_roles(cur):
    cur.execute("SELECT value FROM settings WHERE key = 'custom_roles'")
    row = cur.fetchone()
    if row and row[0]:
        roles = row[0] if isinstance(row[0], list) else json.loads(row[0])
        if not any(r.get('key') == 'admin' for r in roles):
            roles.insert(0, BUILTIN_ROLES[0])
        return roles
    return [dict(r) for r in BUILTIN_ROLES]


def save_roles(cur, roles):
    data = json.dumps(roles, ensure_ascii=False).replace("'", "''")
    cur.execute("""
        INSERT INTO settings (key, value, updated_at) VALUES ('custom_roles', '%s'::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = '%s'::jsonb, updated_at = NOW()
    """ % (data, data))


def save_perms_raw(cur, perms):
    perms['admin'] = ALL_PAGES[:]
    data = json.dumps(perms, ensure_ascii=False).replace("'", "''")
    cur.execute("""
        INSERT INTO settings (key, value, updated_at) VALUES ('role_permissions', '%s'::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = '%s'::jsonb, updated_at = NOW()
    """ % (data, data))


def role_keys(cur):
    return [r['key'] for r in load_roles(cur)]


def role_label_map(cur):
    return {r['key']: r['label'] for r in load_roles(cur)}


def load_permissions(cur):
    cur.execute("SELECT value FROM settings WHERE key = 'role_permissions'")
    row = cur.fetchone()
    if row:
        return row[0] if isinstance(row[0], dict) else json.loads(row[0])
    return DEFAULT_PERMISSIONS


def handler(event, context):
    """Авторизация и управление пользователями системы Горный контроль"""
    if event.get('httpMethod') == 'OPTIONS':
        return json_response(200, '')

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body', '{}') or '{}')

    if method == 'POST' and action == 'register':
        return register(body)
    elif method == 'POST' and action == 'login':
        return login(body)
    elif method == 'POST' and action == 'email-send-code':
        return email_send_code(body)
    elif method == 'POST' and action == 'email-verify-code':
        return email_verify_code(body)
    elif method == 'POST' and action == 'login-code':
        return login_by_code(body)
    elif method == 'POST' and action == 'face-login':
        return face_login(body)
    elif method == 'POST' and action == 'face-save':
        return face_save(event, body)
    elif method == 'DELETE' and action == 'face-delete':
        return face_delete(event, body)
    elif method == 'GET' and action == 'me':
        return get_me(event)
    elif method == 'POST' and action == 'logout':
        return logout(event)
    elif method == 'GET' and action == 'users':
        return list_users(event)
    elif method == 'PUT' and action == 'role':
        return update_role(event, body)
    elif method == 'GET' and action == 'permissions':
        return get_permissions(event)
    elif method == 'PUT' and action == 'permissions':
        return save_permissions(event, body)
    elif method == 'GET' and action == 'roles':
        return get_roles(event)
    elif method == 'POST' and action == 'role-save':
        return role_save(event, body)
    elif method == 'DELETE' and action == 'role-delete':
        return role_delete(event, body)
    elif method == 'POST' and action == 'create-user':
        return create_user(event, body)
    elif method == 'DELETE' and action == 'delete-user':
        return delete_user(event, body)
    elif method == 'PUT' and action == 'update-user':
        return update_user(event, body)
    elif method == 'POST' and action == 'demo-create':
        return demo_create(event, body)
    elif method == 'GET' and action == 'demo-list':
        return demo_list(event)
    elif method == 'POST' and action == 'demo-toggle':
        return demo_toggle(event, body)
    elif method == 'DELETE' and action == 'demo-delete':
        return demo_delete(event, body)
    elif method == 'POST' and action == 'demo-enter':
        return demo_enter(body)
    elif method == 'GET' and action == 'demo-validate':
        return demo_validate(event)
    elif method == 'GET' and action == 'demo-default':
        return demo_default()

    return json_response(404, {'error': 'Маршрут не найден'})

def register(body):
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')
    full_name = body.get('full_name', '').strip()
    position = body.get('position', '').strip()
    department = body.get('department', '').strip()
    organization = body.get('organization', '').strip()
    organization_type = body.get('organization_type', '').strip()

    if not email or not password or not full_name:
        return json_response(400, {'error': 'Email, пароль и ФИО обязательны'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id FROM users WHERE email = '%s'" % email.replace("'", "''"))
    if cur.fetchone():
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Пользователь с таким email уже существует'})

    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM users")
    next_id = cur.fetchone()[0]
    personal_code = 'УС-%03d' % next_id
    qr_code = 'QR-US-%03d' % next_id
    password_hash = hash_password(password)

    cur.execute("""
        INSERT INTO users (email, password_hash, full_name, position, department, personal_code, qr_code, role, organization, organization_type)
        VALUES ('%s', '%s', '%s', '%s', '%s', '%s', '%s', 'operator', '%s', '%s')
        RETURNING id, personal_code, qr_code
    """ % (
        email.replace("'", "''"),
        password_hash,
        full_name.replace("'", "''"),
        position.replace("'", "''"),
        department.replace("'", "''"),
        personal_code,
        qr_code,
        organization.replace("'", "''"),
        organization_type.replace("'", "''")
    ))
    row = cur.fetchone()
    user_id = row[0]

    token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(days=7)
    cur.execute("""
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (%d, '%s', '%s')
    """ % (user_id, token, expires.isoformat()))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': user_id,
            'email': email,
            'full_name': full_name,
            'position': position,
            'department': department,
            'personal_code': personal_code,
            'qr_code': qr_code,
            'role': 'operator',
            'organization': organization,
            'organization_type': organization_type
        }
    })

def login(body):
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')

    if not email or not password:
        return json_response(400, {'error': 'Email и пароль обязательны'})

    conn = get_db()
    cur = conn.cursor()

    password_hash = hash_password(password)
    cur.execute("""
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active, organization, organization_type, login_email
        FROM users WHERE email = '%s' AND password_hash = '%s'
    """ % (email.replace("'", "''"), password_hash))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(401, {'error': 'Неверный email или пароль'})

    if not row[8]:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Учётная запись отключена'})

    if not row[11] and row[7] != 'admin':
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Вход по почте для вас отключён. Используйте личный код или QR-код'})

    role = row[7]
    token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(days=7)
    cur.execute("""
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (%d, '%s', '%s')
    """ % (row[0], token, expires.isoformat()))

    if role == 'admin':
        allowed = ALL_PAGES[:]
    else:
        allowed = load_permissions(cur).get(role, DEFAULT_PERMISSIONS.get(role, ['dashboard', 'profile']))

    conn.commit()
    role_label = role_label_map(cur).get(role, role)
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role, 'role_label': role_label,
            'organization': row[9] or '', 'organization_type': row[10] or ''
        },
        'allowed_pages': allowed
    })

def parse_qr_code(raw):
    try:
        data = json.loads(raw)
        return data.get('code', raw)
    except (json.JSONDecodeError, AttributeError):
        return raw.strip()

def login_by_code(body):
    raw_code = body.get('code', '').strip()
    code = parse_qr_code(raw_code).upper()

    if not code:
        return json_response(400, {'error': 'Введите личный код'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active, organization, organization_type, login_code
        FROM users WHERE personal_code = '%s' OR qr_code = '%s'
    """ % (code.replace("'", "''"), code.replace("'", "''")))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(401, {'error': 'Пользователь с таким кодом не найден'})

    if not row[8]:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Учётная запись отключена'})

    if not row[11] and row[7] != 'admin':
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Вход по коду / QR для вас отключён. Используйте почту и пароль'})

    role = row[7]
    token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(days=7)
    cur.execute("""
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (%d, '%s', '%s')
    """ % (row[0], token, expires.isoformat()))

    if role == 'admin':
        allowed = ALL_PAGES[:]
    else:
        allowed = load_permissions(cur).get(role, DEFAULT_PERMISSIONS.get(role, ['dashboard', 'profile']))

    conn.commit()
    role_label = role_label_map(cur).get(role, role)
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role, 'role_label': role_label,
            'organization': row[9] or '', 'organization_type': row[10] or ''
        },
        'allowed_pages': allowed
    })

def get_me(event):
    token = get_auth_token(event)
    if not token:
        return json_response(401, {'error': 'Требуется авторизация'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT u.id, u.email, u.full_name, u.position, u.department, u.personal_code, u.qr_code, u.role, u.organization, u.organization_type, u.face_descriptor IS NOT NULL, u.face_photo_url, u.face_self_enrolled
        FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE
    """ % token.replace("'", "''"))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(401, {'error': 'Сессия истекла'})

    role = row[7]
    if role == 'admin':
        allowed = ALL_PAGES[:]
    else:
        perms = load_permissions(cur)
        allowed = perms.get(role, DEFAULT_PERMISSIONS.get(role, ['dashboard', 'profile']))

    role_label = role_label_map(cur).get(role, role)
    cur.execute("SELECT COALESCE(residence, '') FROM personnel WHERE personal_code = '%s' AND status != 'archived' LIMIT 1" % str(row[5] or '').replace("'", "''"))
    res_row = cur.fetchone()
    residence = res_row[0] if res_row else ''
    cur.close()
    conn.close()

    return json_response(200, {
        'user': {
            'residence': residence,
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role, 'role_label': role_label,
            'organization': row[8] or '', 'organization_type': row[9] or '',
            'has_face': bool(row[10]), 'face_photo_url': row[11] or '',
            'face_can_self_enroll': role == 'admin' or (not row[10] and not row[12])
        },
        'allowed_pages': allowed
    })

def logout(event):
    token = get_auth_token(event)
    if token:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE token = '%s'" % token.replace("'", "''"))
        conn.commit()
        cur.close()
        conn.close()

    return json_response(200, {'message': 'Выход выполнен'})


def get_current_user(event):
    token = get_auth_token(event)
    if not token:
        return None
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.role FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE
    """ % token.replace("'", "''"))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None
    return {'id': row[0], 'role': row[1]}


def list_users(event):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, email, full_name, position, department, personal_code, role, is_active, organization, organization_type,
               created_at, login_email, login_code, face_descriptor IS NOT NULL, face_photo_url
        FROM users ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    users = []
    for r in rows:
        users.append({
            'id': r[0], 'email': r[1], 'full_name': r[2],
            'position': r[3] or '', 'department': r[4] or '',
            'personal_code': r[5] or '', 'role': r[6],
            'is_active': r[7], 'organization': r[8] or '',
            'organization_type': r[9] or '',
            'created_at': r[10],
            'login_email': r[11], 'login_code': r[12],
            'has_face': bool(r[13]), 'face_photo_url': r[14] or ''
        })

    return json_response(200, {'users': users})


def update_role(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    user_id = body.get('user_id')
    new_role = body.get('role', '').strip()

    if int(user_id or 0) == caller['id']:
        return json_response(400, {'error': 'Нельзя менять роль самому себе'})

    conn = get_db()
    cur = conn.cursor()

    if not user_id or new_role not in role_keys(cur):
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Укажите пользователя и существующую роль'})
    role_labels = role_label_map(cur)

    cur.execute("SELECT id, role FROM users WHERE id = %d" % int(user_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Пользователь не найден'})

    old_role = row[1]
    if old_role == 'admin':
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Нельзя изменять роль администратора'})

    cur.execute("UPDATE users SET role = '%s' WHERE id = %d" % (new_role, int(user_id)))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Роль изменена: %s → %s' % (role_labels.get(old_role, old_role), role_labels.get(new_role, new_role)),
        'user_id': int(user_id),
        'old_role': old_role,
        'new_role': new_role
    })


def get_permissions(event):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    conn = get_db()
    cur = conn.cursor()
    perms = load_permissions(cur)
    roles = load_roles(cur)
    cur.close()
    conn.close()

    return json_response(200, {'permissions': perms, 'roles': roles, 'all_pages': ALL_PAGES})


def get_roles(event):
    caller = get_current_user(event)
    if not caller:
        return json_response(401, {'error': 'Требуется авторизация'})
    conn = get_db()
    cur = conn.cursor()
    roles = load_roles(cur)
    perms = load_permissions(cur)
    cur.execute("SELECT role, COUNT(*) FROM users WHERE is_active = TRUE GROUP BY role")
    counts = {r[0]: r[1] for r in cur.fetchall()}
    cur.close()
    conn.close()
    for r in roles:
        r['users_count'] = counts.get(r['key'], 0)
        r['pages'] = ALL_PAGES[:] if r['key'] == 'admin' else perms.get(r['key'], [])
    return json_response(200, {'roles': roles, 'all_pages': ALL_PAGES})


def role_save(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    key = (body.get('key') or '').strip()
    label = (body.get('label') or '').strip()
    pages = body.get('pages')
    if not label:
        return json_response(400, {'error': 'Укажите название роли'})
    if key == 'admin':
        return json_response(400, {'error': 'Роль администратора изменять нельзя'})

    conn = get_db()
    cur = conn.cursor()
    roles = load_roles(cur)

    if any(r['label'].lower() == label.lower() and r['key'] != key for r in roles):
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Роль с таким названием уже есть'})

    if key:
        found = False
        for r in roles:
            if r['key'] == key:
                r['label'] = label
                found = True
        if not found:
            cur.close()
            conn.close()
            return json_response(404, {'error': 'Роль не найдена'})
    else:
        key = 'role_%s' % secrets.token_hex(4)
        roles.append({'key': key, 'label': label})

    save_roles(cur, roles)

    if isinstance(pages, list):
        perms = load_permissions(cur)
        perms = dict(perms)
        perms[key] = [p for p in pages if p in ALL_PAGES and p != 'admin']
        save_perms_raw(cur, perms)

    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Роль «%s» сохранена' % label, 'key': key})


def role_delete(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    key = (body.get('key') or '').strip()
    if not key or key == 'admin':
        return json_response(400, {'error': 'Эту роль удалить нельзя'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users WHERE role = '%s' AND is_active = TRUE" % key.replace("'", "''"))
    cnt = cur.fetchone()[0]
    if cnt > 0:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Роль назначена %d пользователям. Сначала смените им роль.' % cnt})

    roles = [r for r in load_roles(cur) if r['key'] != key]
    save_roles(cur, roles)
    perms = dict(load_permissions(cur))
    perms.pop(key, None)
    save_perms_raw(cur, perms)
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Роль удалена'})


def save_permissions(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    permissions = body.get('permissions', {})
    if not isinstance(permissions, dict):
        return json_response(400, {'error': 'permissions должен быть объектом'})

    permissions['admin'] = ALL_PAGES[:]

    conn = get_db()
    cur = conn.cursor()
    perms_json = json.dumps(permissions, ensure_ascii=False)
    cur.execute("""
        INSERT INTO settings (key, value, updated_at) VALUES ('role_permissions', '%s'::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = '%s'::jsonb, updated_at = NOW()
    """ % (perms_json.replace("'", "''"), perms_json.replace("'", "''")))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Настройки доступа сохранены', 'permissions': permissions})


def create_user(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    full_name = body.get('full_name', '').strip()
    email = body.get('email', '').strip().lower()
    password = body.get('password', '').strip()
    role = body.get('role', 'operator').strip()
    position = body.get('position', '').strip()
    department = body.get('department', '').strip()
    organization = body.get('organization', '').strip()
    organization_type = body.get('organization_type', '').strip()
    login_email = bool(body.get('login_email', True))
    login_code = bool(body.get('login_code', True))

    if not full_name:
        return json_response(400, {'error': 'Укажите ФИО'})
    if not login_email and not login_code:
        return json_response(400, {'error': 'Выберите хотя бы один способ входа'})
    if login_email and (not email or not password):
        return json_response(400, {'error': 'Для входа по почте укажите email и пароль'})
    if password and len(password) < 6:
        return json_response(400, {'error': 'Пароль должен быть не короче 6 символов'})
    if not email:
        email = 'nomail_%s@local' % secrets.token_hex(4)
    if not password:
        password = secrets.token_hex(12)

    conn = get_db()
    cur = conn.cursor()

    if role not in role_keys(cur):
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Недопустимая роль'})

    cur.execute("SELECT id FROM users WHERE email = '%s'" % email.replace("'", "''"))
    if cur.fetchone():
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Пользователь с таким email уже существует'})

    personnel_id = body.get('personnel_id')
    existing_personnel = None
    if personnel_id:
        cur.execute("SELECT personal_code, qr_code FROM personnel WHERE id = %d" % int(personnel_id))
        existing_personnel = cur.fetchone()
    if not existing_personnel:
        cur.execute("SELECT personal_code, qr_code FROM personnel WHERE LOWER(TRIM(full_name)) = LOWER(TRIM('%s')) LIMIT 1" % full_name.replace("'", "''"))
        existing_personnel = cur.fetchone()
    if existing_personnel:
        personal_code = existing_personnel[0]
        qr_code = existing_personnel[1]
    else:
        cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM users")
        next_id = cur.fetchone()[0]
        personal_code = 'УС-%03d' % next_id
        qr_code = 'QR-US-%03d' % next_id

    cur.execute("SELECT id FROM users WHERE personal_code = '%s'" % personal_code.replace("'", "''"))
    if cur.fetchone():
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Пользователь с таким личным номером уже существует'})

    password_hash = hash_password(password)

    cur.execute("""
        INSERT INTO users (email, password_hash, full_name, position, department, personal_code, qr_code, role, organization, organization_type, login_email, login_code)
        VALUES ('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', %s, %s)
        RETURNING id, personal_code, qr_code
    """ % (
        email.replace("'", "''"),
        password_hash,
        full_name.replace("'", "''"),
        position.replace("'", "''"),
        department.replace("'", "''"),
        personal_code,
        qr_code,
        role,
        organization.replace("'", "''"),
        organization_type.replace("'", "''"),
        'TRUE' if login_email else 'FALSE',
        'TRUE' if login_code else 'FALSE'
    ))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Пользователь создан',
        'user': {
            'id': row[0], 'email': email, 'full_name': full_name,
            'position': position, 'department': department,
            'personal_code': row[1], 'qr_code': row[2], 'role': role,
            'is_active': True,
            'organization': organization, 'organization_type': organization_type,
            'login_email': login_email, 'login_code': login_code
        }
    })


def delete_user(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    user_id = body.get('user_id')
    if not user_id:
        return json_response(400, {'error': 'Укажите user_id'})

    if int(user_id) == caller['id']:
        return json_response(400, {'error': 'Нельзя удалить самого себя'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, full_name, role FROM users WHERE id = %d" % int(user_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Пользователь не найден'})

    if row[2] == 'admin':
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Нельзя удалить администратора'})

    name = row[1]
    cur.execute("DELETE FROM sessions WHERE user_id = %d" % int(user_id))
    cur.execute("UPDATE users SET is_active = FALSE, email = email || '_deleted_' || '%d' WHERE id = %d" % (int(user_id), int(user_id)))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Пользователь %s деактивирован' % name})


def update_user(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    user_id = body.get('user_id')
    if not user_id:
        return json_response(400, {'error': 'Укажите user_id'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, role FROM users WHERE id = %d" % int(user_id))
    target = cur.fetchone()
    if not target:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Пользователь не найден'})

    if target[1] == 'admin' and int(user_id) != caller['id']:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Нельзя изменять данные администратора'})

    updates = []
    for field in ['full_name', 'email', 'position', 'department', 'role', 'organization', 'organization_type']:
        if field in body and body[field] is not None:
            val = str(body[field]).strip()
            if field == 'role' and val not in role_keys(cur):
                cur.close()
                conn.close()
                return json_response(400, {'error': 'Недопустимая роль'})
            if field == 'email':
                val = val.lower()
            updates.append("%s = '%s'" % (field, val.replace("'", "''")))

    if 'password' in body and body['password']:
        updates.append("password_hash = '%s'" % hash_password(body['password']))

    if target[1] != 'admin':
        cur.execute("SELECT login_email, login_code FROM users WHERE id = %d" % int(user_id))
        cur_le, cur_lc = cur.fetchone()
        new_le = bool(body['login_email']) if 'login_email' in body else cur_le
        new_lc = bool(body['login_code']) if 'login_code' in body else cur_lc
        if not new_le and not new_lc:
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Оставьте хотя бы один способ входа'})
        if 'login_email' in body:
            updates.append("login_email = %s" % ('TRUE' if new_le else 'FALSE'))
        if 'login_code' in body:
            updates.append("login_code = %s" % ('TRUE' if new_lc else 'FALSE'))

    if 'is_active' in body:
        updates.append("is_active = %s" % ('TRUE' if body['is_active'] else 'FALSE'))
        if body['is_active']:
            updates.append("email = regexp_replace(email, '_deleted_\\d+$', '')")

    if not updates:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Нечего обновлять'})

    cur.execute("UPDATE users SET %s WHERE id = %d" % (', '.join(updates), int(user_id)))
    sync_user_everywhere(cur, int(user_id))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Данные пользователя обновлены'})


def sync_user_everywhere(cur, user_id):
    cur.execute("SELECT personal_code, full_name, position, department, organization, organization_type FROM users WHERE id = %d" % user_id)
    row = cur.fetchone()
    if not row or not row[0]:
        return
    code, name, position, dept, org, org_type = [(v or '').replace("'", "''") for v in row]

    cur.execute("""
        UPDATE personnel SET full_name = '%s', position = '%s', department = '%s',
               organization = CASE WHEN '%s' <> '' THEN '%s' ELSE organization END,
               organization_type = CASE WHEN '%s' <> '' THEN '%s' ELSE organization_type END,
               updated_at = NOW()
        WHERE personal_code = '%s'
    """ % (name, position, dept, org, org, org_type, org_type, code))

    cur.execute("UPDATE checkpoint_passes SET full_name = '%s' WHERE personal_code = '%s'" % (name, code))
    cur.execute("UPDATE security_checks SET full_name = '%s' WHERE personal_code = '%s'" % (name, code))
    cur.execute("""
        UPDATE aho_arrivals SET full_name = '%s', position = '%s', department = '%s',
               organization = CASE WHEN '%s' <> '' THEN '%s' ELSE organization END,
               organization_type = CASE WHEN '%s' <> '' THEN '%s' ELSE organization_type END
        WHERE personal_code = '%s'
    """ % (name, position, dept, org, org, org_type, org_type, code))
    cur.execute("UPDATE lamp_room_issues SET person_name = '%s' WHERE person_code = '%s'" % (name, code))
    cur.execute("UPDATE lamp_room_denials SET person_name = '%s' WHERE person_code = '%s'" % (name, code))
    cur.execute("UPDATE notifications SET person_name = '%s' WHERE person_code = '%s'" % (name, code))


def demo_create(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    name = body.get('name', '').strip() or 'Демо-ссылка'
    days = int(body.get('days', 7))
    max_visits = int(body.get('max_visits', 0))

    token = secrets.token_urlsafe(32)
    expires = datetime.now() + timedelta(days=days)

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO demo_links (token, name, expires_at, max_visits, created_by)
        VALUES ('%s', '%s', '%s', %d, %d)
        RETURNING id, token, created_at
    """ % (token, name.replace("'", "''"), expires.isoformat(), max_visits, caller['id']))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'message': 'Демо-ссылка создана',
        'link': {
            'id': row[0], 'token': row[1], 'name': name,
            'is_active': True, 'expires_at': expires,
            'max_visits': max_visits, 'visit_count': 0,
            'created_at': row[2]
        }
    })


def demo_list(event):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, token, name, is_active, expires_at, max_visits, visit_count, created_at
        FROM demo_links ORDER BY created_at DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    links = []
    for r in rows:
        links.append({
            'id': r[0], 'token': r[1], 'name': r[2],
            'is_active': r[3], 'expires_at': r[4],
            'max_visits': r[5], 'visit_count': r[6],
            'created_at': r[7]
        })

    return json_response(200, {'links': links})


def demo_toggle(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    link_id = body.get('id')
    if not link_id:
        return json_response(400, {'error': 'Укажите id ссылки'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE demo_links SET is_active = NOT is_active WHERE id = %d RETURNING is_active" % int(link_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Ссылка не найдена'})
    conn.commit()
    cur.close()
    conn.close()

    status = 'активирована' if row[0] else 'деактивирована'
    return json_response(200, {'message': 'Ссылка %s' % status, 'is_active': row[0]})


def demo_delete(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    link_id = body.get('id')
    if not link_id:
        return json_response(400, {'error': 'Укажите id ссылки'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM demo_links WHERE id = %d" % int(link_id))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Ссылка удалена'})


def demo_enter(body):
    token = body.get('token', '').strip()
    if not token:
        return json_response(400, {'error': 'Укажите токен демо-ссылки'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name, is_active, expires_at, max_visits, visit_count
        FROM demo_links WHERE token = '%s'
    """ % token.replace("'", "''"))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Демо-ссылка не найдена'})

    if not row[2]:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Демо-ссылка деактивирована'})

    if row[3] < datetime.now():
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Срок действия демо-ссылки истёк'})

    if row[4] > 0 and row[5] >= row[4]:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Достигнут лимит посещений демо-ссылки'})

    cur.execute("UPDATE demo_links SET visit_count = visit_count + 1 WHERE id = %d" % row[0])

    session_token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(hours=24)
    cur.execute("""
        INSERT INTO sessions (user_id, token, expires_at, is_demo)
        VALUES (
            (SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY id LIMIT 1),
            '%s', '%s', TRUE
        )
    """ % (session_token, expires.isoformat()))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'token': session_token,
        'demo': True,
        'demo_name': row[1],
        'user': {
            'id': 0,
            'email': 'demo@gornycontrol.ru',
            'full_name': 'Демо-пользователь',
            'position': 'Просмотр системы',
            'department': 'Демо-доступ',
            'personal_code': 'DEMO-001',
            'qr_code': 'DEMO-QR-001',
            'role': 'admin',
            'organization': '',
            'organization_type': ''
        },
        'allowed_pages': ALL_PAGES[:]
    })


def demo_validate(event):
    params = event.get('queryStringParameters') or {}
    demo_token = params.get('demo_token', '').strip()
    if not demo_token:
        return json_response(400, {'error': 'Укажите demo_token'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, name, is_active, expires_at, max_visits, visit_count
        FROM demo_links WHERE token = '%s'
    """ % demo_token.replace("'", "''"))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return json_response(404, {'error': 'Демо-ссылка не найдена'})

    valid = row[2] and row[3] >= datetime.now() and (row[4] == 0 or row[5] < row[4])

    return json_response(200, {
        'valid': valid,
        'name': row[1],
        'expires_at': row[3],
        'visit_count': row[5],
        'max_visits': row[4]
    })


def demo_default():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT token FROM demo_links
        WHERE is_active = TRUE AND expires_at > NOW()
        ORDER BY id LIMIT 1
    """)
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return json_response(404, {'error': 'Нет активных демо-ссылок'})

    return json_response(200, {'token': row[0]})

def send_code_email(to_email, code, full_name):
    host = os.environ.get('SMTP_HOST', '')
    user = os.environ.get('SMTP_USER', '')
    password = os.environ.get('SMTP_PASSWORD', '')
    port = int(os.environ.get('SMTP_PORT', '465') or 465)
    if not host or not user or not password:
        raise RuntimeError('smtp_not_configured')
    text = (
        'Здравствуйте, %s!\n\n'
        'Ваш код для входа в систему «Горный контроль»: %s\n\n'
        'Код действует 10 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.'
    ) % (full_name or '', code)
    name_html = html_lib.escape(full_name or '')
    html_body = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td align="center" style="background:#0e1218;padding:28px 24px;">
<img src="cid:logo" width="64" height="64" alt="Горный контроль" style="display:block;border:0;border-radius:16px;">
<div style="color:#f59e0b;font-size:22px;font-weight:bold;margin-top:14px;">Горный контроль</div>
<div style="color:#9ca3af;font-size:13px;margin-top:4px;">Система учёта и контроля персонала на руднике</div>
</td></tr>
<tr><td style="padding:28px 28px 8px 28px;color:#111827;font-size:15px;line-height:1.5;">
Здравствуйте%s!<br><br>Ваш код для входа в систему:
</td></tr>
<tr><td align="center" style="padding:8px 28px 8px 28px;">
<div style="display:inline-block;background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;padding:14px 28px;font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:#0e1218;">%s</div>
</td></tr>
<tr><td style="padding:16px 28px 28px 28px;color:#6b7280;font-size:13px;line-height:1.5;">
Код действует 10 минут и может быть использован только один раз.<br>
Если вы не запрашивали вход — просто проигнорируйте это письмо.
</td></tr>
<tr><td align="center" style="background:#f9fafb;padding:14px;color:#9ca3af;font-size:12px;">
Письмо отправлено автоматически, отвечать на него не нужно.
</td></tr>
</table>
</td></tr></table>
</body></html>""" % ((', ' + name_html) if name_html else '', code)

    msg = MIMEMultipart('related')
    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(text, 'plain', 'utf-8'))
    alt.attach(MIMEText(html_body, 'html', 'utf-8'))
    msg.attach(alt)
    logo = MIMEImage(base64.b64decode(LOGO_PNG_B64), 'png')
    logo.add_header('Content-ID', '<logo>')
    logo.add_header('Content-Disposition', 'inline', filename='logo.png')
    msg.attach(logo)
    msg['Subject'] = Header('Код входа: %s' % code, 'utf-8')
    msg['From'] = '%s <%s>' % (Header('Горный контроль', 'utf-8').encode(), user)
    msg['To'] = to_email
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=10) as srv:
            srv.login(user, password)
            srv.sendmail(user, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=10) as srv:
            srv.starttls(context=ssl.create_default_context())
            srv.login(user, password)
            srv.sendmail(user, [to_email], msg.as_string())


def email_send_code(body):
    """Отправляет одноразовый код входа на зарегистрированный email"""
    email = (body.get('email') or '').strip().lower()
    if not email or '@' not in email:
        return json_response(400, {'error': 'Введите корректный email'})

    conn = get_db()
    cur = conn.cursor()
    safe_email = email.replace("'", "''")
    cur.execute("SELECT id, full_name, is_active, login_email, role FROM users WHERE LOWER(email) = '%s'" % safe_email)
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Этот email не зарегистрирован в системе', 'not_registered': True})
    if not row[2]:
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Учётная запись отключена'})
    if not row[3] and row[4] != 'admin':
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Вход по почте для вас отключён. Используйте личный код или QR-код'})

    cur.execute("SELECT COUNT(*) FROM email_login_codes WHERE email = '%s' AND created_at > NOW() - INTERVAL '60 seconds'" % safe_email)
    if cur.fetchone()[0] > 0:
        cur.close()
        conn.close()
        return json_response(429, {'error': 'Код уже отправлен. Повторно можно запросить через минуту'})

    code = '%06d' % secrets.randbelow(1000000)
    try:
        send_code_email(email, code, row[1])
    except RuntimeError:
        cur.close()
        conn.close()
        return json_response(500, {'error': 'Отправка писем пока не настроена. Обратитесь к администратору'})
    except Exception as e:
        print('SMTP error: %s' % e)
        cur.close()
        conn.close()
        return json_response(502, {'error': 'Не удалось отправить письмо. Попробуйте позже'})

    cur.execute("UPDATE email_login_codes SET used = TRUE WHERE email = '%s' AND used = FALSE" % safe_email)
    cur.execute("""
        INSERT INTO email_login_codes (email, code_hash, expires_at)
        VALUES ('%s', '%s', NOW() + INTERVAL '10 minutes')
    """ % (safe_email, hash_password(email + ':' + code)))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Код отправлен на %s' % email})


def email_verify_code(body):
    """Проверяет одноразовый код и выполняет вход"""
    email = (body.get('email') or '').strip().lower()
    code = ''.join(ch for ch in str(body.get('code') or '') if ch.isdigit())
    if not email or len(code) != 6:
        return json_response(400, {'error': 'Введите 6-значный код из письма'})

    conn = get_db()
    cur = conn.cursor()
    safe_email = email.replace("'", "''")
    cur.execute("""
        SELECT id, code_hash, attempts FROM email_login_codes
        WHERE email = '%s' AND used = FALSE AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1
    """ % safe_email)
    rec = cur.fetchone()
    if not rec:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Код истёк или не запрашивался. Запросите новый'})
    if rec[2] >= 5:
        cur.execute("UPDATE email_login_codes SET used = TRUE WHERE id = %d" % rec[0])
        conn.commit()
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Слишком много попыток. Запросите новый код'})
    if rec[1] != hash_password(email + ':' + code):
        cur.execute("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = %d" % rec[0])
        conn.commit()
        cur.close()
        conn.close()
        return json_response(401, {'error': 'Неверный код'})

    cur.execute("UPDATE email_login_codes SET used = TRUE WHERE id = %d" % rec[0])
    cur.execute("""
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active, organization, organization_type, login_email
        FROM users WHERE LOWER(email) = '%s'
    """ % safe_email)
    row = cur.fetchone()
    if not row or not row[8]:
        conn.commit()
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Учётная запись недоступна'})

    role = row[7]
    token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(days=7)
    cur.execute("INSERT INTO sessions (user_id, token, expires_at) VALUES (%d, '%s', '%s')" % (row[0], token, expires.isoformat()))
    if role == 'admin':
        allowed = ALL_PAGES[:]
    else:
        allowed = load_permissions(cur).get(role, DEFAULT_PERMISSIONS.get(role, ['dashboard', 'profile']))
    conn.commit()
    role_label = role_label_map(cur).get(role, role)
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role, 'role_label': role_label,
            'organization': row[9] or '', 'organization_type': row[10] or ''
        },
        'allowed_pages': allowed
    })


FACE_MATCH_THRESHOLD = 0.45
FACE_MARGIN = 0.05


def parse_descriptor(raw):
    if not isinstance(raw, list) or len(raw) != 128:
        return None
    try:
        vals = [float(v) for v in raw]
    except (TypeError, ValueError):
        return None
    if any(v != v or abs(v) > 10 for v in vals):
        return None
    return vals


def average_descriptors(items):
    vecs = [d for d in (parse_descriptor(x) for x in items) if d]
    if not vecs:
        return None
    return [round(sum(v[i] for v in vecs) / len(vecs), 6) for i in range(128)]


def face_distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def face_save(event, body):
    """Сохраняет фото и отпечаток лица текущего пользователя"""
    me = get_current_user(event)
    if not me:
        return json_response(401, {'error': 'Требуется авторизация'})
    is_admin = me['role'] == 'admin'
    target_id = me['id']
    if body.get('user_id') and int(body.get('user_id')) != me['id']:
        if not is_admin:
            return json_response(403, {'error': 'Изменять фото других сотрудников может только администратор'})
        target_id = int(body.get('user_id'))
    raw = body.get('descriptors') or ([body.get('descriptor')] if body.get('descriptor') else [])
    desc = average_descriptors(raw if isinstance(raw, list) else [])
    if not desc:
        return json_response(400, {'error': 'Лицо не распознано. Сделайте фото ещё раз'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT face_descriptor IS NOT NULL, face_self_enrolled FROM users WHERE id = %d" % target_id)
    trow = cur.fetchone()
    if not trow:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Сотрудник не найден'})
    if not is_admin and (trow[0] or trow[1]):
        cur.close()
        conn.close()
        return json_response(403, {'error': 'Фото уже добавлено. Изменить или удалить его может только администратор'})
    cur.execute("SELECT id, full_name, face_descriptor FROM users WHERE face_descriptor IS NOT NULL AND is_active = TRUE AND id <> %d" % target_id)
    for uid, name, other in cur.fetchall():
        o = other if isinstance(other, list) else json.loads(other)
        if face_distance(desc, o) < 0.35:
            cur.close()
            conn.close()
            return json_response(409, {'error': 'Это лицо уже привязано к другому пользователю'})

    photo_url = ''
    photo = body.get('photo') or ''
    if photo:
        import boto3
        if ',' in photo:
            photo = photo.split(',', 1)[1]
        data = base64.b64decode(photo)
        if len(data) > 3 * 1024 * 1024:
            cur.close()
            conn.close()
            return json_response(400, {'error': 'Фото слишком большое'})
        key = 'faces/user_%d_%s.jpg' % (target_id, secrets.token_hex(6))
        s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                          aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
        s3.put_object(Bucket='files', Key=key, Body=data, ContentType='image/jpeg')
        photo_url = 'https://cdn.poehali.dev/projects/%s/bucket/%s' % (os.environ['AWS_ACCESS_KEY_ID'], key)

    desc_json = json.dumps(desc)
    self_flag = ", face_self_enrolled = TRUE" if target_id == me['id'] else ""
    cur.execute("UPDATE users SET face_descriptor = '%s'::jsonb, face_photo_url = '%s', face_updated_at = NOW()%s WHERE id = %d"
                % (desc_json, photo_url.replace("'", "''"), self_flag, target_id))
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Лицо сохранено. Теперь можно входить по лицу', 'face_photo_url': photo_url})


def face_delete(event, body):
    """Удаляет фото лица сотрудника (только администратор)"""
    me = get_current_user(event)
    if not me:
        return json_response(401, {'error': 'Требуется авторизация'})
    if me['role'] != 'admin':
        return json_response(403, {'error': 'Удалить фото может только администратор'})
    target_id = int(body.get('user_id') or me['id'])
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE users SET face_descriptor = NULL, face_photo_url = NULL, face_updated_at = NOW() WHERE id = %d" % target_id)
    conn.commit()
    cur.close()
    conn.close()
    return json_response(200, {'message': 'Вход по лицу отключён'})


def face_login(body):
    """Вход в систему по отпечатку лица с камеры"""
    desc = parse_descriptor(body.get('descriptor'))
    if not desc:
        return json_response(400, {'error': 'Лицо не распознано'})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, face_descriptor FROM users WHERE face_descriptor IS NOT NULL AND is_active = TRUE")
    scored = []
    for uid, d in cur.fetchall():
        v = d if isinstance(d, list) else json.loads(d)
        scored.append((face_distance(desc, v), uid))
    scored.sort()
    if not scored or scored[0][0] > FACE_MATCH_THRESHOLD or (len(scored) > 1 and scored[1][0] - scored[0][0] < FACE_MARGIN):
        cur.close()
        conn.close()
        return json_response(401, {'error': 'Лицо не опознано', 'not_found': True})

    user_id = scored[0][1]
    cur.execute("""
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active, organization, organization_type, face_photo_url
        FROM users WHERE id = %d
    """ % user_id)
    row = cur.fetchone()
    role = row[7]
    token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(days=7)
    cur.execute("INSERT INTO sessions (user_id, token, expires_at) VALUES (%d, '%s', '%s')" % (row[0], token, expires.isoformat()))
    if role == 'admin':
        allowed = ALL_PAGES[:]
    else:
        allowed = load_permissions(cur).get(role, DEFAULT_PERMISSIONS.get(role, ['dashboard', 'profile']))
    conn.commit()
    role_label = role_label_map(cur).get(role, role)
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'distance': round(scored[0][0], 3),
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role, 'role_label': role_label,
            'organization': row[9] or '', 'organization_type': row[10] or '',
            'has_face': True, 'face_photo_url': row[11] or ''
        },
        'allowed_pages': allowed
    })

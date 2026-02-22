import json
import os
import hashlib
import secrets
import psycopg2
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
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': json.dumps(body, ensure_ascii=False, default=serialize_default)
    }

ALL_PAGES = ['dashboard', 'personnel', 'dispatcher', 'medical', 'lampa', 'scanner', 'aho', 'reports', 'profile', 'admin']

VALID_ROLES = ['admin', 'operator', 'dispatcher', 'doctor', 'aho_specialist', 'security']

DEFAULT_PERMISSIONS = {
    'admin': ALL_PAGES[:],
    'operator': ['dashboard', 'profile'],
    'dispatcher': ['dashboard', 'profile'],
    'doctor': ['dashboard', 'profile'],
    'aho_specialist': ['dashboard', 'profile'],
    'security': ['dashboard', 'profile'],
}


def get_auth_token(event):
    headers = event.get('headers') or {}
    for key in ['X-Authorization', 'x-authorization', 'Authorization', 'authorization']:
        val = headers.get(key, '')
        if val:
            return val.replace('Bearer ', '') if val.startswith('Bearer ') else val
    return ''


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
    elif method == 'POST' and action == 'login-code':
        return login_by_code(body)
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
    elif method == 'POST' and action == 'create-user':
        return create_user(event, body)
    elif method == 'DELETE' and action == 'delete-user':
        return delete_user(event, body)
    elif method == 'PUT' and action == 'update-user':
        return update_user(event, body)

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
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active, organization, organization_type
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
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role,
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
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active, organization, organization_type
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
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role,
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
        SELECT u.id, u.email, u.full_name, u.position, u.department, u.personal_code, u.qr_code, u.role, u.organization, u.organization_type
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

    cur.close()
    conn.close()

    return json_response(200, {
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': role,
            'organization': row[8] or '', 'organization_type': row[9] or ''
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
               created_at
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
            'created_at': r[10]
        })

    return json_response(200, {'users': users})


def update_role(event, body):
    caller = get_current_user(event)
    if not caller or caller['role'] != 'admin':
        return json_response(403, {'error': 'Доступ только для администраторов'})

    user_id = body.get('user_id')
    new_role = body.get('role', '').strip()

    if not user_id or new_role not in VALID_ROLES:
        return json_response(400, {'error': 'Укажите user_id и роль (%s)' % ', '.join(VALID_ROLES)})

    if int(user_id) == caller['id']:
        return json_response(400, {'error': 'Нельзя менять роль самому себе'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, role FROM users WHERE id = %d" % int(user_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Пользователь не найден'})

    old_role = row[1]
    cur.execute("UPDATE users SET role = '%s' WHERE id = %d" % (new_role, int(user_id)))
    conn.commit()
    cur.close()
    conn.close()

    role_labels = {
        'admin': 'Администратор', 'operator': 'Оператор',
        'dispatcher': 'Диспетчер', 'doctor': 'Врач',
        'aho_specialist': 'Специалист АХО', 'security': 'СБ'
    }

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
    cur.close()
    conn.close()

    return json_response(200, {'permissions': perms, 'all_pages': ALL_PAGES})


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

    if not full_name or not email or not password:
        return json_response(400, {'error': 'ФИО, email и пароль обязательны'})

    if role not in VALID_ROLES:
        return json_response(400, {'error': 'Недопустимая роль'})

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
        VALUES ('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
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
        organization_type.replace("'", "''")
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
            'organization': organization, 'organization_type': organization_type
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

    cur.execute("SELECT id, full_name FROM users WHERE id = %d" % int(user_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Пользователь не найден'})

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

    cur.execute("SELECT id FROM users WHERE id = %d" % int(user_id))
    if not cur.fetchone():
        cur.close()
        conn.close()
        return json_response(404, {'error': 'Пользователь не найден'})

    updates = []
    for field in ['full_name', 'email', 'position', 'department', 'role', 'organization', 'organization_type']:
        if field in body and body[field] is not None:
            val = str(body[field]).strip()
            if field == 'role' and val not in VALID_ROLES:
                cur.close()
                conn.close()
                return json_response(400, {'error': 'Недопустимая роль'})
            if field == 'email':
                val = val.lower()
            updates.append("%s = '%s'" % (field, val.replace("'", "''")))

    if 'password' in body and body['password']:
        updates.append("password_hash = '%s'" % hash_password(body['password']))

    if 'is_active' in body:
        updates.append("is_active = %s" % ('TRUE' if body['is_active'] else 'FALSE'))

    if not updates:
        cur.close()
        conn.close()
        return json_response(400, {'error': 'Нечего обновлять'})

    cur.execute("UPDATE users SET %s WHERE id = %d" % (', '.join(updates), int(user_id)))
    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {'message': 'Данные пользователя обновлены'})
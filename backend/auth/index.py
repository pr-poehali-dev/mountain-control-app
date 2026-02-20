import json
import os
import hashlib
import secrets
import psycopg2
from datetime import datetime, timedelta

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def json_response(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
        },
        'body': json.dumps(body, ensure_ascii=False, default=str)
    }

def handler(event, context):
    """Авторизация и регистрация пользователей системы Горный контроль"""
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

    return json_response(404, {'error': 'Маршрут не найден'})

def register(body):
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')
    full_name = body.get('full_name', '').strip()
    position = body.get('position', '').strip()
    department = body.get('department', '').strip()

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
        INSERT INTO users (email, password_hash, full_name, position, department, personal_code, qr_code, role)
        VALUES ('%s', '%s', '%s', '%s', '%s', '%s', '%s', 'operator')
        RETURNING id, personal_code, qr_code
    """ % (
        email.replace("'", "''"),
        password_hash,
        full_name.replace("'", "''"),
        position.replace("'", "''"),
        department.replace("'", "''"),
        personal_code,
        qr_code
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
            'personal_code': personal_code,
            'qr_code': qr_code,
            'role': 'operator'
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
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active
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

    token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(days=7)
    cur.execute("""
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (%d, '%s', '%s')
    """ % (row[0], token, expires.isoformat()))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': row[7]
        }
    })

def login_by_code(body):
    code = body.get('code', '').strip().upper()

    if not code:
        return json_response(400, {'error': 'Введите личный код'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, email, full_name, position, department, personal_code, qr_code, role, is_active
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

    token = secrets.token_hex(32)
    expires = datetime.now() + timedelta(days=7)
    cur.execute("""
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (%d, '%s', '%s')
    """ % (row[0], token, expires.isoformat()))

    conn.commit()
    cur.close()
    conn.close()

    return json_response(200, {
        'token': token,
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': row[7]
        }
    })

def get_me(event):
    headers = event.get('headers') or {}
    auth = headers.get('X-Authorization', headers.get('x-authorization', ''))
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth

    if not token:
        return json_response(401, {'error': 'Требуется авторизация'})

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT u.id, u.email, u.full_name, u.position, u.department, u.personal_code, u.qr_code, u.role
        FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = '%s' AND s.expires_at > NOW() AND u.is_active = TRUE
    """ % token.replace("'", "''"))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return json_response(401, {'error': 'Сессия истекла'})

    return json_response(200, {
        'user': {
            'id': row[0], 'email': row[1], 'full_name': row[2],
            'position': row[3], 'department': row[4],
            'personal_code': row[5], 'qr_code': row[6], 'role': row[7]
        }
    })

def logout(event):
    headers = event.get('headers', {})
    auth = headers.get('X-Authorization', headers.get('x-authorization', ''))
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth

    if token:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE token = '%s'" % token.replace("'", "''"))
        conn.commit()
        cur.close()
        conn.close()

    return json_response(200, {'message': 'Выход выполнен'})
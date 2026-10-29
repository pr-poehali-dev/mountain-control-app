import random
from datetime import timedelta

UNDERGROUND = ('Участок', 'Энергоучасток', 'Подрядные работы')
DOCTORS = ['Смирнова Е.В.', 'Кравченко И.П.']
GUARDS = ['Васильев А.К.', 'Ермолаев С.Н.']
LAMP_STAFF = 'Белова Т.А.'
FAIL_NOTES = ['Повышенное АД 165/100', 'Остаточный запах алкоголя', 'Температура 37,9']
DENY_REASONS = ['Не пройден медосмотр', 'Истёк срок пропуска']


def q(s):
    return str(s or '').replace("'", "''")


def ts(dt):
    return "'%s'" % dt.strftime('%Y-%m-%d %H:%M:%S')


def refresh_demo(conn, force=False):
    """Обновляет демо-активность «на сегодня»: проходы КПП, медосмотры, выдачу фонарей, заезды и расселение"""
    cur = conn.cursor()
    cur.execute("""SELECT NOW()::timestamp, date_trunc('day', NOW())::timestamp, (NOW() AT TIME ZONE 'Asia/Yakutsk')::timestamp,
                   (SELECT MAX(created_at) FROM aho_batches WHERE is_demo_data = TRUE)""")
    now, day_start, local_now, last = cur.fetchone()
    if not force and last and last >= now - timedelta(minutes=50):
        cur.close()
        return False

    rnd = random.Random(now.strftime('%Y%m%d%H'))
    window = max(min((now - day_start).total_seconds() - 300, 11 * 3600), 1800)

    def ago(lo=0.05, hi=1.0):
        return now - timedelta(seconds=int(window * rnd.uniform(lo, hi)))

    local_now = now
    lh = local_now.hour
    shift_type = 'day' if 5 <= lh < 17 else 'night'
    shift_date = (local_now - timedelta(days=1)).date() if lh < 5 else local_now.date()

    cur.execute("""SELECT id, personal_code, full_name, department, category, organization_type, status,
                          residence_room_id, vehicle_number, vehicle_brand, organization, position
                   FROM personnel WHERE is_demo_data = TRUE AND status <> 'archived' ORDER BY id""")
    people = [dict(zip(('id', 'code', 'name', 'dep', 'cat', 'ot', 'st', 'room', 'plate', 'brand', 'org', 'pos'), r))
              for r in cur.fetchall()]
    if not people:
        cur.close()
        return False
    ids = ','.join(str(p['id']) for p in people)

    for sql in (
        "DELETE FROM housing_conflicts WHERE owner_id IN (%s) OR temp_id IN (%s)" % (ids, ids),
        "DELETE FROM checkpoint_passes WHERE is_demo_data = TRUE OR personnel_id IN (%s)" % ids,
        "DELETE FROM vehicle_passes WHERE personnel_id IN (%s)" % ids,
        "DELETE FROM medical_checks WHERE is_demo_data = TRUE OR personnel_id IN (%s)" % ids,
        "DELETE FROM lamp_room_issues WHERE is_demo_data = TRUE OR person_id IN (%s)" % ids,
        "DELETE FROM lamp_room_denials WHERE is_demo_data = TRUE OR person_id IN (%s)" % ids,
        "DELETE FROM security_checks WHERE is_demo_data = TRUE OR personnel_id IN (%s)" % ids,
        "DELETE FROM events WHERE is_demo_data = TRUE OR personnel_id IN (%s)" % ids,
        "DELETE FROM housing_history WHERE personnel_id IN (%s)" % ids,
        "DELETE FROM aho_arrivals WHERE is_demo_data = TRUE OR personnel_id IN (%s)" % ids,
        "DELETE FROM aho_batches WHERE is_demo_data = TRUE",
        "DELETE FROM dispatcher_messages WHERE is_demo_data = TRUE",
        "DELETE FROM notifications WHERE is_demo_data = TRUE",
        "UPDATE lanterns SET status = 'available', assigned_to = NULL, issued_at = NULL, returned_at = NULL WHERE is_demo_data = TRUE",
    ):
        cur.execute(sql)

    passes, events, checks, vehicles = [], [], [], []

    def add_pass(p, direction, at, point=1, deny=''):
        notes = ('ОТКАЗ: ' + deny) if deny else ''
        name = 'КПП-1' if point == 1 else 'ОФ'
        passes.append("(%d, '%s', '%s', '%s', '%s', %s, '%s', %s, TRUE, %d)" % (
            p['id'], q(p['code']), q(p['name']), direction, name, 'FALSE' if deny else 'TRUE', q(notes), ts(at), point))
        etype = 'checkpoint_denied' if deny else ('checkpoint_in' if direction == 'in' else 'checkpoint_out')
        label = ('отказ в проходе: ' + deny) if deny else ('проход через КПП (%s)' % ('вход' if direction == 'in' else 'выход'))
        events.append("('%s', '%s', %d, %s, TRUE)" % (etype, q('%s — %s' % (p['name'], label)), p['id'], ts(at)))

    on_site = [p for p in people if p['st'] in ('on_shift', 'arrived')]
    departed = [p for p in people if p['st'] == 'departed']
    workers = [p for p in on_site if p['cat'] in ('mine', 'contractor')]

    entry = {}
    for p in on_site:
        if rnd.random() < 0.35:
            t0 = now - timedelta(hours=rnd.randint(30, 120))
        else:
            t0 = ago(0.25, 1.0)
        if rnd.random() < 0.18 and t0 < now - timedelta(hours=2):
            out_at = ago(0.15, 0.6)
            add_pass(p, 'in', t0)
            add_pass(p, 'out', out_at)
            t0 = out_at + timedelta(minutes=rnd.randint(20, 90))
            if t0 > now:
                t0 = now - timedelta(minutes=5)
        add_pass(p, 'in', t0)
        entry[p['id']] = t0
        if p['plate'] and rnd.random() < 0.8:
            vehicles.append("(%d, '%s', '%s', '%s', 'in', 'КПП-1', TRUE, '', %s, 1)" % (
                p['id'], q(p['plate']), q(p['brand']), q(p['name']), ts(t0 - timedelta(minutes=1))))
    for p in departed:
        t_in = now - timedelta(days=rnd.randint(8, 20))
        add_pass(p, 'in', t_in)
        add_pass(p, 'out', ago(0.1, 0.9))

    for p in [x for x in workers if x['st'] == 'on_shift' and x['dep'] == 'Обогатительная фабрика' or (x['cat'] == 'mine' and x['dep'] in ('Механический цех',))]:
        add_pass(p, 'in', entry[p['id']] + timedelta(minutes=rnd.randint(15, 40)), point=2)

    denied = [p for p in workers][:: max(len(workers) // 3, 1)][:3]
    for i, p in enumerate(denied[:2]):
        add_pass(p, 'in', entry[p['id']] - timedelta(minutes=rnd.randint(10, 40)), deny=DENY_REASONS[i % 2])

    med_status = {}
    fail_ids = {p['id'] for p in workers[3::11][:2]}
    pending_ids = {p['id'] for p in workers[5::6][:5]} - fail_ids
    for p in workers:
        if p['id'] in pending_ids:
            med_status[p['id']] = 'pending'
            continue
        failed = p['id'] in fail_ids
        at = min(entry[p['id']] + timedelta(minutes=rnd.randint(8, 35)), now - timedelta(minutes=3))
        if at < day_start:
            at = ago(0.3, 0.95)
        bp = '%d/%d' % ((rnd.randint(158, 170), rnd.randint(98, 104)) if failed else (rnd.randint(112, 136), rnd.randint(70, 86)))
        pulse = rnd.randint(88, 98) if failed else rnd.randint(62, 84)
        temp = '36.%d' % rnd.randint(4, 8)
        note = FAIL_NOTES[len(checks) % len(FAIL_NOTES)] if failed else 'Допущен'
        checks.append("(%d, 'pre_shift', '%s', '%s', %d, 0.00, %s, '%s', '%s', %s, '%s', 'to_shift', '%s', TRUE)" % (
            p['id'], 'failed' if failed else 'passed', bp, pulse, temp, DOCTORS[len(checks) % 2], q(note), ts(at), shift_type, shift_date))
        med_status[p['id']] = 'failed' if failed else 'passed'
        events.append("('%s', '%s', %d, %s, TRUE)" % (
            'medical_fail' if failed else 'medical_pass',
            q('%s — медосмотр %s' % (p['name'], 'не пройден' if failed else 'пройден')), p['id'], ts(at)))
    cur.execute("UPDATE personnel SET medical_status = CASE id %s ELSE 'pending' END WHERE id IN (%s)" % (
        ' '.join("WHEN %d THEN '%s'" % (k, v) for k, v in med_status.items()) or 'WHEN 0 THEN NULL', ids))

    under = [p for p in workers if p['st'] == 'on_shift' and med_status.get(p['id']) == 'passed'
             and any(p['dep'].startswith(u) for u in UNDERGROUND)]
    cur.execute("SELECT id, lantern_number, rescuer_number FROM lanterns WHERE is_demo_data = TRUE ORDER BY lantern_number")
    lamps = cur.fetchall()
    issues = []
    for i, p in enumerate(under[:len(lamps)]):
        lid, ln, rn = lamps[i]
        at = min(entry[p['id']] + timedelta(minutes=rnd.randint(35, 60)), now - timedelta(minutes=2))
        cur.execute("UPDATE lanterns SET status = 'issued', assigned_to = %d, issued_at = %s WHERE id = %d" % (p['id'], ts(at), lid))
        issues.append("(%d, '%s', '%s', 'both', '%s', '%s', 'issued', %s, NULL, 'normal', '', '%s', '', TRUE)" % (
            p['id'], q(p['code']), q(p['name']), ln, rn, ts(at), LAMP_STAFF))
    for j, p in enumerate(departed[:4]):
        lid, ln, rn = lamps[-(j + 1)]
        out = ago(0.1, 0.9)
        issues.append("(%d, '%s', '%s', 'both', '%s', '%s', 'returned', %s, %s, '%s', '', '%s', '', TRUE)" % (
            p['id'], q(p['code']), q(p['name']), ln, rn, ts(out - timedelta(hours=11)), ts(out), 'damaged' if j == 0 else 'normal', LAMP_STAFF))
    if issues:
        cur.execute("""INSERT INTO lamp_room_issues (person_id, person_code, person_name, item_type, lantern_number, rescuer_number,
                       status, issued_at, returned_at, condition, notes, issued_by, tabular_number, is_demo_data) VALUES %s""" % ','.join(issues))
    fp = [p for p in workers if med_status.get(p['id']) == 'failed'][:1]
    for p in fp:
        cur.execute("""INSERT INTO lamp_room_denials (person_id, person_code, person_name, reason, denied_at, denied_by, tabular_number, is_demo_data)
                       VALUES (%d, '%s', '%s', 'Не допущен медиком', %s, '%s', '', TRUE)""" % (p['id'], q(p['code']), q(p['name']), ts(now - timedelta(minutes=50)), LAMP_STAFF))

    if passes:
        cur.execute("""INSERT INTO checkpoint_passes (personnel_id, personal_code, full_name, direction, checkpoint_name, medical_ok, notes,
                       created_at, is_demo_data, control_point_id) VALUES %s""" % ','.join(passes))
    if vehicles:
        cur.execute("""INSERT INTO vehicle_passes (personnel_id, vehicle_number, vehicle_brand, owner_name, direction, checkpoint_name,
                       allowed, notes, created_at, control_point_id) VALUES %s""" % ','.join(vehicles))
    if checks:
        cur.execute("""INSERT INTO medical_checks (personnel_id, check_type, status, blood_pressure, pulse, alcohol_level, temperature,
                       doctor_name, notes, checked_at, shift_type, check_direction, shift_date, is_demo_data) VALUES %s""" % ','.join(checks))

    sec = []
    for i, p in enumerate(on_site[:14]):
        sec.append("(%d, '%s', '%s', 'document', '%s', '%s', '%s', %s, TRUE)" % (
            p['id'], q(p['code']), q(p['name']), 'valid' if i % 7 else 'expired',
            'Пропуск проверен' if i % 7 else 'Срок пропуска истекает', GUARDS[i % 2], ts(entry[p['id']] - timedelta(minutes=2))))
    cur.execute("""INSERT INTO security_checks (personnel_id, personal_code, full_name, check_type, result, notes, checked_by, created_at, is_demo_data)
                   VALUES %s""" % ','.join(sec))

    cur.execute("SELECT r.id, r.room_number, b.name, b.id FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE r.is_demo_data = TRUE")
    room_info = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}
    batch = 'DEMO-%s' % now.strftime('%Y%m%d')
    arrivals = []
    hh = []
    for p in people:
        if p['st'] == 'expected':
            arr_date, status, cin, cout = "CURRENT_DATE + %d" % (0 if p['id'] % 2 else 1), 'expected', 'NULL', 'NULL'
        elif p['st'] == 'departed':
            arr_date, status = "CURRENT_DATE - 21", 'departed'
            cin, cout = ts(now - timedelta(days=21)), ts(ago(0.1, 0.9))
        else:
            arr_date, status, cin, cout = "CURRENT_DATE - %d" % (0 if entry[p['id']] >= day_start else 3), 'arrived', ts(entry[p['id']]), 'NULL'
        rb = room_info.get(p['room'])
        arrivals.append("('%s', %d, '%s', '%s', '%s', '%s', '%s', %s, CURRENT_DATE + 28, '%s', %s, %s, '%s', '%s', '%s', '%s', TRUE)" % (
            batch, p['id'], q(p['name']), q(p['pos']), q(p['dep']), q(p['org']), p['ot'] if p['ot'] != 'rudnik' else 'mine',
            arr_date, status, cin, cout, q(rb[0] if rb else ''), q(rb[1] if rb else ''), med_status.get(p['id'], 'pending'), q(p['code'])))
        if p['room'] and rb:
            at = ts(entry.get(p['id'], now - timedelta(days=20)) + timedelta(minutes=30))
            hh.append("(%d, 'checkin', %d, %d, '%s', '%s', '', '', 'АХО', %s)" % (
                p['id'], rb[2], p['room'], q(rb[1]), q(rb[0]), at))
            events.append("('housing', '%s', %d, %s, TRUE)" % (q('%s — заселён: %s, комн. %s' % (p['name'], rb[1], rb[0])), p['id'], at))
        if p['st'] in ('arrived', 'on_shift') and entry.get(p['id'], now) >= day_start:
            events.append("('arrival', '%s', %d, %s, TRUE)" % (q('%s — прибыл на объект' % p['name']), p['id'], ts(entry[p['id']])))
    total = len(arrivals)
    cur.execute("""INSERT INTO aho_batches (batch_id, file_name, total_count, arrived_count, departed_count, arrival_date, departure_date, is_demo_data)
                   VALUES ('%s', 'Заезд_вахта_%s.xlsx', %d, %d, %d, CURRENT_DATE - 3, CURRENT_DATE + 28, TRUE)""" % (
        batch, now.strftime('%d.%m'), total, len(on_site), len(departed)))
    cur.execute("""INSERT INTO aho_arrivals (batch_id, personnel_id, full_name, position, department, organization, organization_type, arrival_date,
                   departure_date, arrival_status, check_in_at, check_out_at, room, building, medical_status, personal_code, is_demo_data)
                   VALUES %s""" % ','.join(arrivals))
    if hh:
        cur.execute("""INSERT INTO housing_history (personnel_id, action, building_id, room_id, building_name, room_number,
                       prev_building_name, prev_room_number, source, created_at) VALUES %s""" % ','.join(hh))
    cur.execute("""INSERT INTO events (event_type, description, personnel_id, created_at, is_demo_data) VALUES %s""" % ','.join(events))

    msgs = [
        ('Начальник смены', 'Смена принята, работы по наряду, в забоях %d чел.' % len(under), False, 0.9),
        ('Ламповщик', 'Выдано %d комплектов фонарь + самоспасатель' % len(under), False, 0.7),
        ('Врач', 'Предсменный осмотр: допущено %d, не допущено %d' % (sum(1 for v in med_status.values() if v == 'passed'), len(fail_ids)), False, 0.6),
        ('Горный диспетчер', 'Участок №2: остановка ПДМ на 40 минут, замена шланга', True, 0.4),
        ('Комендант', 'Общежитие №2: свободно мест — уточните по заезду подрядчиков', False, 0.2),
    ]
    cur.execute("""INSERT INTO dispatcher_messages (sender_name, sender_role, message, is_urgent, created_at, is_demo_data) VALUES %s""" % ','.join(
        "('%s', '%s', '%s', %s, %s, TRUE)" % (q(['Орлов Д.П.', 'Белова Т.А.', 'Смирнова Е.В.', 'Ильин В.Ю.', 'Петрова О.С.'][i]), q(r), q(m),
                                               'TRUE' if u else 'FALSE', ts(now - timedelta(seconds=int(window * f))))
        for i, (r, m, u, f) in enumerate(msgs)))

    cur.execute("""UPDATE rooms r SET occupied = s.cnt,
                   status = CASE WHEN s.cnt = 0 THEN 'free' WHEN s.cnt >= r.capacity THEN 'full' ELSE 'partial' END
                   FROM (SELECT r2.id, COUNT(p.id) AS cnt FROM rooms r2 LEFT JOIN personnel p ON p.residence_room_id = r2.id
                         AND p.status IN ('arrived', 'on_shift') AND COALESCE(p.is_hidden, FALSE) = FALSE
                         WHERE r2.is_demo_data = TRUE GROUP BY r2.id) s WHERE s.id = r.id""")

    conn.commit()
    cur.close()
    return True

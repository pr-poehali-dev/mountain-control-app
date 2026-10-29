from datetime import date, timedelta

EXC_LABELS = {
    'vacation': 'Отпуск', 'sick': 'Больничный', 'training': 'Обучение', 'business_trip': 'Командировка',
    'dismissal': 'Увольнение', 'other': 'Другое',
}


def crew_templates(scheme, on_days, off_days):
    """Шаблоны вахт: полная смена (2 вахты) или со сдвигом (4 вахты, меняется половина состава)"""
    if scheme == 'staggered':
        half = max(on_days // 2, 1)
        return [('А-1', 0), ('Б-1', on_days), ('А-2', half), ('Б-2', on_days + half)]
    return [('А', 0), ('Б', on_days)]


def cycle_of(dep):
    return max(dep['on_days'] + dep['off_days'], 1)


def phase(dep, crew, d):
    """Позиция дня в цикле вахты (0..cycle-1)"""
    start = dep['anchor_date'] + timedelta(days=crew['offset_days'])
    return (d - start).days % cycle_of(dep)


def is_on(dep, crew, d):
    return phase(dep, crew, d) < dep['on_days']


def period_start(dep, crew, d):
    """Начало вахтового периода (на работе), в который попадает день d, либо ближайшего следующего"""
    p = phase(dep, crew, d)
    if p < dep['on_days']:
        return d - timedelta(days=p)
    return d + timedelta(days=cycle_of(dep) - p)


def next_change(dep, crew, d):
    """Ближайшая смена статуса вахты после дня d: (дата, 'in'|'out')"""
    p = phase(dep, crew, d)
    if p < dep['on_days']:
        return d + timedelta(days=dep['on_days'] - p), 'out'
    return d + timedelta(days=cycle_of(dep) - p), 'in'


def periods(dep, crew, d_from, d_to):
    """Периоды работы вахты, пересекающие интервал"""
    out = []
    start = period_start(dep, crew, d_from - timedelta(days=dep['on_days']))
    while start <= d_to:
        end = start + timedelta(days=dep['on_days'] - 1)
        if end >= d_from:
            out.append((start, end))
        start += timedelta(days=cycle_of(dep))
    return out


def changes(dep, crews, d_from, d_to):
    """Даты перевахтовок подразделения: какая вахта заезжает, какая уезжает"""
    by_date = {}
    for c in crews:
        for start, end in periods(dep, c, d_from - timedelta(days=cycle_of(dep)), d_to + timedelta(days=cycle_of(dep))):
            if d_from <= start <= d_to:
                by_date.setdefault(start, {'in': [], 'out': []})['in'].append(c['id'])
            leave = end + timedelta(days=1)
            if d_from <= leave <= d_to:
                by_date.setdefault(leave, {'in': [], 'out': []})['out'].append(c['id'])
    return sorted(by_date.items())


def exception_on(excs, d):
    for e in excs:
        if e['kind'] == 'dismissal' and d >= e['date_from']:
            return e
        if e['date_from'] <= d <= e['date_to']:
            return e
    return None


def overlaps(excs, a, b):
    res = []
    for e in excs:
        end = date.max if e['kind'] == 'dismissal' else e['date_to']
        if e['date_from'] <= b and end >= a:
            res.append(e)
    return res


def balance(members_by_crew, candidates, crew_ids):
    """Раскладывает новых людей по вахтам так, чтобы по каждой должности составы были равными"""
    counts = {cid: {} for cid in crew_ids}
    for cid, people in members_by_crew.items():
        for p in people:
            counts.setdefault(cid, {})
            counts[cid][p['position']] = counts[cid].get(p['position'], 0) + 1
    totals = {cid: sum(v.values()) for cid, v in counts.items()}
    result = []
    for p in sorted(candidates, key=lambda x: (x['position'], x['full_name'])):
        pos = p['position']
        cid = min(crew_ids, key=lambda c: (counts[c].get(pos, 0), totals.get(c, 0), crew_ids.index(c)))
        counts[cid][pos] = counts[cid].get(pos, 0) + 1
        totals[cid] = totals.get(cid, 0) + 1
        result.append((p['id'], cid))
    return result


def merge_days(days):
    """Склеивает подряд идущие дни в интервалы"""
    out = []
    for d in sorted(days):
        if out and (d - out[-1][1]).days == 1:
            out[-1][1] = d
        else:
            out.append([d, d])
    return out

import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { colorOf, daysLabel, fmtDate, fmtShort, plural, type Overview } from "./types";

interface Props {
  data: Overview;
  onOpenDept: (id: number) => void;
  onAddDept: () => void;
  onOpenChange: (date: string, deptId: number) => void;
}

function Kpi({ icon, value, label, tone = "text-foreground" }: { icon: string; value: number | string; label: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
        <Icon name={icon} size={20} className={tone} />
      </div>
      <div>
        <p className={`text-2xl font-bold ${tone}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function RotationOverview({ data, onOpenDept, onAddDept, onOpenChange }: Props) {
  const { totals, departments, alerts, upcoming } = data;

  if (departments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon name="CalendarSync" size={28} className="text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">Начните с подразделений</p>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto mt-1">
            Добавьте участок ОГР, ОФ и другие подразделения. Для каждого задайте график (например, 60/60) и дату ближайшего заезда —
            система сама разобьёт людей на вахты, построит графики и напомнит о перевахтовках.
          </p>
        </div>
        <Button onClick={onAddDept} className="gap-2">
          <Icon name="Plus" size={16} />
          Добавить подразделение
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icon="Building" value={totals.departments} label="Подразделений" />
        <Kpi icon="Users" value={totals.people} label="В вахтах" />
        <Kpi icon="HardHat" value={totals.on_site} label="Сейчас на вахте" tone="text-mine-green" />
        <Kpi icon="CalendarClock" value={totals.changes_30} label="Перевахтовок за 30 дн." tone="text-mine-cyan" />
        <Kpi icon="UserX" value={totals.unassigned} label="Не распределены" tone={totals.unassigned ? "text-mine-amber" : "text-foreground"} />
        <Kpi icon="AlertTriangle" value={totals.gaps} label="Недоукомплект." tone={totals.gaps ? "text-mine-red" : "text-foreground"} />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-mine-red/30 bg-mine-red/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Icon name="BellRing" size={16} className="text-mine-red" />
            Требует внимания
          </p>
          <div className="grid md:grid-cols-2 gap-2">
            {alerts.slice(0, 10).map((a, i) => (
              <button
                key={i}
                onClick={() => (a.kind === "change" && a.date ? onOpenChange(a.date, a.department_id) : onOpenDept(a.department_id))}
                className="flex items-start gap-2 rounded-lg bg-card border border-border px-3 py-2 text-left text-sm hover:bg-secondary/60"
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${a.level === "red" ? "bg-mine-red animate-alarm-blink" : "bg-mine-amber"}`} />
                <span className="text-foreground">{a.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <div className="grid md:grid-cols-2 gap-4 content-start">
          {departments.map((d) => {
            const c = colorOf(d.color);
            return (
              <button
                key={d.id}
                onClick={() => onOpenDept(d.id)}
                className={`rounded-xl border bg-card p-4 text-left hover:shadow-lg transition-shadow ${c.border}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.on_days}/{d.off_days} · {d.scheme === "staggered" ? "со сдвигом половины" : "полная смена"}
                      {d.head_name && ` · ${d.head_name}`}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${c.bg} ${c.text}`}>{d.members_total} чел.</span>
                </div>
                <div className="mt-3 space-y-2">
                  {d.crews.map((cr) => {
                    const pct = Math.min(100, Math.round((cr.day_no / Math.max(cr.period_days, 1)) * 100));
                    return (
                      <div key={cr.id}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <span className={`w-2 h-2 rounded-full ${cr.on_site ? "bg-mine-green" : "bg-muted-foreground/40"}`} />
                            Вахта {cr.name} · {cr.members_count} чел.
                          </span>
                          <span className="text-muted-foreground">
                            {cr.on_site ? `на вахте, день ${cr.day_no}/${cr.period_days}` : `отдых, день ${cr.day_no}/${cr.period_days}`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary mt-1 overflow-hidden">
                          <div className={`h-full ${cr.on_site ? c.bar : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">
                    Перевахтовка: <span className="text-foreground font-medium">{fmtDate(d.next_change)}</span>
                    {d.days_to_change !== null && ` (${daysLabel(d.days_to_change)})`}
                  </span>
                  {d.unassigned > 0 && <span className="text-mine-amber">не распределены: {d.unassigned}</span>}
                  {d.gaps_count > 0 && <span className="text-mine-red font-medium">недоукомплектованность: {d.gaps_count}</span>}
                  {d.norms_count === 0 && <span className="text-muted-foreground">нормативы не заданы</span>}
                </div>
              </button>
            );
          })}
          <button
            onClick={onAddDept}
            className="rounded-xl border border-dashed border-border p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 min-h-[140px]"
          >
            <Icon name="Plus" size={16} />
            Добавить подразделение
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Icon name="CalendarClock" size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Ближайшие перевахтовки</p>
          </div>
          {upcoming.length === 0 ? (
            <p className="p-6 text-sm text-center text-muted-foreground">В ближайшие 30 дней перевахтовок нет</p>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map((u) => {
                const c = colorOf(u.color);
                const pct = u.total ? Math.round((u.done / u.total) * 100) : 0;
                return (
                  <button
                    key={`${u.date}-${u.department_id}`}
                    onClick={() => onOpenChange(u.date, u.department_id)}
                    className="w-full px-4 py-3 text-left hover:bg-secondary/50 flex gap-3"
                  >
                    <div className={`w-12 shrink-0 rounded-lg ${c.bg} ${c.text} flex flex-col items-center justify-center py-1`}>
                      <span className="text-lg font-bold leading-none">{u.date.slice(8, 10)}</span>
                      <span className="text-[10px]">{fmtShort(u.date).slice(3)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.department}</p>
                      <p className="text-xs text-muted-foreground">
                        заезд {u.in_count} · выезд {u.out_count} · {daysLabel(u.days_left)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-mine-green" style={{ width: `${pct}%` }} />
                        </div>
                        {u.issues > 0 && (
                          <span className="text-[10px] font-semibold text-mine-red">
                            {u.issues} {plural(u.issues, "проблема", "проблемы", "проблем")}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rotationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { colorOf, daysLabel, fmtDate, MOVE_STATUS, type Change, type MovePerson } from "./types";

interface Props {
  departments: { id: number; name: string }[];
  focus: { date: string; deptId: number } | null;
}

const IN_STATUSES = ["planned", "confirmed", "tickets", "arrived", "no_show", "cancelled"];
const OUT_STATUSES = ["planned", "confirmed", "tickets", "departed", "cancelled"];

function PersonRow({ p, side, onSet }: { p: MovePerson; side: "in" | "out"; onSet: (p: MovePerson, status: string, transport?: string) => void }) {
  const [transport, setTransport] = useState(p.transport);
  const st = MOVE_STATUS[p.status] || MOVE_STATUS.planned;
  return (
    <div className={`px-3 py-2 flex flex-wrap items-center gap-2 ${p.overdue ? "bg-mine-red/5" : ""}`}>
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm text-foreground flex items-center gap-1.5">
          {p.is_key && <Icon name="Star" size={12} className="text-mine-amber" />}
          {p.full_name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {p.position}
          {p.residence && ` · ${p.residence}`}
          {p.phone && ` · ${p.phone}`}
        </p>
        {(p.issues.length > 0 || p.exception || p.overdue) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {p.overdue && <span className="text-[10px] rounded bg-mine-red text-white px-1.5 py-0.5 animate-alarm-blink">Дата прошла — статус не отмечен</span>}
            {p.exception && <span className="text-[10px] rounded bg-mine-red/15 text-mine-red px-1.5 py-0.5">{p.exception}</span>}
            {p.issues.map((i) => (
              <span key={i.code + i.text} className="text-[10px] rounded border border-mine-amber/40 text-mine-amber px-1.5 py-0.5">{i.text}</span>
            ))}
          </div>
        )}
      </div>
      <Input
        value={transport}
        onChange={(e) => setTransport(e.target.value)}
        onBlur={() => transport !== p.transport && onSet(p, p.status, transport)}
        placeholder="Рейс / автобус"
        className="h-7 w-[140px] text-xs"
      />
      <Select value={p.status} onValueChange={(v) => onSet(p, v, transport)}>
        <SelectTrigger className={`h-7 w-[150px] text-xs border ${st.cls}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {(side === "in" ? IN_STATUSES : OUT_STATUSES).map((s) => (
            <SelectItem key={s} value={s}>{MOVE_STATUS[s].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function RotationChanges({ departments, focus }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState(focus ? String(focus.deptId) : "all");
  const [open, setOpen] = useState<string | null>(focus ? `${focus.date}-${focus.deptId}` : null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (dept !== "all") params.department_id = dept;
    rotationApi
      .changes(params)
      .then((d) => {
        setItems(d.items || []);
        setOpen((cur) => cur ?? (d.items?.find((x: Change) => x.days_left >= 0) ? `${d.items.find((x: Change) => x.days_left >= 0).date}-${d.items.find((x: Change) => x.days_left >= 0).department_id}` : null));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [dept]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => document.getElementById(`chg-${open}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    return () => clearTimeout(t);
  }, [open, items.length]);

  const setStatus = async (ch: Change, side: "in" | "out", people: MovePerson[], status: string, transport = "") => {
    try {
      await rotationApi.setMoves(people.map((p) => ({ worker_id: p.id, change_date: ch.date, direction: side, status, transport })));
      load();
    } catch (e) {
      toast({ title: "Не удалось сохранить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const printList = (ch: Change) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const rows = (side: "in" | "out") =>
      ch[side].flatMap((g) => g.people.map((p, i) => `<tr><td>${i + 1}</td><td>${g.crew}</td><td>${p.full_name}</td><td>${p.position}</td><td>${p.transport || ""}</td><td>${MOVE_STATUS[p.status]?.label || ""}</td><td>${p.issues.map((x) => x.text).join("; ")}</td></tr>`)).join("");
    w.document.write(`<html><head><title>Перевахтовка ${fmtDate(ch.date)}</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%;margin-bottom:24px}td,th{border:1px solid #999;padding:4px 6px;font-size:12px;text-align:left}h2{margin:16px 0 8px}.bar{margin-bottom:16px}@media print{.bar{display:none}}</style></head><body>
      <div class="bar"><button onclick="window.print()" style="padding:8px 18px;font-size:14px">Печать</button></div>
      <h1>${ch.department}: перевахтовка ${fmtDate(ch.date)}</h1>
      <h2>Заезд</h2><table><tr><th>№</th><th>Вахта</th><th>ФИО</th><th>Должность</th><th>Транспорт</th><th>Статус</th><th>Замечания</th></tr>${rows("in")}</table>
      <h2>Выезд</h2><table><tr><th>№</th><th>Вахта</th><th>ФИО</th><th>Должность</th><th>Транспорт</th><th>Статус</th><th>Замечания</th></tr>${rows("out")}</table>
      </body></html>`);
    w.document.close();
  };

  const grouped = useMemo(() => {
    const past = items.filter((i) => i.days_left < 0);
    const future = items.filter((i) => i.days_left >= 0);
    return { past, future };
  }, [items]);

  const renderChange = (ch: Change) => {
    const key = `${ch.date}-${ch.department_id}`;
    const isOpen = open === key;
    const c = colorOf(ch.color);
    const pct = ch.total ? Math.round((ch.done / ch.total) * 100) : 0;
    return (
      <div key={key} id={`chg-${key}`} className={`rounded-xl border bg-card ${isOpen ? c.border : "border-border"}`}>
        <button onClick={() => setOpen(isOpen ? null : key)} className="w-full p-4 flex items-center gap-4 text-left">
          <div className={`w-14 shrink-0 rounded-lg ${c.bg} ${c.text} flex flex-col items-center py-1.5`}>
            <span className="text-xl font-bold leading-none">{ch.date.slice(8, 10)}</span>
            <span className="text-[10px]">{fmtDate(ch.date).slice(3)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{ch.department}</p>
            <p className="text-xs text-muted-foreground">
              Заезд: {ch.in.map((g) => `вахта ${g.crew} (${g.people.length})`).join(", ") || "—"} · Выезд:{" "}
              {ch.out.map((g) => `вахта ${g.crew} (${g.people.length})`).join(", ") || "—"} · {daysLabel(ch.days_left)}
            </p>
            <div className="mt-2 flex items-center gap-2 max-w-md">
              <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-mine-green" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{ch.done}/{ch.total}</span>
            </div>
          </div>
          {ch.issues > 0 && (
            <span className="shrink-0 text-xs font-semibold rounded-md bg-mine-red/15 text-mine-red px-2 py-1">
              {ch.issues} с замечаниями
            </span>
          )}
          <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={18} className="text-muted-foreground shrink-0" />
        </button>
        {isOpen && (
          <div className="border-t border-border p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-foreground" onClick={() => printList(ch)}>
                <Icon name="Printer" size={14} />
                Список для печати
              </Button>
            </div>
            <div className="grid xl:grid-cols-2 gap-4">
              {(["in", "out"] as const).map((side) => (
                <div key={side} className="rounded-lg border border-border">
                  <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-secondary/30">
                    <Icon name={side === "in" ? "LogIn" : "LogOut"} size={16} className={side === "in" ? "text-mine-green" : "text-mine-amber"} />
                    <p className="text-sm font-semibold text-foreground flex-1">{side === "in" ? "Заезжают" : "Выезжают"}</p>
                    {ch[side].length > 0 && (
                      <Select onValueChange={(v) => setStatus(ch, side, ch[side].flatMap((g) => g.people.filter((p) => p.status !== "cancelled")), v)}>
                        <SelectTrigger className="h-7 w-[170px] text-xs"><SelectValue placeholder="Отметить всех…" /></SelectTrigger>
                        <SelectContent>
                          {(side === "in" ? IN_STATUSES : OUT_STATUSES).filter((s) => s !== "cancelled").map((s) => (
                            <SelectItem key={s} value={s}>{MOVE_STATUS[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {ch[side].length === 0 && <p className="p-4 text-xs text-center text-muted-foreground">Нет</p>}
                  {ch[side].map((g) => (
                    <div key={g.crew_id}>
                      <p className="px-3 pt-2 text-[11px] font-semibold text-muted-foreground uppercase">Вахта {g.crew} · {g.people.length} чел.</p>
                      <div className="divide-y divide-border/50">
                        {g.people.map((p) => (
                          <PersonRow key={p.id} p={p} side={side} onSet={(pp, s, t) => setStatus(ch, side, [pp], s, t)} />
                        ))}
                        {g.people.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">В вахте нет людей</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={dept} onValueChange={(v) => { setDept(v); setOpen(null); }}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все подразделения</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Статусы отмечаются вручную. Замечания — срок пропуска, проживание, отпуск/больничный (по данным раздела).
        </p>
      </div>
      {loading && items.length === 0 ? (
        <div className="p-10 flex justify-center"><Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">Перевахтовок в ближайшие 60 дней нет</p>
      ) : (
        <>
          {grouped.future.map(renderChange)}
          {grouped.past.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase pt-2">Прошедшие (контроль)</p>
              {grouped.past.map(renderChange)}
            </>
          )}
        </>
      )}
    </div>
  );
}

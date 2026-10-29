import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rotationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { colorOf, fmtDate, type Gap } from "./types";

interface CalCrew {
  id: number;
  name: string;
  count: number;
  periods: [string, string][];
  people: { id: number; full_name: string; position: string; absent: { from: string; to: string; label: string }[] }[];
}

interface CalDept {
  id: number;
  name: string;
  color: string;
  crews: CalCrew[];
  gaps: Gap[];
  changes: string[];
}

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const DAY = 86400000;
const toMs = (s: string) => new Date(s.slice(0, 10) + "T00:00:00").getTime();

function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function Bars({ from, days, ranges, cls }: { from: number; days: number; ranges: [string, string][]; cls: string }) {
  return (
    <>
      {ranges.map(([a, b], i) => {
        const s = Math.max(0, (toMs(a) - from) / DAY);
        const e = Math.min(days, (toMs(b) - from) / DAY + 1);
        if (e <= 0 || s >= days) return null;
        return (
          <div
            key={i}
            className={`absolute top-1 bottom-1 rounded ${cls}`}
            style={{ left: `${(s / days) * 100}%`, width: `${((e - s) / days) * 100}%` }}
            title={`${fmtDate(a)} — ${fmtDate(b)}`}
          />
        );
      })}
    </>
  );
}

export default function RotationCalendar({ departments }: { departments: { id: number; name: string }[] }) {
  const { toast } = useToast();
  const now = new Date();
  const [start, setStart] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [months, setMonths] = useState(6);
  const [dept, setDept] = useState("all");
  const [people, setPeople] = useState(false);
  const [data, setData] = useState<{ from: string; to: string; departments: CalDept[] } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const params: Record<string, string> = { from: start, months: String(months) };
    if (dept !== "all") params.department_id = dept;
    if (people) params.people = "1";
    rotationApi.calendar(params).then(setData).catch(() => setData(null));
  }, [start, months, dept, people]);

  const view = useMemo(() => {
    if (!data) return null;
    const from = toMs(data.from);
    const days = Math.round((toMs(data.to) - from) / DAY) + 1;
    const monthMarks: { left: number; width: number; label: string }[] = [];
    let cur = data.from;
    while (toMs(cur) <= toMs(data.to)) {
      const next = addMonths(cur, 1);
      const s = (toMs(cur) - from) / DAY;
      const e = Math.min(days, (toMs(next) - from) / DAY);
      const d = new Date(cur + "T00:00:00");
      monthMarks.push({ left: (s / days) * 100, width: ((e - s) / days) * 100, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
      cur = next;
    }
    const todayPos = ((Date.now() - from) / DAY / days) * 100;
    return { from, days, monthMarks, todayPos };
  }, [data]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = { from: start, months: String(Math.min(months, 6)) };
      if (dept !== "all") params.department_id = dept;
      const d = await rotationApi.exportXlsx(params);
      const bin = atob(d.file);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = d.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Не удалось выгрузить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setStart(addMonths(start, -1))} className="text-foreground">
          <Icon name="ChevronLeft" size={16} />
        </Button>
        <span className="text-sm font-medium text-foreground min-w-[110px] text-center">
          с {MONTHS[new Date(start + "T00:00:00").getMonth()]} {start.slice(0, 4)}
        </span>
        <Button variant="outline" size="icon" onClick={() => setStart(addMonths(start, 1))} className="text-foreground">
          <Icon name="ChevronRight" size={16} />
        </Button>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[3, 6, 12].map((m) => <SelectItem key={m} value={String(m)}>{m} мес.</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все подразделения</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-foreground ml-2 cursor-pointer">
          <input type="checkbox" checked={people} onChange={(e) => setPeople(e.target.checked)} className="accent-primary" />
          По людям
        </label>
        <div className="flex-1" />
        <Button variant="outline" onClick={exportXlsx} disabled={exporting} className="gap-2 text-foreground">
          <Icon name={exporting ? "Loader2" : "FileSpreadsheet"} size={16} className={exporting ? "animate-spin" : ""} />
          Выгрузить в Excel
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-4 h-2.5 rounded bg-mine-amber" />на вахте</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-2.5 rounded bg-mine-red/70" />недоукомплектованность / отсутствие</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-mine-cyan" />перевахтовка</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-foreground" />сегодня</span>
      </div>

      {!data || !view ? (
        <div className="p-10 flex justify-center"><Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[240px_1fr] border-b border-border sticky top-0 bg-card z-10">
              <div className="px-3 py-2 text-xs text-muted-foreground">Подразделение / вахта</div>
              <div className="relative h-8">
                {view.monthMarks.map((m) => (
                  <div key={m.label} className="absolute top-0 bottom-0 border-l border-border px-1.5 text-xs text-muted-foreground flex items-center" style={{ left: `${m.left}%`, width: `${m.width}%` }}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
            {data.departments.map((d) => {
              const c = colorOf(d.color);
              const gapRanges = d.gaps.map((g) => [g.date_from, g.date_to] as [string, string]);
              return (
                <div key={d.id} className="border-b border-border">
                  <div className="grid grid-cols-[240px_1fr] bg-secondary/30">
                    <div className={`px-3 py-1.5 text-sm font-semibold ${c.text}`}>{d.name}</div>
                    <div className="relative h-8">
                      <Bars from={view.from} days={view.days} ranges={gapRanges} cls="bg-mine-red/50" />
                      {d.changes.map((ch) => {
                        const pos = ((toMs(ch) - view.from) / DAY / view.days) * 100;
                        return <div key={ch} className="absolute top-0 bottom-0 w-0.5 bg-mine-cyan" style={{ left: `${pos}%` }} title={`Перевахтовка ${fmtDate(ch)}`} />;
                      })}
                    </div>
                  </div>
                  {d.crews.map((cr) => (
                    <div key={cr.id}>
                      <div className="grid grid-cols-[240px_1fr] border-t border-border/50">
                        <div className="px-3 py-1.5 text-xs text-foreground">Вахта {cr.name} <span className="text-muted-foreground">· {cr.count} чел.</span></div>
                        <div className="relative h-7">
                          <Bars from={view.from} days={view.days} ranges={cr.periods} cls={c.bar} />
                          {view.todayPos >= 0 && view.todayPos <= 100 && <div className="absolute top-0 bottom-0 w-0.5 bg-foreground" style={{ left: `${view.todayPos}%` }} />}
                        </div>
                      </div>
                      {people && cr.people.map((p) => (
                        <div key={p.id} className="grid grid-cols-[240px_1fr] border-t border-border/30">
                          <div className="pl-6 pr-3 py-1 text-[11px] text-muted-foreground truncate" title={p.position}>{p.full_name}</div>
                          <div className="relative h-5">
                            <Bars from={view.from} days={view.days} ranges={cr.periods} cls={`${c.bar} opacity-40`} />
                            <Bars from={view.from} days={view.days} ranges={p.absent.map((a) => [a.from, a.to] as [string, string])} cls="bg-mine-red/80" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

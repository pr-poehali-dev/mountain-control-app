import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rotationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { colorOf, daysLabel, fmtDate, type CrewSummary, type Gap } from "./types";
import type { DeptForm } from "./DeptDialog";
import WorkerDialog, { type WorkerForm } from "./WorkerDialog";

interface Member {
  id: number;
  full_name: string;
  position: string;
  tab_number: string;
  phone: string;
  pass_valid_to: string | null;
  housing: string;
  notes: string;
  is_key: boolean;
  exceptions: { id: number; label: string; date_from: string; date_to: string; kind: string }[];
}

interface Crew extends CrewSummary {
  members: Member[];
  periods: [string, string][];
}

interface Detail {
  department: DeptForm & { id: number };
  crews: Crew[];
  norms: { id: number; position: string; min_count: number }[];
  unassigned: { id: number; full_name: string; position: string; tab_number: string }[];
  positions: { position: string; by_crew: Record<string, number> }[];
  gaps: Gap[];
}

interface Props {
  id: number;
  onBack: () => void;
  onEdit: (d: DeptForm) => void;
  onChanged: () => void;
}

export default function DeptDetail({ id, onBack, onEdit, onChanged }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [newNorm, setNewNorm] = useState({ position: "", min: 1 });
  const [search, setSearch] = useState("");
  const [worker, setWorker] = useState<{ open: boolean; initial: WorkerForm | null }>({ open: false, initial: null });
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    await run(() => rotationApi.importWorkers(id, btoa(bin)));
  };

  const openWorker = (m: Member, crewId: number | null) =>
    setWorker({
      open: true,
      initial: {
        id: m.id, full_name: m.full_name, position: m.position === "Без должности" ? "" : m.position, tab_number: m.tab_number || "",
        phone: m.phone || "", pass_valid_to: m.pass_valid_to || "", housing: m.housing || "", notes: m.notes || "", crew_id: crewId,
      },
    });

  const load = useCallback(() => {
    rotationApi.department(id).then(setData).catch((e) => toast({ title: "Ошибка загрузки", description: e.message, variant: "destructive" }));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      const r = (await fn()) as { message?: string };
      toast({ title: ok || r?.message || "Готово" });
      load();
      onChanged();
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="p-10 flex justify-center">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dep = data.department;
  const c = colorOf(dep.color);
  const q = search.trim().toLowerCase();
  const match = (m: { full_name: string; position: string }) => !q || `${m.full_name} ${m.position}`.toLowerCase().includes(q);
  const positionsAll = Array.from(new Set([...data.positions.map((p) => p.position), ...data.norms.map((n) => n.position)])).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-foreground">
          <Icon name="ArrowLeft" size={16} />
          Все подразделения
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className={`text-xl font-bold ${c.text}`}>{dep.name}</h2>
          <p className="text-xs text-muted-foreground">
            График {dep.on_days}/{dep.off_days} · {dep.scheme === "staggered" ? "смена половины состава" : "полная смена"} · опорный заезд{" "}
            {fmtDate(dep.anchor_date)}
            {dep.head_name && ` · руководитель: ${dep.head_name}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setWorker({ open: true, initial: null })} className="gap-1.5 text-foreground">
          <Icon name="UserPlus" size={14} />
          Добавить работника
        </Button>
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-foreground">
          <a href="/rotation-workers-template.xlsx" download="Шаблон_работники_перевахтовка.xlsx">
            <Icon name="FileDown" size={14} />
            Шаблон Excel
          </a>
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()} className="gap-1.5 text-foreground">
          <Icon name="FileUp" size={14} />
          Загрузить из Excel
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) importFile(f);
          }}
        />
        <Button variant="outline" size="sm" onClick={() => onEdit(dep)} className="gap-1.5 text-foreground">
          <Icon name="Settings" size={14} />
          Настроить
        </Button>
        <Button size="sm" disabled={busy} onClick={() => run(() => rotationApi.autoAssign(id))} className="gap-1.5">
          <Icon name="Wand2" size={14} />
          Автосборка ({data.unassigned.length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className="gap-1.5 text-foreground"
          onClick={() => {
            if (confirm("Перераспределить всех, кроме закреплённых (★), поровну по вахтам с учётом должностей?")) run(() => rotationApi.autoAssign(id, true));
          }}
        >
          <Icon name="Shuffle" size={14} />
          Перебалансировать
        </Button>
      </div>

      {data.gaps.length > 0 && (
        <div className="rounded-xl border border-mine-red/40 bg-mine-red/5 p-4">
          <p className="text-sm font-semibold text-mine-red flex items-center gap-2 mb-2">
            <Icon name="AlertTriangle" size={16} />
            Недоукомплектованность в ближайшие 180 дней
          </p>
          <div className="grid md:grid-cols-2 gap-1.5">
            {data.gaps.slice(0, 12).map((g, i) => (
              <p key={i} className="text-xs text-foreground">
                <span className="font-medium">{g.position}</span>: {g.have} из {g.need} — {fmtDate(g.date_from)}–{fmtDate(g.date_to)}
              </p>
            ))}
          </div>
          {data.gaps.length > 12 && <p className="text-xs text-muted-foreground mt-2">и ещё {data.gaps.length - 12}…</p>}
        </div>
      )}

      <div className="relative max-w-sm">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по ФИО или должности" className="pl-9" />
      </div>

      <div className={`grid gap-4 ${data.crews.length > 2 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2"}`}>
        {data.crews.map((cr) => (
          <div key={cr.id} className={`rounded-xl border bg-card ${cr.on_site ? c.border : "border-border"}`}>
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">Вахта {cr.name}</p>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${cr.on_site ? "bg-mine-green/15 text-mine-green" : "bg-secondary text-muted-foreground"}`}>
                  {cr.on_site ? "на вахте" : "на отдыхе"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {cr.members.length} чел. · {cr.next_direction === "in" ? "заезд" : "выезд"} {fmtDate(cr.next_change)} ({daysLabel(cr.days_to_change)})
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Вахты: {cr.periods.slice(0, 3).map((p) => `${fmtDate(p[0]).slice(0, 5)}–${fmtDate(p[1]).slice(0, 5)}`).join(", ")}
              </p>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
              {cr.members.filter(match).map((m) => (
                <div key={m.id} className="px-3 py-2 flex items-center gap-2 group">
                  <button
                    title={m.is_key ? "Закреплён за вахтой (не переносится при перебалансировке)" : "Закрепить за вахтой"}
                    onClick={() => run(() => rotationApi.setMember({ worker_id: m.id, is_key: !m.is_key }), m.is_key ? "Снято закрепление" : "Закреплён")}
                    className={m.is_key ? "text-mine-amber" : "text-muted-foreground/40 hover:text-mine-amber"}
                  >
                    <Icon name="Star" size={14} />
                  </button>
                  <button className="flex-1 min-w-0 text-left" onClick={() => openWorker(m, cr.id)} title="Открыть карточку">
                    <p className="text-sm text-foreground truncate hover:underline">{m.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.position}
                      {m.exceptions.length > 0 && (
                        <span className="text-mine-red"> · {m.exceptions[m.exceptions.length - 1].label.toLowerCase()} {fmtDate(m.exceptions[m.exceptions.length - 1].date_from).slice(0, 5)}</span>
                      )}
                    </p>
                  </button>
                  <Select
                    value={String(cr.id)}
                    onValueChange={(v) => run(() => rotationApi.setMember({ worker_id: m.id, crew_id: v === "none" ? null : Number(v) }), "Перемещён")}
                  >
                    <SelectTrigger className="h-7 w-[74px] text-xs opacity-60 group-hover:opacity-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.crews.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="none">Убрать</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {cr.members.length === 0 && <p className="p-4 text-xs text-center text-muted-foreground">Пусто — добавьте работников или нажмите «Автосборка»</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Нормативы и баланс по должностям</p>
            <p className="text-xs text-muted-foreground">Минимум людей на объекте одновременно. Ниже нормы — система предупредит.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-2 font-medium">Должность</th>
                  {data.crews.map((cr) => (
                    <th key={cr.id} className="px-2 py-2 font-medium">{cr.name}</th>
                  ))}
                  <th className="px-3 py-2 font-medium">Мин. на объекте</th>
                </tr>
              </thead>
              <tbody>
                {positionsAll.map((pos) => {
                  const row = data.positions.find((p) => p.position === pos);
                  const norm = data.norms.find((n) => n.position === pos);
                  const vals = data.crews.map((cr) => row?.by_crew[String(cr.id)] || 0);
                  const unbalanced = Math.max(...vals) - Math.min(...vals) > 1;
                  return (
                    <tr key={pos} className="border-b border-border/50">
                      <td className="px-3 py-1.5 text-foreground">
                        {pos}
                        {unbalanced && <span className="ml-1 text-[10px] text-mine-amber">неравномерно</span>}
                      </td>
                      {vals.map((v, i) => (
                        <td key={i} className="px-2 py-1.5 text-center text-foreground">{v}</td>
                      ))}
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={norm?.min_count ?? 0}
                          className="h-7 w-16 text-xs mx-auto"
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (n !== (norm?.min_count ?? 0)) run(() => rotationApi.saveNorm(id, pos, n), "Норматив сохранён");
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 flex gap-2 border-t border-border">
            <Input value={newNorm.position} onChange={(e) => setNewNorm({ ...newNorm, position: e.target.value })} placeholder="Должность" className="h-8 text-sm" />
            <Input type="number" min={1} value={newNorm.min} onChange={(e) => setNewNorm({ ...newNorm, min: Number(e.target.value) })} className="h-8 w-20 text-sm" />
            <Button
              size="sm"
              disabled={!newNorm.position.trim() || busy}
              onClick={() => run(() => rotationApi.saveNorm(id, newNorm.position.trim(), newNorm.min), "Норматив добавлен").then(() => setNewNorm({ position: "", min: 1 }))}
            >
              Добавить
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Не распределены по вахтам ({data.unassigned.length})</p>
            <p className="text-xs text-muted-foreground">Работники подразделения без вахты. «Автосборка» распределит их поровну по должностям.</p>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/60">
            {data.unassigned.filter(match).map((u) => (
              <div key={u.id} className="px-3 py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{u.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{u.position}{u.tab_number && ` · таб. ${u.tab_number}`}</p>
                </div>
                {data.crews.map((cr) => (
                  <Button key={cr.id} size="sm" variant="outline" className="h-7 px-2 text-xs text-foreground" disabled={busy}
                    onClick={() => run(() => rotationApi.setMember({ worker_id: u.id, crew_id: cr.id }), `Добавлен в вахту ${cr.name}`)}>
                    {cr.name}
                  </Button>
                ))}
              </div>
            ))}
            {data.unassigned.length === 0 && (
              <p className="p-6 text-xs text-center text-muted-foreground">
                Все работники распределены. Новых добавляйте кнопкой «Добавить работника» или загрузкой из Excel — скачайте «Шаблон Excel», заполните и нажмите «Загрузить из Excel».
              </p>
            )}
          </div>
        </div>
      </div>
      <WorkerDialog
        open={worker.open}
        departmentId={id}
        crews={data.crews.map((c) => ({ id: c.id, name: c.name }))}
        positions={positionsAll}
        initial={worker.initial}
        onClose={() => setWorker({ open: false, initial: null })}
        onSaved={() => {
          load();
          onChanged();
        }}
      />
    </div>
  );
}

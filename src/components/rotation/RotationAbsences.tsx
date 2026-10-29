import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rotationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { EXC_KINDS, fmtDate } from "./types";

interface Exc {
  id: number;
  personnel_id: number;
  full_name: string;
  position: string;
  department: string;
  kind: string;
  label: string;
  date_from: string;
  date_to: string;
  notes: string;
}

interface Person {
  id: number;
  full_name: string;
  position: string;
  crew: string;
  rotation_department: string;
}

export default function RotationAbsences({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Exc[]>([]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [form, setForm] = useState({ kind: "vacation", date_from: "", date_to: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    rotationApi.exceptions().then((d) => setItems(d.items || [])).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (query.trim().length < 2 || person) {
      setFound([]);
      return;
    }
    const t = setTimeout(() => rotationApi.people(query).then((d) => setFound(d.items || [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [query, person]);

  const save = async () => {
    if (!person || !form.date_from) {
      toast({ title: "Выберите сотрудника и дату начала", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await rotationApi.saveException({ worker_id: person.id, ...form, date_to: form.date_to || form.date_from });
      toast({ title: "Отсутствие добавлено", description: "Графики и проверка укомплектованности пересчитаны" });
      setPerson(null);
      setQuery("");
      setForm({ kind: "vacation", date_from: "", date_to: "", notes: "" });
      load();
      onChanged();
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    await rotationApi.deleteException(id).catch(() => {});
    load();
    onChanged();
  };

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 h-fit">
        <p className="text-sm font-semibold text-foreground">Отпуск, больничный, обучение, увольнение</p>
        <p className="text-xs text-muted-foreground">
          Отметьте, кто выпадает из вахты — система покажет, где не хватает людей, и предупредит при подготовке заезда.
        </p>
        <div className="relative">
          <Input
            value={person ? person.full_name : query}
            onChange={(e) => {
              setPerson(null);
              setQuery(e.target.value);
            }}
            placeholder="ФИО работника из списков перевахтовки"
          />
          {found.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
              {found.map((p) => (
                <button key={p.id} onClick={() => { setPerson(p); setFound([]); }} className="w-full px-3 py-2 text-left hover:bg-secondary">
                  <p className="text-sm text-foreground">{p.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.position}
                    {` · ${p.rotation_department}${p.crew ? `, вахта ${p.crew}` : ", не в вахте"}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXC_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">{form.kind === "dismissal" ? "Дата увольнения" : "С"}</label>
            <Input type="date" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} />
          </div>
          {form.kind !== "dismissal" && (
            <div>
              <label className="text-xs text-muted-foreground">По</label>
              <Input type="date" value={form.date_to} min={form.date_from} onChange={(e) => setForm({ ...form, date_to: e.target.value })} />
            </div>
          )}
        </div>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Комментарий" />
        <Button onClick={save} disabled={busy} className="w-full">Добавить</Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Отсутствия ({items.length})</p>
        </div>
        {items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Пока нет отметок</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${e.kind === "dismissal" ? "bg-mine-red/15 text-mine-red" : e.kind === "sick" ? "bg-mine-amber/15 text-mine-amber" : "bg-mine-cyan/15 text-mine-cyan"}`}>
                  {e.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{e.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {e.position}
                    {e.department && ` · ${e.department}`}
                    {e.notes && ` · ${e.notes}`}
                  </p>
                </div>
                <span className="text-xs text-foreground whitespace-nowrap">
                  {e.kind === "dismissal" ? `с ${fmtDate(e.date_from)}` : `${fmtDate(e.date_from)} — ${fmtDate(e.date_to)}`}
                </span>
                <button onClick={() => remove(e.id)} className="p-1 text-muted-foreground hover:text-mine-red" title="Удалить">
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

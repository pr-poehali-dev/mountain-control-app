import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { eventsApi } from "@/lib/api";

interface Item {
  personnel_id: number;
  full_name: string;
  position: string;
  department: string;
  organization: string;
  registered_at: string;
  days: number;
  residence: string;
}

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString("ru-RU") : "");
const ago = (n: number) => (n <= 0 ? "сегодня" : n === 1 ? "вчера" : `${n} ${plural(n)} назад`);

function Row({ i }: { i: Item }) {
  const old = i.days >= 3;
  return (
    <Link
      to={`/personnel?open=${i.personnel_id}`}
      className={`rounded-lg border bg-card px-3 py-2 flex items-start gap-2.5 hover:bg-secondary/40 transition-colors ${old ? "border-mine-amber/40" : "border-border"}`}
    >
      <Icon name="UserRoundX" size={16} className={`mt-0.5 shrink-0 ${old ? "text-mine-amber" : "text-mine-cyan"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{i.full_name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[i.position, i.department || i.organization].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <span className={`text-[11px] shrink-0 ${old ? "text-mine-amber" : "text-muted-foreground"}`} title={`Зарегистрирован ${fmt(i.registered_at)}`}>
        {ago(i.days)}
      </span>
    </Link>
  );
}

export default function NotPassedCheckpoint() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    eventsApi
      .getNotPassed()
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => `${i.full_name} ${i.position} ${i.department} ${i.organization}`.toLowerCase().includes(s));
  }, [items, q]);

  if (!loaded || items.length === 0) return null;

  const old = items.filter((i) => i.days >= 3).length;

  return (
    <div className="rounded-xl border border-mine-cyan/30 bg-mine-cyan/5 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-mine-cyan/15 flex items-center justify-center">
          <Icon name="DoorClosed" size={20} className="text-mine-cyan" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Зарегистрированы, но ещё не прошли КПП: <span className="text-mine-cyan">{items.length}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Статус «Ожидается» — на территории не числятся, пока не пройдут КПП на вход
            {old > 0 && <span className="text-mine-amber"> · более 3 дней: {old}</span>}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
          Весь список
          <Icon name="ChevronRight" size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {items.slice(0, 6).map((i) => (
          <Row key={i.personnel_id} i={i} />
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Не прошли КПП — {items.length}</DialogTitle>
            <DialogDescription>Зарегистрированы в системе, ни одного прохода через КПП. Нажмите на ФИО, чтобы открыть карточку.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по ФИО, должности, подразделению" className="pl-9" />
          </div>
          <div className="overflow-y-auto space-y-2 pr-1">
            {filtered.map((i) => (
              <Row key={i.personnel_id} i={i} />
            ))}
            {filtered.length === 0 && <p className="text-xs text-center text-muted-foreground py-6">Никого не найдено</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

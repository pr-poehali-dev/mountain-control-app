import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { eventsApi, personnelApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface Item {
  personnel_id: number;
  full_name: string;
  position: string;
  organization: string;
  kind: "personal" | "vehicle";
  pass_number: string;
  vehicle: string;
  valid_to: string;
  valid_from?: string;
  days_left: number;
}

function addDays(base: string, days: number) {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function ExtendButton({ item, onDone }: { item: Item; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = item.days_left < 0 ? todayIso() : item.valid_to;
  const [date, setDate] = useState(addDays(start, 30));

  const presets = [
    { label: "+1 мес", days: 30 },
    { label: "+3 мес", days: 91 },
    { label: "+6 мес", days: 182 },
    { label: "+1 год", days: 365 },
  ];

  const save = async (permanent = false) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> =
        item.kind === "vehicle"
          ? {
              id: item.personnel_id,
              vehicle_pass_permanent: permanent,
              vehicle_pass_valid_from: item.valid_from || "",
              vehicle_pass_valid_to: permanent ? "" : date,
            }
          : {
              id: item.personnel_id,
              pass_permanent: permanent,
              pass_valid_from: item.valid_from || "",
              pass_valid_to: permanent ? "" : date,
            };
      await personnelApi.edit(body);
      toast({
        title: "Пропуск продлён",
        description: `${item.full_name}: ${permanent ? "бессрочно" : `до ${fmt(date)}`}`,
      });
      setOpen(false);
      onDone();
    } catch (e) {
      toast({ title: "Не удалось продлить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1 shrink-0 border-mine-green/40 text-mine-green hover:bg-mine-green/10 hover:text-mine-green"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="CalendarPlus" size={12} />
          Продлить
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div>
          <p className="text-sm font-semibold text-foreground">Продлить пропуск</p>
          <p className="text-xs text-muted-foreground truncate">
            {item.full_name} · {item.kind === "vehicle" ? "авто" : "личный"}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDate(addDays(start, p.days))}
              className={`text-[11px] rounded-md border px-1 py-1.5 transition-colors ${
                date === addDays(start, p.days)
                  ? "border-mine-green bg-mine-green/10 text-mine-green"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Новая дата окончания</label>
          <Input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} className="bg-secondary/50" />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-mine-green text-black hover:bg-mine-green/90"
            disabled={busy || !date || date < todayIso()}
            onClick={() => save(false)}
          >
            {busy ? <Icon name="Loader2" size={14} className="animate-spin" /> : "Сохранить"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save(true)}>
            Бессрочно
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const fmt = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};

function daysText(n: number) {
  if (n < 0) {
    const a = Math.abs(n);
    return `истёк ${a} ${plural(a)} назад`;
  }
  if (n === 0) return "истекает сегодня";
  if (n === 1) return "истекает завтра";
  return `через ${n} ${plural(n)}`;
}

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}

export default function ExpiringPasses() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = () =>
    eventsApi
      .getExpiringPasses(7)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
  }, []);

  if (!loaded) return null;

  const expired = items.filter((i) => i.days_left < 0).length;
  const expiring = items.length - expired;
  const visible = showAll ? items : items.slice(0, 6);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-mine-green/10 flex items-center justify-center">
          <Icon name="ShieldCheck" size={20} className="text-mine-green" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Пропуска в порядке</p>
          <p className="text-xs text-muted-foreground">В ближайшие 7 дней ни один пропуск не истекает</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-mine-amber/30 bg-mine-amber/5 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-mine-amber/15 flex items-center justify-center">
          <Icon name="BellRing" size={20} className="text-mine-amber" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Пропуска требуют продления</p>
          <p className="text-xs text-muted-foreground">
            {expiring > 0 && <span className="text-mine-amber">истекают в течение 7 дней: {expiring}</span>}
            {expiring > 0 && expired > 0 && " · "}
            {expired > 0 && <span className="text-mine-red">уже истекли: {expired}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {visible.map((i) => {
          const isExpired = i.days_left < 0;
          return (
            <div
              key={`${i.kind}-${i.personnel_id}`}
              className={`rounded-lg border bg-card px-3 py-2 flex items-start gap-2.5 ${
                isExpired ? "border-mine-red/30" : "border-border"
              }`}
            >
              <Icon
                name={i.kind === "vehicle" ? "Car" : "CreditCard"}
                size={16}
                className={`mt-0.5 shrink-0 ${isExpired ? "text-mine-red" : "text-mine-amber"}`}
              />
              <Link to={`/personnel?open=${i.personnel_id}`} className="min-w-0 flex-1 group">
                <p className="text-sm font-medium text-foreground truncate group-hover:underline">{i.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {i.kind === "vehicle" ? `Авто ${i.vehicle || ""}`.trim() : "Личный пропуск"}
                  {i.pass_number && ` № ${i.pass_number}`}
                </p>
                <p className={`text-xs font-medium ${isExpired ? "text-mine-red" : "text-mine-amber"}`}>
                  до {fmt(i.valid_to)} — {daysText(i.days_left)}
                </p>
              </Link>
              <ExtendButton item={i} onDone={load} />
            </div>
          );
        })}
      </div>

      {items.length > 6 && (
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-mine-amber hover:underline">
          {showAll ? "Свернуть" : `Показать все (${items.length})`}
        </button>
      )}
    </div>
  );
}

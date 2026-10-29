import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { eventsApi } from "@/lib/api";
import { ruLabel } from "@/lib/ruLabels";
import { useRegistryVisible } from "./PassExpiryAlert";

export type PassKind = "personal" | "vehicle";
export type PassState = "expired" | "expiring" | "no_date" | "future" | "active" | "permanent";

export interface PassItem {
  personnel_id: number;
  full_name: string;
  position: string;
  department: string;
  organization: string;
  category: string;
  status: string;
  photo_url: string;
  pass_number: string;
  permanent: boolean;
  valid_from: string;
  valid_to: string;
  vehicle_number: string;
  vehicle_brand: string;
  phone: string;
  state: PassState;
  days_left: number | null;
}

const fmt = (d: string) => (d ? d.split("-").reverse().join(".") : "—");

function plural(n: number) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return "день";
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return "дня";
  return "дней";
}

export function passOpenUrl(id: number, kind: PassKind) {
  return `/personnel?open=${id}&pass=${kind}`;
}

function StateBadge({ item }: { item: PassItem }) {
  if (item.state === "expired") {
    const n = Math.abs(item.days_left || 0);
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-mine-red px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white animate-alarm-blink">
          <Icon name="AlertTriangle" size={12} />
          Просрочен
        </span>
        <span className="text-[10px] text-mine-red">{n === 0 ? "сегодня" : `${n} ${plural(n)} назад`}</span>
      </span>
    );
  }
  if (item.state === "expiring") {
    const n = item.days_left || 0;
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-mine-red/60 bg-mine-red/15 px-2 py-0.5 text-xs font-semibold text-mine-red animate-alarm-blink">
          <Icon name="Clock" size={12} />
          Истекает
        </span>
        <span className="text-[10px] text-mine-red">
          {n === 0 ? "сегодня последний день" : n === 1 ? "завтра" : `через ${n} ${plural(n)}`}
        </span>
      </span>
    );
  }
  const view: Record<string, { text: string; cls: string }> = {
    active: { text: "Действует", cls: "bg-mine-green/15 text-mine-green border-mine-green/30" },
    permanent: { text: "Постоянный", cls: "bg-mine-cyan/15 text-mine-cyan border-mine-cyan/30" },
    future: { text: "Ещё не начался", cls: "bg-mine-amber/15 text-mine-amber border-mine-amber/30" },
    no_date: { text: "Срок не указан", cls: "bg-muted text-muted-foreground border-border" },
  };
  const v = view[item.state];
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.text}</span>;
}

const FILTERS: { id: "all" | "problem" | PassState; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "problem", label: "Просрочены и истекают" },
  { id: "active", label: "Действуют" },
  { id: "permanent", label: "Постоянные" },
];

export default function PassRegistry({ kind }: { kind: PassKind }) {
  useRegistryVisible();
  const navigate = useNavigate();
  const [items, setItems] = useState<PassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const load = useCallback(() => {
    setLoading(true);
    eventsApi
      .getPassRegistry(kind)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const expired = items.filter((i) => i.state === "expired").length;
  const expiring = items.filter((i) => i.state === "expiring").length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "problem" && i.state !== "expired" && i.state !== "expiring") return false;
      if (filter !== "all" && filter !== "problem" && i.state !== filter) return false;
      if (!q) return true;
      return [i.full_name, i.pass_number, i.vehicle_number, i.vehicle_brand, i.organization, i.position]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, query, filter]);

  const title = kind === "vehicle" ? "Пропуска на автомобили" : "Пропуска личного состава";

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name={kind === "vehicle" ? "Car" : "IdCard"} fallback="CreditCard" size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">
              Выдано: {items.length}
              {expired > 0 && <span className="text-mine-red font-semibold"> · просрочено: {expired}</span>}
              {expiring > 0 && <span className="text-mine-red"> · истекают за 7 дней: {expiring}</span>}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-foreground">
            <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
            Обновить
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === "vehicle" ? "ФИО, госномер, марка, № пропуска" : "ФИО, должность, организация, № пропуска"}
              className="pl-9 bg-secondary/50"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  filter === f.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="p-10 flex justify-center">
          <Icon name="Loader2" size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? "Пропуска ещё не выданы" : "Ничего не найдено"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Сотрудник</th>
                {kind === "vehicle" && <th className="px-3 py-2 font-medium">Автомобиль</th>}
                <th className="px-3 py-2 font-medium">№ пропуска</th>
                <th className="px-3 py-2 font-medium">Срок действия</th>
                <th className="px-3 py-2 font-medium hidden xl:table-cell">Организация</th>
                <th className="px-4 py-2 font-medium text-right">Статус</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => {
                const bad = i.state === "expired" || i.state === "expiring";
                return (
                  <tr
                    key={i.personnel_id}
                    onClick={() => navigate(passOpenUrl(i.personnel_id, kind))}
                    title="Открыть настройки пропуска"
                    className={`border-b border-border/60 cursor-pointer transition-colors ${
                      bad ? "bg-mine-red/5 hover:bg-mine-red/10" : "hover:bg-secondary/50"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {i.photo_url ? (
                          <img src={i.photo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <Icon name="User" size={14} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{i.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {i.position || "—"}
                            {i.status && ` · ${ruLabel(i.status)}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    {kind === "vehicle" && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="font-mono font-semibold text-foreground">{i.vehicle_number || "—"}</p>
                        <p className="text-xs text-muted-foreground">{i.vehicle_brand || ""}</p>
                      </td>
                    )}
                    <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap">{i.pass_number || "—"}</td>
                    <td className={`px-3 py-2.5 whitespace-nowrap text-xs ${bad ? "text-mine-red font-medium" : "text-muted-foreground"}`}>
                      {i.permanent ? "Бессрочно" : `${fmt(i.valid_from)} — ${fmt(i.valid_to)}`}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden xl:table-cell">
                      {i.organization || "—"}
                      {i.department && <span className="block">{i.department}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <StateBadge item={i} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

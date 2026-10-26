import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { eventsApi } from "@/lib/api";

interface Item {
  personnel_id: number;
  full_name: string;
  position: string;
  organization: string;
  kind: "personal" | "vehicle";
  pass_number: string;
  vehicle: string;
  valid_to: string;
  days_left: number;
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

  useEffect(() => {
    eventsApi
      .getExpiringPasses(7)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
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
            <Link
              key={`${i.kind}-${i.personnel_id}`}
              to={`/personnel?open=${i.personnel_id}`}
              className={`rounded-lg border bg-card px-3 py-2 flex items-start gap-2.5 hover:ring-2 transition-all ${
                isExpired ? "border-mine-red/30 ring-mine-red/30" : "border-border ring-mine-amber/30"
              }`}
            >
              <Icon
                name={i.kind === "vehicle" ? "Car" : "CreditCard"}
                size={16}
                className={`mt-0.5 shrink-0 ${isExpired ? "text-mine-red" : "text-mine-amber"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{i.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {i.kind === "vehicle" ? `Авто ${i.vehicle || ""}`.trim() : "Личный пропуск"}
                  {i.pass_number && ` № ${i.pass_number}`}
                </p>
                <p className={`text-xs font-medium ${isExpired ? "text-mine-red" : "text-mine-amber"}`}>
                  до {fmt(i.valid_to)} — {daysText(i.days_left)}
                </p>
              </div>
            </Link>
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

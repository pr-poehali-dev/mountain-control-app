import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { eventsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { passOpenUrl, type PassKind } from "./PassRegistry";

interface Item {
  personnel_id: number;
  full_name: string;
  kind: PassKind;
  pass_number: string;
  vehicle: string;
  valid_to: string;
  days_left: number;
}

const DISMISS_KEY = "mc_pass_popup_dismissed";
const REGISTRY_ATTR = "data-pass-registry";
const POLL_MS = 5 * 60 * 1000;

const fmt = (d: string) => d.split("-").reverse().join(".");

function signature(items: Item[]) {
  return items.map((i) => `${i.kind}-${i.personnel_id}-${i.valid_to}`).sort().join("|");
}

export function useRegistryVisible() {
  useEffect(() => {
    const el = document.documentElement;
    const n = Number(el.getAttribute(REGISTRY_ATTR) || "0") + 1;
    el.setAttribute(REGISTRY_ATTR, String(n));
    window.dispatchEvent(new Event("mc-pass-registry"));
    return () => {
      const left = Number(el.getAttribute(REGISTRY_ATTR) || "1") - 1;
      if (left > 0) el.setAttribute(REGISTRY_ATTR, String(left));
      else el.removeAttribute(REGISTRY_ATTR);
      window.dispatchEvent(new Event("mc-pass-registry"));
    };
  }, []);
}

export default function PassExpiryAlert() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, allowedPages } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [registryOpen, setRegistryOpen] = useState(() => document.documentElement.hasAttribute(REGISTRY_ATTR));
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) || "");
  const [expanded, setExpanded] = useState(false);

  const allowed = !!user && (allowedPages.includes("personnel") || allowedPages.includes("checkpoint"));

  const load = useCallback(() => {
    if (!allowed) return;
    eventsApi
      .getExpiringPasses(3)
      .then((d) => setItems((d.items || []) as Item[]))
      .catch(() => {});
  }, [allowed]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const sync = () => setRegistryOpen(document.documentElement.hasAttribute(REGISTRY_ATTR));
    sync();
    window.addEventListener("mc-pass-registry", sync);
    return () => window.removeEventListener("mc-pass-registry", sync);
  }, []);

  useEffect(() => {
    setExpanded(false);
  }, [location.pathname]);

  const sig = signature(items);
  if (!allowed || items.length === 0 || registryOpen || dismissed === sig || location.pathname === "/personnel") return null;

  const expired = items.filter((i) => i.days_left < 0);
  const soon = items.filter((i) => i.days_left >= 0);
  const list = expanded ? items : items.slice(0, 3);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, sig);
    setDismissed(sig);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] animate-fade-in">
      <div className="rounded-xl border-2 border-mine-red bg-card shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 bg-mine-red/10 px-4 py-3">
          <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mine-red text-white animate-alarm-blink">
            <Icon name="AlertTriangle" size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-mine-red">
              {expired.length > 0 ? "Просрочены пропуска" : "Истекают пропуска"}
            </p>
            <p className="text-xs text-muted-foreground">
              {expired.length > 0 && `просрочено: ${expired.length}`}
              {expired.length > 0 && soon.length > 0 && " · "}
              {soon.length > 0 && `истекают в течение 3 дней: ${soon.length}`}
            </p>
          </div>
          <button onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Скрыть" title="Скрыть до появления новых">
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {list.map((i) => {
            const isExpired = i.days_left < 0;
            return (
              <button
                key={`${i.kind}-${i.personnel_id}`}
                onClick={() => navigate(passOpenUrl(i.personnel_id, i.kind))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/60 transition-colors"
                title="Открыть настройки пропуска"
              >
                <Icon name={i.kind === "vehicle" ? "Car" : "CreditCard"} size={16} className="text-mine-red shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{i.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {i.kind === "vehicle" ? `Авто ${i.vehicle || ""}`.trim() : "Личный пропуск"}
                    {i.pass_number && ` № ${i.pass_number}`} · до {fmt(i.valid_to)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    isExpired ? "bg-mine-red text-white animate-alarm-blink" : "border border-mine-red/50 text-mine-red"
                  }`}
                >
                  {isExpired ? "Просрочен" : i.days_left === 0 ? "Сегодня" : `${i.days_left} дн.`}
                </span>
                <Icon name="ChevronRight" size={14} className="text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
        {items.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full border-t border-border px-4 py-2 text-xs font-medium text-mine-red hover:bg-secondary/60"
          >
            {expanded ? "Свернуть" : `Показать все (${items.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

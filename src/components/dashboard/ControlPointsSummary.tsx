import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { checkpointApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { pointPath, type ControlPoint } from "@/hooks/use-control-points";

interface PointSummary extends ControlPoint {
  inside: number;
  today_in: number;
  today_out: number;
  today_denied: number;
  last_pass_at: string | null;
}

const POLL_MS = 20000;

function timeAgo(iso: string | null) {
  if (!iso) return "проходов сегодня не было";
  const d = new Date(iso);
  return "последний проход в " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function ControlPointsSummary({ title = "Объекты контроля" }: { title?: string }) {
  const navigate = useNavigate();
  const { allowedPages } = useAuth();
  const [items, setItems] = useState<PointSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await checkpointApi.getPointsSummary();
      setItems(d.points || []);
    } catch { /* ignore */ } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const h = () => load();
    window.addEventListener("control-points-changed", h);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("control-points-changed", h);
    };
  }, [load]);

  if (loaded && items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="MapPinned" size={18} className="text-mine-cyan" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground ml-auto">сегодня · автообновление</span>
      </div>
      {!loaded ? (
        <div className="py-6 flex justify-center"><Icon name="Loader2" size={18} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {items.map((p) => {
            const canOpen = allowedPages.includes(p.page_key);
            return (
              <button
                key={p.id}
                disabled={!canOpen}
                onClick={() => navigate(pointPath(p))}
                className={`text-left rounded-xl border p-3.5 transition-all ${
                  p.today_denied > 0 ? "border-mine-red/30 bg-mine-red/5" : "border-border bg-secondary/20"
                } ${canOpen ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-mine-cyan/10 flex items-center justify-center shrink-0">
                    <Icon name={p.icon} fallback="DoorOpen" size={16} className="text-mine-cyan" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {p.settings.counts_territory || p.is_main ? "на территории" : "внутри объекта"}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-mine-green">{p.inside}</p>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-3 text-center">
                  <div className="rounded-md bg-background/60 py-1">
                    <p className="text-sm font-semibold text-mine-green">{p.today_in}</p>
                    <p className="text-[9px] text-muted-foreground">вход</p>
                  </div>
                  <div className="rounded-md bg-background/60 py-1">
                    <p className="text-sm font-semibold text-mine-amber">{p.today_out}</p>
                    <p className="text-[9px] text-muted-foreground">выход</p>
                  </div>
                  <div className="rounded-md bg-background/60 py-1">
                    <p className={`text-sm font-semibold ${p.today_denied ? "text-mine-red" : "text-muted-foreground"}`}>{p.today_denied}</p>
                    <p className="text-[9px] text-muted-foreground">отказы</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">{timeAgo(p.last_pass_at)}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

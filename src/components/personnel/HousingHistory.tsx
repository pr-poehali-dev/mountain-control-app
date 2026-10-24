import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { personnelApi } from "@/lib/api";

interface HousingEvent {
  id: number;
  action: "checkin" | "move" | "evict";
  action_label: string;
  building: string;
  room: string;
  prev_building: string;
  prev_room: string;
  source: string;
  created_at: string;
}

const actionStyle: Record<string, { icon: string; color: string }> = {
  checkin: { icon: "LogIn", color: "text-mine-green" },
  move: { icon: "ArrowRightLeft", color: "text-mine-cyan" },
  evict: { icon: "LogOut", color: "text-mine-red" },
};

function place(b: string, r: string) {
  return r ? `${b}, комн. ${r}` : b || "—";
}

function fmt(s: string) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? s : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HousingHistory({ personnelId, refreshKey }: { personnelId: number; refreshKey?: unknown }) {
  const [items, setItems] = useState<HousingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    personnelApi
      .getHousingHistory(personnelId)
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [personnelId, refreshKey]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="Home" size={16} className="text-mine-cyan" />
        <h4 className="text-sm font-semibold text-foreground">История проживания</h4>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Icon name="Loader2" size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">Сотрудник ещё не заселялся</p>
      ) : (
        <div className="relative pl-4 space-y-1 max-h-56 overflow-y-auto">
          <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border" />
          {items.map((h) => {
            const st = actionStyle[h.action] || actionStyle.checkin;
            return (
              <div key={h.id} className="relative flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/30">
                <div className="relative z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                  <Icon name={st.icon} size={12} className={st.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">
                    <span className={`font-semibold ${st.color}`}>{h.action_label}</span>
                    {h.action === "move" ? (
                      <> : {place(h.prev_building, h.prev_room)} <span className="text-muted-foreground">→</span> {place(h.building, h.room)}</>
                    ) : (
                      <> : {place(h.building, h.room)}</>
                    )}
                  </p>
                  {h.source && <p className="text-[10px] text-muted-foreground">{h.source}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5">{fmt(h.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

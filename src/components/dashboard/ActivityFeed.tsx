import Icon from "@/components/ui/icon";

const eventIconMap: Record<string, { icon: string; color: string }> = {
  medical_pass: { icon: "HeartPulse", color: "text-mine-green" },
  lantern_issued: { icon: "Flashlight", color: "text-mine-amber" },
  arrival: { icon: "UserPlus", color: "text-mine-cyan" },
  shift_start: { icon: "Clock", color: "text-mine-amber" },
  medical_fail: { icon: "AlertTriangle", color: "text-mine-red" },
  departure: { icon: "UserMinus", color: "text-muted-foreground" },
  room_checkin: { icon: "Home", color: "text-mine-cyan" },
  lantern_returned: { icon: "Flashlight", color: "text-mine-green" },
  status_change: { icon: "RefreshCw", color: "text-mine-cyan" },
};

interface EventItem {
  id: number;
  type: string;
  description: string;
  created_at: string;
  person_name?: string;
  person_code?: string;
}

interface ActivityFeedProps {
  events?: EventItem[];
  loading?: boolean;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ActivityFeed({ events, loading }: ActivityFeedProps) {
  const activities = events || [];

  return (
    <div className="rounded-xl border border-border bg-card h-full">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Icon name="Activity" size={18} className="text-mine-cyan" />
        <h3 className="text-sm font-semibold text-foreground">
          Лента событий
        </h3>
      </div>
      <div className="p-2 space-y-0.5 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Нет событий</p>
          </div>
        ) : (
          activities.map((a, i) => {
            const mapping = eventIconMap[a.type] || { icon: "Info", color: "text-muted-foreground" };
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="mt-0.5">
                  <Icon name={mapping.icon} size={16} className={mapping.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{a.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Сегодня, {formatTime(a.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

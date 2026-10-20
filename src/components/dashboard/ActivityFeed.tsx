import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { eventsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
  onChange?: (events: EventItem[]) => void;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ActivityFeed({ events, loading, onChange }: ActivityFeedProps) {
  const activities = events || [];
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" && localStorage.getItem("mc_demo") !== "true";
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const saveEdit = async (id: number) => {
    const text = draft.trim();
    if (!text) return;
    setBusyId(id);
    try {
      await eventsApi.editEvent(id, text);
      onChange?.(activities.map((e) => (e.id === id ? { ...e, description: text } : e)));
      setEditId(null);
    } catch (err) {
      toast({ title: "Не удалось сохранить", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const hide = async (id: number) => {
    if (!confirm("Убрать это событие из ленты и отчётов?")) return;
    setBusyId(id);
    try {
      await eventsApi.hideEvent(id);
      onChange?.(activities.filter((e) => e.id !== id));
    } catch (err) {
      toast({ title: "Не удалось убрать событие", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

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
                className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="mt-0.5">
                  <Icon name={mapping.icon} size={16} className={mapping.color} />
                </div>
                <div className="flex-1 min-w-0">
                  {editId === a.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full text-sm rounded-md border border-border bg-secondary/50 text-foreground p-2 focus:outline-none focus:ring-1 focus:ring-mine-cyan"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(a.id)}
                          disabled={busyId === a.id || !draft.trim()}
                          className="text-xs px-2.5 py-1 rounded-md bg-mine-cyan text-background font-medium disabled:opacity-50"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground leading-snug">{a.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Сегодня, {formatTime(a.created_at)}
                      </p>
                    </>
                  )}
                </div>
                {isAdmin && editId !== a.id && (
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditId(a.id); setDraft(a.description); }}
                      disabled={busyId === a.id}
                      title="Редактировать"
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-mine-cyan"
                    >
                      <Icon name="Pencil" size={13} />
                    </button>
                    <button
                      onClick={() => hide(a.id)}
                      disabled={busyId === a.id}
                      title="Убрать из ленты"
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-mine-red"
                    >
                      <Icon name={busyId === a.id ? "Loader2" : "Trash2"} size={13} className={busyId === a.id ? "animate-spin" : ""} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { eventsApi } from "@/lib/api";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  person_name?: string;
  person_code?: string;
  is_read: boolean;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  operator: "Оператор",
  medic: "Медик",
  dispatcher: "Диспетчер",
  doctor: "Врач",
  worker: "Сотрудник",
  aho_specialist: "Специалист АХО",
  security: "СБ",
};

const typeIcons: Record<string, { icon: string; color: string }> = {
  medical_deny: { icon: "ShieldAlert", color: "text-mine-red" },
  medical_pass: { icon: "CheckCircle2", color: "text-mine-green" },
  medical_change: { icon: "HeartPulse", color: "text-mine-amber" },
  medical_reset: { icon: "RefreshCw", color: "text-mine-cyan" },
};

function useLiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const date = now.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    weekday: "short",
  });

  return { time, date };
}

function formatAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "только что";
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  } catch {
    return "—";
  }
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const { time, date } = useLiveClock();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user?.full_name || user?.email || "Оператор";
  const displayRole = user?.role ? (roleLabels[user.role] || user.role) : "Смена А";

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await eventsApi.getNotifications();
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleMarkRead = async (id: number) => {
    try {
      await eventsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await eventsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border">
          <Icon name="Clock" size={14} className="text-mine-cyan" />
          <span className="text-sm font-mono font-semibold text-foreground tabular-nums">{time}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">{date}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mine-green/10 border border-mine-green/20">
          <span className="w-2 h-2 rounded-full bg-mine-green animate-pulse-glow" />
          <span className="text-xs text-mine-green font-medium">
            Система активна
          </span>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
            className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <Icon name="Bell" size={20} className={unread > 0 ? "text-mine-amber" : "text-muted-foreground"} />
            {unread > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center bg-mine-red text-white text-[10px] p-0">
                {unread > 99 ? "99+" : unread}
              </Badge>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 max-h-[420px] rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-fade-in z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">Уведомления</span>
                {unread > 0 && (
                  <Button size="sm" variant="ghost" className="text-xs text-mine-cyan h-7 px-2" onClick={handleMarkAllRead}>
                    Прочитать все
                  </Button>
                )}
              </div>
              <div className="overflow-y-auto max-h-[360px] divide-y divide-border/50">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Icon name="BellOff" size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Нет уведомлений</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const ti = typeIcons[n.type] || { icon: "Bell", color: "text-muted-foreground" };
                    return (
                      <button
                        key={n.id}
                        onClick={() => { if (!n.is_read) handleMarkRead(n.id); }}
                        className={`w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors flex gap-3 ${!n.is_read ? "bg-primary/5" : ""}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type === "medical_deny" ? "bg-mine-red/10" : "bg-secondary"}`}>
                          <Icon name={ti.icon} size={16} className={ti.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-medium truncate ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                              {n.title}
                            </p>
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-mine-cyan flex-shrink-0" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{formatAgo(n.created_at)}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Icon name="User" size={16} className="text-primary" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">
              {displayRole}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
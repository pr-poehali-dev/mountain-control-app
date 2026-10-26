import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authApi } from "@/lib/api";
import { playAlarm } from "@/lib/sounds";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PendingUser {
  id: number;
  full_name: string;
  email: string;
  position: string;
  department: string;
  organization: string;
  created_at: string;
}

const POLL_MS = 20000;
const SOUND_MS = 8000;

export const notifyAccessChanged = () => window.dispatchEvent(new Event("pending-access-check"));

function when(iso: string) {
  try {
    const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function PendingAccessAlert() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" && localStorage.getItem("mc_demo") !== "true";
  const [items, setItems] = useState<PendingUser[]>([]);
  const [roles, setRoles] = useState<{ key: string; label: string }[]>([]);
  const [roleFor, setRoleFor] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const soundTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const d = await authApi.getPendingAccess();
      const list: PendingUser[] = d.items || [];
      setItems((prev) => {
        if (list.some((u) => !prev.some((p) => p.id === u.id))) {
          setCollapsed(false);
          setMuted(false);
        }
        return list;
      });
      setRoles(d.roles || []);
    } catch {
      /* ignore */
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const h = () => load();
    window.addEventListener("pending-access-check", h);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("pending-access-check", h);
    };
  }, [isAdmin, load]);

  const active = items.length > 0 && !muted;

  useEffect(() => {
    const stop = () => {
      if (soundTimer.current) {
        window.clearInterval(soundTimer.current);
        soundTimer.current = null;
      }
    };
    if (active) {
      playAlarm(1);
      stop();
      soundTimer.current = window.setInterval(() => playAlarm(1), SOUND_MS);
    } else {
      stop();
    }
    return stop;
  }, [active, items.length]);

  const grant = async (u: PendingUser) => {
    setBusy(u.id);
    try {
      await authApi.grantAccess(u.id, true, roleFor[u.id]);
      toast({ title: "Допуск выдан", description: `${u.full_name} может работать в системе` });
      setItems((list) => list.filter((x) => x.id !== u.id));
      window.dispatchEvent(new Event("users-changed"));
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (ids: number[]) => {
    try {
      await authApi.accessAlertOff(ids);
      setItems((list) => list.filter((x) => !ids.includes(x.id)));
      toast({ title: "Уведомление выключено", description: "Пользователь останется в режиме просмотра — допуск можно дать в разделе «Админ»" });
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  if (!isAdmin || items.length === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full bg-mine-amber text-black px-4 py-2.5 shadow-xl shadow-mine-amber/30 animate-pulse"
      >
        <Icon name="UserPlus" size={18} />
        <span className="text-sm font-semibold">Ждут допуска: {items.length}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[min(420px,calc(100vw-2.5rem))] rounded-2xl border-2 border-mine-amber bg-card shadow-2xl shadow-mine-amber/20 overflow-hidden animate-fade-in">
      <div className="bg-mine-amber px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center animate-pulse">
          <Icon name="BellRing" size={20} className="text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-black font-bold leading-tight">
            {items.length === 1 ? "Новый пользователь ждёт допуска" : `Ждут допуска: ${items.length}`}
          </p>
          <p className="text-black/70 text-[11px]">Сейчас они в режиме просмотра без реальных данных</p>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          className="p-1.5 rounded-md hover:bg-black/10 text-black"
          title={muted ? "Включить звук" : "Выключить звук до появления новых заявок"}
        >
          <Icon name={muted ? "VolumeX" : "Volume2"} size={16} />
        </button>
        <button onClick={() => { setCollapsed(true); setMuted(true); }} className="p-1.5 rounded-md hover:bg-black/10 text-black" title="Свернуть">
          <Icon name="Minus" size={16} />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
        {items.map((u) => (
          <div key={u.id} className="p-4 space-y-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground">{u.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {[u.position, u.department, u.organization].filter(Boolean).join(" · ") || "Данные о работе не указаны"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {u.email} · зарегистрирован {when(u.created_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={roleFor[u.id] || ""} onValueChange={(v) => setRoleFor((r) => ({ ...r, [u.id]: v }))}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Роль (оставить как есть)" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.key} value={r.key} className="text-xs">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 gap-1 bg-mine-green text-white hover:bg-mine-green/90"
                onClick={() => grant(u)}
                disabled={busy === u.id}
              >
                <Icon name={busy === u.id ? "Loader2" : "ShieldCheck"} size={14} className={busy === u.id ? "animate-spin" : ""} />
                Дать допуск
              </Button>
            </div>
            <button
              onClick={() => dismiss([u.id])}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Выключить уведомление — оставить в режиме просмотра
            </button>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="px-4 py-2 border-t border-border bg-secondary/30 flex justify-end">
          <button onClick={() => dismiss(items.map((i) => i.id))} className="text-[11px] text-muted-foreground hover:text-foreground">
            Выключить все уведомления
          </button>
        </div>
      )}
    </div>
  );
}

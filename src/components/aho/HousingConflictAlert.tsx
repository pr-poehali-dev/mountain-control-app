import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { ahoApi } from "@/lib/api";
import { playAlarm } from "@/lib/sounds";
import { useAuth } from "@/contexts/AuthContext";
import RoomSuggestDialog from "./RoomSuggestDialog";

interface Conflict {
  id: number;
  created_at: string;
  room_number: string;
  building_name: string;
  owner: { personnel_id: number; full_name: string; organization: string };
  temp: { personnel_id: number; full_name: string; organization: string; housed_at: string | null };
}

const SEEN_KEY = "mc_conflicts_seen";
const POLL_MS = 20000;

const getSeen = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
};

export const notifyHousingChanged = () => window.dispatchEvent(new Event("housing-changed"));

export const triggerConflictCheck = () => window.dispatchEvent(new Event("housing-conflict-check"));

export default function HousingConflictAlert() {
  const { user, allowedPages } = useAuth();
  const allowed = !!user && (user.role === "admin" || allowedPages.includes("aho") || allowedPages.includes("checkpoint"));
  const [queue, setQueue] = useState<Conflict[]>([]);
  const [move, setMove] = useState<{ personnel_id: number; full_name: string } | null>(null);
  const alarmTimer = useRef<number | null>(null);

  const stopAlarm = () => {
    if (alarmTimer.current) {
      window.clearInterval(alarmTimer.current);
      alarmTimer.current = null;
    }
  };

  const check = useCallback(async () => {
    if (!allowed || localStorage.getItem("mc_demo") === "true") return;
    try {
      const d = await ahoApi.getHousingConflicts();
      const seen = getSeen();
      const open: Conflict[] = d.items || [];
      const fresh = open.filter((c) => !seen.includes(c.id));
      setQueue((prev) => {
        const ids = new Set(open.map((c) => c.id));
        const kept = prev.filter((c) => ids.has(c.id));
        const add = fresh.filter((c) => !kept.some((k) => k.id === c.id));
        return [...kept, ...add];
      });
    } catch {
      /* ignore */
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    check();
    const t = window.setInterval(check, POLL_MS);
    const h = () => check();
    window.addEventListener("housing-conflict-check", h);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("housing-conflict-check", h);
    };
  }, [allowed, check]);

  const current = queue[0];

  useEffect(() => {
    if (current && !move) {
      playAlarm(2);
      stopAlarm();
      alarmTimer.current = window.setInterval(() => playAlarm(2), 6000);
    } else {
      stopAlarm();
    }
    return stopAlarm;
  }, [current?.id, move]);

  const acknowledge = (id: number) => {
    const seen = getSeen();
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.filter((x) => x !== id), id].slice(-200)));
    setQueue((q) => q.filter((c) => c.id !== id));
  };

  const resolve = async (id: number) => {
    await ahoApi.resolveConflict(id).catch(() => {});
    acknowledge(id);
    notifyHousingChanged();
  };

  if (!current) return null;

  return (
    <>
      {!move && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border-2 border-mine-red bg-card shadow-2xl shadow-mine-red/30 overflow-hidden">
            <div className="bg-mine-red px-5 py-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <Icon name="BellRing" size={24} className="text-white" />
              </div>
              <div>
                <p className="text-white text-lg font-bold leading-tight">Вернулся бывший жилец</p>
                <p className="text-white/85 text-xs">Место занято временным жильцом — нужно переселить одного из них</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-secondary/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Комната</p>
                <p className="text-xl font-bold text-foreground">
                  {current.building_name}, комн. {current.room_number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-mine-green/40 bg-mine-green/5 p-3">
                  <p className="text-[11px] text-mine-green font-semibold uppercase tracking-wide">Хозяин места</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{current.owner.full_name}</p>
                  <p className="text-xs text-muted-foreground">{current.owner.organization || "—"}</p>
                  <p className="text-[11px] text-mine-green mt-1">прошёл КПП</p>
                </div>
                <div className="rounded-xl border border-mine-amber/40 bg-mine-amber/5 p-3">
                  <p className="text-[11px] text-mine-amber font-semibold uppercase tracking-wide">Временный жилец</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{current.temp.full_name}</p>
                  <p className="text-xs text-muted-foreground">{current.temp.organization || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  className="gap-1.5 bg-mine-amber text-black hover:bg-mine-amber/90"
                  onClick={() => setMove({ personnel_id: current.temp.personnel_id, full_name: current.temp.full_name })}
                >
                  <Icon name="ArrowRightLeft" size={16} />
                  Переселить временного
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setMove({ personnel_id: current.owner.personnel_id, full_name: current.owner.full_name })}
                >
                  <Icon name="ArrowRightLeft" size={16} />
                  Переселить хозяина
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={() => acknowledge(current.id)}>
                  Решу позже
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={() => resolve(current.id)}>
                  Оставить обоих
                </Button>
              </div>
              {queue.length > 1 && <p className="text-center text-[11px] text-mine-red">Ещё конфликтов: {queue.length - 1}</p>}
            </div>
          </div>
        </div>
      )}

      <RoomSuggestDialog
        person={move}
        onClose={() => setMove(null)}
        onAssigned={() => {
          acknowledge(current.id);
          check();
          notifyHousingChanged();
        }}
      />
    </>
  );
}

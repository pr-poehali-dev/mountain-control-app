import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import { useState, useEffect, useCallback } from "react";
import { dispatcherApi, lampRoomApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface ChatMessage {
  id: number;
  sender_name: string;
  sender_role: string;
  message: string;
  is_urgent: boolean;
  created_at: string;
}

interface LampStats {
  active: number;
  lanterns_out: number;
  rescuers_out: number;
  today_issued: number;
  today_returned: number;
  today_denied: number;
}

interface DetailItem {
  id: number;
  person_code: string;
  person_name: string;
  lantern_number?: string;
  rescuer_number?: string;
  time?: string;
  issued_by?: string;
  tabular_number?: string;
  position?: string;
  department?: string;
  organization?: string;
  reason?: string;
  denied_at?: string;
  denied_by?: string;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

const detailTitles: Record<string, string> = {
  active: "Выдано сейчас",
  lanterns_out: "Фонарей выдано",
  rescuers_out: "Самоспасателей выдано",
  today_issued: "Выдано за день",
  today_returned: "Возвращено за день",
  today_denied: "Недопуски за день",
};

const detailIcons: Record<string, string> = {
  active: "Package",
  lanterns_out: "Flashlight",
  rescuers_out: "Shield",
  today_issued: "ArrowUpRight",
  today_returned: "ArrowDownLeft",
  today_denied: "Ban",
};

const detailColors: Record<string, string> = {
  active: "text-mine-cyan",
  lanterns_out: "text-mine-amber",
  rescuers_out: "text-indigo-400",
  today_issued: "text-mine-green",
  today_returned: "text-blue-400",
  today_denied: "text-mine-red",
};

const Dispatcher = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<LampStats>({ active: 0, lanterns_out: 0, rescuers_out: 0, today_issued: 0, today_returned: 0, today_denied: 0 });
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [msgUrgent, setMsgUrgent] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);

  const [detailType, setDetailType] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDenialDetail, setIsDenialDetail] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, msgsRes] = await Promise.all([
        lampRoomApi.getStats(),
        dispatcherApi.getMessages(),
      ]);
      setStats(statsRes);
      setMessages(msgsRes.messages || []);
    } catch { /* ignore */ 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setMsgLoading(true);
    try {
      await dispatcherApi.sendMessage(
        user?.full_name || "Диспетчер",
        newMsg.trim(),
        msgUrgent
      );
      setNewMsg("");
      setMsgUrgent(false);
      const data = await dispatcherApi.getMessages();
      setMessages(data.messages || []);
    } catch { /* ignore */ 
    } finally {
      setMsgLoading(false);
    }
  };

  const openDetail = async (type: string) => {
    setDetailType(type);
    setDetailLoading(true);
    setDetailItems([]);
    setIsDenialDetail(type === "today_denied");
    try {
      const data = await lampRoomApi.getDetail(type);
      setDetailItems(data.items || []);
    } catch { /* ignore */ 
    } finally {
      setDetailLoading(false);
    }
  };

  const statCards = [
    { key: "active", label: "Выдано сейчас", value: stats.active, icon: "Package", color: "mine-cyan" },
    { key: "lanterns_out", label: "Фонарей выдано", value: stats.lanterns_out, icon: "Flashlight", color: "mine-amber" },
    { key: "rescuers_out", label: "СС выдано", value: stats.rescuers_out, icon: "Shield", color: "indigo-400" },
    { key: "today_issued", label: "Выдано за день", value: stats.today_issued, icon: "ArrowUpRight", color: "mine-green" },
    { key: "today_returned", label: "Возвращено за день", value: stats.today_returned, icon: "ArrowDownLeft", color: "blue-400" },
    { key: "today_denied", label: "Недопусков", value: stats.today_denied, icon: "Ban", color: "mine-red" },
  ];

  return (
    <AppLayout title="Диспетчерская служба" subtitle="Контроль ламповой, связь с персоналом">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((s) => (
              <button
                key={s.key}
                onClick={() => openDetail(s.key)}
                className={`rounded-xl border border-${s.color}/20 bg-${s.color}/5 p-4 text-left hover:border-${s.color}/40 hover:shadow-lg hover:shadow-${s.color}/5 transition-all cursor-pointer group`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={s.icon} size={16} className={`text-${s.color}`} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Нажмите для деталей →
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" className="gap-2 bg-mine-amber hover:bg-mine-amber/90 text-black h-9" onClick={() => navigate("/lampa")}>
            <Icon name="Lightbulb" size={14} />
            Перейти в Ламповую
          </Button>
          <Button size="sm" variant="outline" className="gap-2 h-9" onClick={fetchData}>
            <Icon name="RefreshCw" size={14} />
            Обновить
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ maxHeight: 520 }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Icon name="MessageSquare" size={16} className="text-mine-cyan" />
              <span className="text-sm font-semibold text-foreground">Связь с диспетчером</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: 200 }}>
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <Icon name="MessageSquare" size={28} className="text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Нет сообщений</p>
                </div>
              ) : (
                [...messages].reverse().map((m) => (
                  <div key={m.id} className={`rounded-lg p-2.5 ${m.is_urgent ? "bg-mine-red/10 border border-mine-red/20" : "bg-secondary/50"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{m.sender_name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(m.created_at)}</span>
                    </div>
                    <p className={`text-xs ${m.is_urgent ? "text-mine-red font-medium" : "text-muted-foreground"}`}>
                      {m.is_urgent && <Icon name="AlertTriangle" size={12} className="inline mr-1 text-mine-red" />}
                      {m.message}
                    </p>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendMsg} className="border-t border-border p-3 space-y-2">
              <Input
                placeholder="Сообщение..."
                className="bg-secondary/50 h-9 text-sm"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMsgUrgent(!msgUrgent)}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${msgUrgent ? "bg-mine-red/20 border-mine-red/40 text-mine-red" : "border-border text-muted-foreground hover:border-mine-red/30"}`}
                >
                  Срочное
                </button>
                <div className="flex-1" />
                <Button size="sm" type="submit" className="h-7 gap-1.5 bg-mine-cyan hover:bg-mine-cyan/90 text-white text-xs" disabled={!newMsg.trim() || msgLoading}>
                  <Icon name="Send" size={12} />
                  {msgLoading ? "..." : "Отправить"}
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Info" size={16} className="text-mine-cyan" />
              <span className="text-sm font-semibold text-foreground">Быстрый доступ</span>
            </div>
            <div className="space-y-2">
              {statCards.map((s) => (
                <button
                  key={s.key}
                  onClick={() => openDetail(s.key)}
                  className="w-full flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <Icon name={s.icon} size={18} className={`text-${s.color}`} />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{s.label}</p>
                  </div>
                  <span className={`text-lg font-bold font-mono text-${s.color}`}>{s.value}</span>
                  <Icon name="ChevronRight" size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={detailType !== null} onOpenChange={(open) => !open && setDetailType(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name={detailIcons[detailType || ""] || "List"} size={18} className={detailColors[detailType || ""] || ""} />
              {detailTitles[detailType || ""] || "Детали"}
              <Badge variant="outline" className="ml-2 text-xs">{detailItems.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
              </div>
            ) : detailItems.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="Inbox" size={32} className="text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Нет записей</p>
              </div>
            ) : isDenialDetail ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Время", "Код", "Таб.№", "ФИО", "Причина", "Кто оформил"].map((h) => (
                      <th key={h} className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatDateTime(d.denied_at)}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-foreground">{d.person_code}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{d.tabular_number || "—"}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-foreground">{d.person_name}</td>
                      <td className="px-3 py-2.5 text-sm text-mine-red">{d.reason}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.denied_by || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Время", "Код", "Таб.№", "ФИО", "Должность", "Подразделение", "Фонарь", "СС", "Кто выдал"].map((h) => (
                      <th key={h} className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatDateTime(d.time)}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-foreground">{d.person_code}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{d.tabular_number || "—"}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-foreground">{d.person_name}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.position || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.department || d.organization || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-mine-amber">{d.lantern_number || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-indigo-400">{d.rescuer_number || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.issued_by || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Dispatcher;
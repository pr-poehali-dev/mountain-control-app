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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import QrScanner from "@/components/scanner/QrScanner";
import { useState, useEffect, useCallback } from "react";
import { dispatcherApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { playSuccess, playDenied, playScan } from "@/lib/sounds";

const statusLabels: Record<string, string> = {
  issued: "выдан",
  available: "свободен",
  charging: "на зарядке",
  missing: "не возвращён",
};

const statusColors: Record<string, string> = {
  выдан: "bg-mine-green/20 text-mine-green border-mine-green/30",
  свободен: "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "на зарядке": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
  "не возвращён": "bg-mine-red/20 text-mine-red border-mine-red/30",
};

interface LanternItem {
  id: number;
  lantern_number: string;
  rescuer_number?: string;
  person_name?: string;
  person_code?: string;
  department?: string;
  status: string;
  issued_at?: string;
  returned_at?: string;
  condition?: string;
}

interface AvailableLantern {
  id: number;
  lantern_number: string;
  rescuer_number: string;
  condition: string;
}

interface PersonResult {
  id: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  medical_status: string;
  current_lantern?: string;
}

interface ChatMessage {
  id: number;
  sender_name: string;
  sender_role: string;
  message: string;
  is_urgent: boolean;
  created_at: string;
}

interface Stats {
  total?: number;
  issued?: number;
  available?: number;
  charging?: number;
  missing?: number;
  on_site?: number;
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

const Dispatcher = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [lanterns, setLanterns] = useState<LanternItem[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const [showIssue, setShowIssue] = useState(false);
  const [availableLanterns, setAvailableLanterns] = useState<AvailableLantern[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [selectedLantern, setSelectedLantern] = useState<number | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueMsg, setIssueMsg] = useState("");
  const [issueError, setIssueError] = useState("");
  const [qrScanning, setQrScanning] = useState(false);

  const [showReturn, setShowReturn] = useState<LanternItem | null>(null);
  const [returnCondition, setReturnCondition] = useState("normal");
  const [returnLoading, setReturnLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [msgUrgent, setMsgUrgent] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const p: Record<string, string> = {};
      if (filterStatus !== "all") p.status = filterStatus;
      const [lanternsRes, statsRes, msgsRes] = await Promise.all([
        dispatcherApi.getLanterns(p),
        dispatcherApi.getStats(),
        dispatcherApi.getMessages(),
      ]);
      setLanterns(lanternsRes.lanterns || []);
      setStats(statsRes);
      setMessages(msgsRes.messages || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearchPerson = async (q: string) => {
    setPersonSearch(q);
    if (q.trim().length < 2) {
      setPersonResults([]);
      return;
    }
    try {
      const data = await dispatcherApi.searchPerson(q.trim());
      setPersonResults(data.results || []);
    } catch {
      setPersonResults([]);
    }
  };

  const openIssue = async () => {
    setShowIssue(true);
    setPersonSearch("");
    setPersonResults([]);
    setSelectedPerson(null);
    setSelectedLantern(null);
    setIssueMsg("");
    setIssueError("");
    try {
      const data = await dispatcherApi.getAvailable();
      setAvailableLanterns(data.lanterns || []);
    } catch {
      setAvailableLanterns([]);
    }
  };

  const handleIssue = async () => {
    if (!selectedLantern || !selectedPerson) return;
    setIssueLoading(true);
    setIssueError("");
    setIssueMsg("");
    try {
      const data = await dispatcherApi.issue(selectedLantern, selectedPerson.id);
      setIssueMsg(data.message);
      playSuccess();
      fetchData();
    } catch (err: unknown) {
      playDenied();
      setIssueError(err instanceof Error ? err.message : "Ошибка выдачи");
    } finally {
      setIssueLoading(false);
    }
  };

  const handleQrScan = useCallback(async (code: string) => {
    if (issueLoading) return;
    playScan();
    setQrScanning(false);
    setIssueError("");
    setIssueMsg("");

    if (!selectedLantern) {
      setIssueError("Сначала выберите комплект (фонарь + самоспасатель)");
      playDenied();
      return;
    }

    setIssueLoading(true);
    try {
      const data = await dispatcherApi.issueByCode(code, selectedLantern);
      setIssueMsg(data.message);
      playSuccess();
      fetchData();
      const avData = await dispatcherApi.getAvailable();
      setAvailableLanterns(avData.lanterns || []);
      setSelectedLantern(null);
    } catch (err: unknown) {
      playDenied();
      setIssueError(err instanceof Error ? err.message : "Ошибка выдачи");
    } finally {
      setIssueLoading(false);
    }
  }, [issueLoading, selectedLantern, fetchData]);

  const handleReturn = async () => {
    if (!showReturn) return;
    setReturnLoading(true);
    try {
      await dispatcherApi.returnLantern(showReturn.id, returnCondition);
      playSuccess();
      setShowReturn(null);
      fetchData();
    } catch (err: unknown) {
      playDenied();
      setError(err instanceof Error ? err.message : "Ошибка возврата");
    } finally {
      setReturnLoading(false);
    }
  };

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
    } catch {
      // ignore
    } finally {
      setMsgLoading(false);
    }
  };

  const filtered = lanterns.filter(
    (l) =>
      (l.lantern_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.rescuer_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.person_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.person_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout
      title="Диспетчерская служба"
      subtitle="Выдача фонарей и самоспасателей, связь с персоналом"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Выдано", value: stats.issued ?? 0, icon: "Flashlight", color: "mine-green" },
            { label: "На зарядке", value: stats.charging ?? 0, icon: "BatteryCharging", color: "mine-amber" },
            { label: "Свободно", value: stats.available ?? 0, icon: "Package", color: "mine-cyan" },
            { label: "Не возвращены", value: stats.missing ?? 0, icon: "AlertTriangle", color: "mine-red" },
            { label: "На объекте", value: stats.on_site ?? 0, icon: "Users", color: "mine-cyan" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-${s.color}/20 bg-${s.color}/5 p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon name={s.icon} size={16} className={`text-${s.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру или ФИО..."
                  className="pl-9 bg-card border-border h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36 h-9 bg-card text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="issued">Выданные</SelectItem>
                  <SelectItem value="available">Свободные</SelectItem>
                  <SelectItem value="charging">На зарядке</SelectItem>
                  <SelectItem value="missing">Не возвращены</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="gap-2 bg-mine-green text-white hover:bg-mine-green/90 h-9" onClick={openIssue}>
                <Icon name="ArrowDownToLine" size={14} />
                Выдать
              </Button>
              <Button size="sm" variant="outline" className="gap-2 h-9" onClick={fetchData}>
                <Icon name="RefreshCw" size={14} />
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-mine-red/10 border border-mine-red/20">
                <Icon name="AlertTriangle" size={16} className="text-mine-red" />
                <p className="text-sm text-mine-red">{error}</p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {["Фонарь", "Самоспасатель", "Сотрудник", "Подразделение", "Статус", "Время", ""].map((h) => (
                          <th key={h} className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((l, i) => {
                        const st = statusLabels[l.status] || l.status;
                        return (
                          <tr
                            key={l.id}
                            className={`border-b border-border/50 hover:bg-secondary/50 transition-colors animate-fade-in ${st === "не возвращён" ? "bg-mine-red/5" : ""}`}
                            style={{ animationDelay: `${i * 30}ms` }}
                          >
                            <td className="px-3 py-3">
                              <code className="text-xs text-mine-amber font-mono bg-mine-amber/10 px-1.5 py-0.5 rounded">{l.lantern_number}</code>
                            </td>
                            <td className="px-3 py-3">
                              <code className="text-xs text-muted-foreground font-mono">{l.rescuer_number || "—"}</code>
                            </td>
                            <td className="px-3 py-3">
                              {l.person_name ? (
                                <div>
                                  <p className="text-sm font-medium text-foreground">{l.person_name}</p>
                                  <code className="text-[10px] text-mine-cyan font-mono">{l.person_code}</code>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground">{l.department || "—"}</td>
                            <td className="px-3 py-3">
                              <Badge variant="outline" className={`text-[10px] ${statusColors[st] || ""}`}>{st}</Badge>
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
                              {l.status === "issued" ? formatTime(l.issued_at) : formatTime(l.returned_at)}
                            </td>
                            <td className="px-3 py-3">
                              {l.status === "issued" && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-mine-cyan hover:bg-mine-cyan/10" onClick={() => { setShowReturn(l); setReturnCondition("normal"); }}>
                                  Принять
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && !loading && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Нет записей</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
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
          </div>
        </div>
      </div>

      <Dialog open={showIssue} onOpenChange={(v) => { setShowIssue(v); if (!v) setQrScanning(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="ArrowDownToLine" size={18} className="text-mine-green" />
              Выдача фонаря и самоспасателя
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">1. Выберите комплект</label>
              <Select value={selectedLantern ? String(selectedLantern) : ""} onValueChange={(v) => setSelectedLantern(Number(v))}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Выберите комплект" />
                </SelectTrigger>
                <SelectContent>
                  {availableLanterns.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.lantern_number} + {l.rescuer_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableLanterns.length === 0 && (
                <p className="text-[10px] text-mine-red mt-1">Нет доступных комплектов</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <label className="text-xs text-muted-foreground mb-2 block">2. Сканируйте QR сотрудника или найдите вручную</label>
              <QrScanner onScan={handleQrScan} active={qrScanning} onToggle={setQrScanning} />
            </div>

            {!qrScanning && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground">или найдите вручную</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <Input
                  placeholder="ФИО или код..."
                  className="bg-secondary/50"
                  value={personSearch}
                  onChange={(e) => handleSearchPerson(e.target.value)}
                />
                {personResults.length > 0 && !selectedPerson && (
                  <div className="mt-2 rounded-lg border border-border divide-y divide-border/50 max-h-40 overflow-y-auto">
                    {personResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPerson(p); setPersonResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground">{p.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px] text-mine-cyan font-mono">{p.personal_code}</code>
                          <span className="text-[10px] text-muted-foreground">{p.department}</span>
                          {p.medical_status !== "passed" && (
                            <Badge variant="outline" className="text-[9px] bg-mine-red/20 text-mine-red border-mine-red/30 py-0">
                              медосмотр не пройден
                            </Badge>
                          )}
                          {p.current_lantern && (
                            <Badge variant="outline" className="text-[9px] bg-mine-amber/20 text-mine-amber border-mine-amber/30 py-0">
                              уже есть: {p.current_lantern}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPerson && (
                  <div className="mt-2 rounded-lg border border-mine-green/20 bg-mine-green/5 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedPerson.full_name}</p>
                      <code className="text-[10px] text-mine-cyan font-mono">{selectedPerson.personal_code}</code>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSelectedPerson(null); setPersonSearch(""); }}>
                      <Icon name="X" size={14} />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {issueMsg && (
              <div className="rounded-lg bg-mine-green/10 border border-mine-green/20 p-3">
                <p className="text-sm text-mine-green font-medium">{issueMsg}</p>
              </div>
            )}
            {issueError && (
              <div className="rounded-lg bg-mine-red/10 border border-mine-red/20 p-3">
                <p className="text-sm text-mine-red">{issueError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowIssue(false); setQrScanning(false); }}>Закрыть</Button>
              {!qrScanning && selectedPerson && (
                <Button
                  className="flex-1 gap-2 bg-mine-green hover:bg-mine-green/90 text-white"
                  disabled={!selectedPerson || !selectedLantern || issueLoading}
                  onClick={handleIssue}
                >
                  <Icon name="CheckCircle2" size={14} />
                  {issueLoading ? "Выдаю..." : "Выдать"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showReturn} onOpenChange={() => setShowReturn(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="ArrowUpFromLine" size={18} className="text-mine-cyan" />
              Приём — {showReturn?.lantern_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {showReturn?.person_name && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-sm font-medium text-foreground">{showReturn.person_name}</p>
                <code className="text-[10px] text-mine-cyan font-mono">{showReturn.person_code}</code>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Состояние</label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Исправен — на зарядку</SelectItem>
                  <SelectItem value="damaged">Повреждён</SelectItem>
                  <SelectItem value="needs_repair">Требует ремонта</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowReturn(null)}>Отмена</Button>
              <Button
                className="flex-1 gap-2 bg-mine-cyan hover:bg-mine-cyan/90 text-white"
                disabled={returnLoading}
                onClick={handleReturn}
              >
                <Icon name="CheckCircle2" size={14} />
                {returnLoading ? "..." : "Принять"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Dispatcher;
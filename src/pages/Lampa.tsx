import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import QrScanner from "@/components/scanner/QrScanner";
import { lampRoomApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { playSuccess, playDenied, playScan } from "@/lib/sounds";

interface PersonInfo {
  id: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  medical_status: string;
  organization: string;
  category: string;
}

interface ActiveIssue {
  id: number;
  item_type: string;
  lantern_number: string;
  rescuer_number: string;
  issued_at: string;
}

interface IssueRecord {
  id: number;
  person_code: string;
  person_name: string;
  item_type: string;
  lantern_number: string;
  rescuer_number: string;
  status: string;
  issued_at: string;
  returned_at: string;
  condition: string;
  notes: string;
  issued_by: string;
}

interface DenialRecord {
  id: number;
  person_code: string;
  person_name: string;
  reason: string;
  denied_at: string;
  denied_by: string;
}

interface Stats {
  active: number;
  lanterns_out: number;
  rescuers_out: number;
  today_issued: number;
  today_returned: number;
  today_denied: number;
}

const itemTypeLabels: Record<string, string> = {
  lantern: "Фонарь",
  rescuer: "Самоспасатель",
  both: "Фонарь + СС",
};

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

const Lampa = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats>({ active: 0, lanterns_out: 0, rescuers_out: 0, today_issued: 0, today_returned: 0, today_denied: 0 });
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [denials, setDenials] = useState<DenialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"issues" | "denials">("issues");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<"issue" | "return">("issue");

  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [identifiedPerson, setIdentifiedPerson] = useState<PersonInfo | null>(null);
  const [activeIssues, setActiveIssues] = useState<ActiveIssue[]>([]);
  const [itemType, setItemType] = useState<string>("both");
  const [lanternNum, setLanternNum] = useState("");
  const [rescuerNum, setRescuerNum] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueMsg, setIssueMsg] = useState("");
  const [issueError, setIssueError] = useState("");

  const [manualCode, setManualCode] = useState("");
  const [manualSearching, setManualSearching] = useState(false);

  const [personSearch, setPersonSearch] = useState("");
  const [personResults, setPersonResults] = useState<PersonInfo[]>([]);

  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [denyPerson, setDenyPerson] = useState<PersonInfo | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [denyLoading, setDenyLoading] = useState(false);

  const [showReturnDialog, setShowReturnDialog] = useState<IssueRecord | null>(null);
  const [returnCondition, setReturnCondition] = useState("normal");
  const [returnLoading, setReturnLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const p: Record<string, string> = {};
      if (filterStatus !== "all") p.status = filterStatus;
      const [issuesRes, statsRes, denialsRes] = await Promise.all([
        lampRoomApi.getIssues(p),
        lampRoomApi.getStats(),
        lampRoomApi.getDenials(),
      ]);
      setIssues(issuesRes.issues || []);
      setStats(statsRes);
      setDenials(denialsRes.denials || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScan = useCallback(async (code: string) => {
    if (manualSearching) return;
    playScan();
    setScanning(false);
    setIssueError("");
    setIssueMsg("");

    setManualSearching(true);
    try {
      const data = await lampRoomApi.identify(code);
      setIdentifiedPerson(data.person);
      setActiveIssues(data.active_issues || []);

      if (scanMode === "return" && data.active_issues?.length > 0) {
        const firstIssue = data.active_issues[0];
        const mockRecord: IssueRecord = {
          id: firstIssue.id,
          person_code: data.person.personal_code,
          person_name: data.person.full_name,
          item_type: firstIssue.item_type,
          lantern_number: firstIssue.lantern_number,
          rescuer_number: firstIssue.rescuer_number,
          status: "issued",
          issued_at: firstIssue.issued_at,
          returned_at: "",
          condition: "",
          notes: "",
          issued_by: "",
        };
        setShowReturnDialog(mockRecord);
        setReturnCondition("normal");
      } else {
        setShowIssueDialog(true);
        setItemType("both");
        setLanternNum("");
        setRescuerNum("");
      }
      playSuccess();
    } catch (err: unknown) {
      playDenied();
      setError(err instanceof Error ? err.message : "Сотрудник не найден");
    } finally {
      setManualSearching(false);
    }
  }, [manualSearching, scanMode]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleScan(manualCode.trim());
    setManualCode("");
  };

  const handleSearchPerson = async (q: string) => {
    setPersonSearch(q);
    if (q.trim().length < 2) {
      setPersonResults([]);
      return;
    }
    try {
      const data = await lampRoomApi.search(q.trim());
      setPersonResults(data.results || []);
    } catch {
      setPersonResults([]);
    }
  };

  const selectPerson = async (p: PersonInfo) => {
    setPersonResults([]);
    setPersonSearch("");
    try {
      const data = await lampRoomApi.identify(p.personal_code);
      setIdentifiedPerson(data.person);
      setActiveIssues(data.active_issues || []);
      setShowIssueDialog(true);
      setItemType("both");
      setLanternNum("");
      setRescuerNum("");
      setIssueMsg("");
      setIssueError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка идентификации");
    }
  };

  const handleIssue = async () => {
    if (!identifiedPerson) return;
    setIssueLoading(true);
    setIssueError("");
    setIssueMsg("");

    try {
      const data = await lampRoomApi.issue({
        person_id: identifiedPerson.id,
        item_type: itemType,
        lantern_number: lanternNum,
        rescuer_number: rescuerNum,
        issued_by: user?.full_name || "",
      });
      setIssueMsg(data.message);
      playSuccess();
      fetchData();

      const updated = await lampRoomApi.identify(identifiedPerson.personal_code);
      setActiveIssues(updated.active_issues || []);
    } catch (err: unknown) {
      playDenied();
      setIssueError(err instanceof Error ? err.message : "Ошибка выдачи");
    } finally {
      setIssueLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!showReturnDialog) return;
    setReturnLoading(true);
    try {
      await lampRoomApi.returnItem(showReturnDialog.id, returnCondition);
      playSuccess();
      setShowReturnDialog(null);
      fetchData();
    } catch (err: unknown) {
      playDenied();
      setError(err instanceof Error ? err.message : "Ошибка приёма");
    } finally {
      setReturnLoading(false);
    }
  };

  const openDeny = (person?: PersonInfo | null) => {
    setDenyPerson(person || identifiedPerson || null);
    setDenyReason("");
    setShowDenyDialog(true);
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) return;
    setDenyLoading(true);
    try {
      await lampRoomApi.deny({
        person_id: denyPerson?.id,
        person_code: denyPerson?.personal_code || "—",
        person_name: denyPerson?.full_name || "Неизвестный",
        reason: denyReason,
        denied_by: user?.full_name || "",
      });
      playSuccess();
      setShowDenyDialog(false);
      setShowIssueDialog(false);
      fetchData();
    } catch (err: unknown) {
      playDenied();
      setError(err instanceof Error ? err.message : "Ошибка записи");
    } finally {
      setDenyLoading(false);
    }
  };

  const filteredIssues = issues.filter(
    (i) =>
      (i.person_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.person_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.lantern_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.rescuer_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredDenials = denials.filter(
    (d) =>
      (d.person_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.person_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.reason || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Ламповая" subtitle="Выдача и приём фонарей и самоспасателей">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Выдано сейчас", value: stats.active, icon: "Package", color: "text-mine-cyan" },
            { label: "Фонарей выдано", value: stats.lanterns_out, icon: "Flashlight", color: "text-mine-amber" },
            { label: "СС выдано", value: stats.rescuers_out, icon: "Shield", color: "text-indigo-400" },
            { label: "Выдано за день", value: stats.today_issued, icon: "ArrowUpRight", color: "text-mine-green" },
            { label: "Возвращено за день", value: stats.today_returned, icon: "ArrowDownLeft", color: "text-blue-400" },
            { label: "Недопусков", value: stats.today_denied, icon: "Ban", color: "text-mine-red" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name={s.icon} size={16} className={s.color} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground font-mono">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={scanMode === "issue" ? "default" : "outline"}
                    className={scanMode === "issue" ? "bg-mine-green text-white hover:bg-mine-green/90" : ""}
                    onClick={() => setScanMode("issue")}
                  >
                    <Icon name="ArrowUpRight" size={14} className="mr-1" />
                    Выдача
                  </Button>
                  <Button
                    size="sm"
                    variant={scanMode === "return" ? "default" : "outline"}
                    className={scanMode === "return" ? "bg-blue-500 text-white hover:bg-blue-500/90" : ""}
                    onClick={() => setScanMode("return")}
                  >
                    <Icon name="ArrowDownLeft" size={14} className="mr-1" />
                    Приём
                  </Button>
                </div>
              </div>

              <QrScanner onScan={handleScan} active={scanning} onToggle={setScanning} />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="Hash" size={16} className="text-mine-amber" />
                <span className="text-sm font-semibold text-foreground">Ввод кода вручную</span>
              </div>
              <form onSubmit={handleManualSearch} className="space-y-2">
                <Input
                  placeholder="МК-001"
                  className="bg-secondary/50 font-mono text-center h-12 tracking-widest"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                />
                <Button
                  type="submit"
                  className="w-full gap-2 bg-mine-amber hover:bg-mine-amber/90 text-black font-semibold"
                  disabled={!manualCode.trim() || manualSearching}
                >
                  <Icon name="Search" size={16} />
                  {manualSearching ? "Поиск..." : "Найти сотрудника"}
                </Button>
              </form>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="Users" size={16} className="text-mine-cyan" />
                <span className="text-sm font-semibold text-foreground">Поиск по ФИО</span>
              </div>
              <Input
                placeholder="Введите фамилию или имя..."
                value={personSearch}
                onChange={(e) => handleSearchPerson(e.target.value)}
                className="bg-secondary/50"
              />
              {personResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {personResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors"
                      onClick={() => selectPerson(p)}
                    >
                      <p className="text-sm font-medium text-foreground">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.personal_code} · {p.department || p.organization || "—"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full gap-2 border-mine-red/30 text-mine-red hover:bg-mine-red/10"
              onClick={() => openDeny(null)}
            >
              <Icon name="Ban" size={16} />
              Оформить недопуск
            </Button>
          </div>

          <div className="lg:col-span-2">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-mine-red/20 bg-mine-red/5 px-4 py-3 mb-4">
                <Icon name="AlertTriangle" size={16} className="text-mine-red" />
                <p className="text-sm text-mine-red">{error}</p>
                <Button size="sm" variant="ghost" className="ml-auto text-mine-red" onClick={() => setError("")}>
                  <Icon name="X" size={14} />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={tab === "issues" ? "default" : "outline"}
                  onClick={() => setTab("issues")}
                >
                  <Icon name="ClipboardList" size={14} className="mr-1" />
                  Журнал выдачи
                </Button>
                <Button
                  size="sm"
                  variant={tab === "denials" ? "default" : "outline"}
                  className={tab === "denials" ? "bg-mine-red text-white hover:bg-mine-red/90" : ""}
                  onClick={() => setTab("denials")}
                >
                  <Icon name="Ban" size={14} className="mr-1" />
                  Недопуски ({denials.length})
                </Button>
              </div>
              <div className="flex-1" />
              {tab === "issues" && (
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="issued">Выданы</SelectItem>
                    <SelectItem value="returned">Возвращены</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Input
                placeholder="Поиск..."
                className="w-[200px] h-8 text-xs bg-secondary/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : tab === "issues" ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {["Время", "Код", "ФИО", "Тип", "Фонарь", "СС", "Статус", "Возврат", "Состояние", ""].map((h) => (
                          <th key={h} className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map((r) => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="px-3 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {formatDateTime(r.issued_at)}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-foreground">{r.person_code}</td>
                          <td className="px-3 py-3 text-sm text-foreground font-medium max-w-[180px] truncate">{r.person_name}</td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {itemTypeLabels[r.item_type] || r.item_type}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-mine-amber">{r.lantern_number || "—"}</td>
                          <td className="px-3 py-3 text-xs font-mono text-indigo-400">{r.rescuer_number || "—"}</td>
                          <td className="px-3 py-3">
                            {r.status === "issued" ? (
                              <Badge className="text-[10px] bg-mine-green/20 text-mine-green border-mine-green/30">Выдано</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Возвращено</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {formatTime(r.returned_at)}
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{r.condition || "—"}</td>
                          <td className="px-3 py-3">
                            {r.status === "issued" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => { setShowReturnDialog(r); setReturnCondition("normal"); }}
                              >
                                <Icon name="ArrowDownLeft" size={12} />
                                Принять
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredIssues.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Нет записей о выдаче
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {["Время", "Код", "ФИО", "Причина", "Кто оформил"].map((h) => (
                          <th key={h} className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDenials.map((d) => (
                        <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="px-3 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {formatDateTime(d.denied_at)}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-foreground">{d.person_code}</td>
                          <td className="px-3 py-3 text-sm text-foreground font-medium">{d.person_name}</td>
                          <td className="px-3 py-3 text-sm text-mine-red">{d.reason}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{d.denied_by || "—"}</td>
                        </tr>
                      ))}
                      {filteredDenials.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Нет записей о недопусках
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Package" size={18} className="text-mine-green" />
              Выдача оборудования
            </DialogTitle>
          </DialogHeader>
          {identifiedPerson && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
                    <Icon name="User" size={20} className="text-mine-cyan" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{identifiedPerson.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {identifiedPerson.personal_code} · {identifiedPerson.department || identifiedPerson.organization}
                    </p>
                  </div>
                  <div className="ml-auto">
                    {identifiedPerson.medical_status === "passed" ? (
                      <Badge className="text-[10px] bg-mine-green/20 text-mine-green border-mine-green/30">
                        <Icon name="CheckCircle2" size={10} className="mr-1" />
                        Медосмотр
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] bg-mine-red/20 text-mine-red border-mine-red/30">
                        <Icon name="XCircle" size={10} className="mr-1" />
                        Не пройден
                      </Badge>
                    )}
                  </div>
                </div>

                {activeIssues.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground mb-1">Уже выдано:</p>
                    {activeIssues.map((ai) => (
                      <div key={ai.id} className="flex items-center gap-2 text-xs rounded-lg bg-mine-amber/10 px-3 py-2">
                        <Icon name="AlertTriangle" size={12} className="text-mine-amber" />
                        <span className="text-mine-amber">
                          {itemTypeLabels[ai.item_type]}: {ai.lantern_number || ""} {ai.rescuer_number || ""}
                        </span>
                        <span className="text-muted-foreground ml-auto">{formatTime(ai.issued_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Что выдаём</label>
                  <Select value={itemType} onValueChange={setItemType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Фонарь + Самоспасатель</SelectItem>
                      <SelectItem value="lantern">Только фонарь</SelectItem>
                      <SelectItem value="rescuer">Только самоспасатель</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(itemType === "lantern" || itemType === "both") && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Номер фонаря</label>
                    <Input
                      placeholder="Ф-001"
                      value={lanternNum}
                      onChange={(e) => setLanternNum(e.target.value.toUpperCase())}
                      className="font-mono"
                    />
                  </div>
                )}

                {(itemType === "rescuer" || itemType === "both") && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Номер самоспасателя</label>
                    <Input
                      placeholder="СС-001"
                      value={rescuerNum}
                      onChange={(e) => setRescuerNum(e.target.value.toUpperCase())}
                      className="font-mono"
                    />
                  </div>
                )}
              </div>

              {issueMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-mine-green/20 bg-mine-green/5 px-4 py-3">
                  <Icon name="CheckCircle2" size={16} className="text-mine-green" />
                  <p className="text-sm text-mine-green">{issueMsg}</p>
                </div>
              )}

              {issueError && (
                <div className="flex items-center gap-2 rounded-lg border border-mine-red/20 bg-mine-red/5 px-4 py-3">
                  <Icon name="AlertTriangle" size={16} className="text-mine-red" />
                  <p className="text-sm text-mine-red">{issueError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2 bg-mine-green text-white hover:bg-mine-green/90"
                  onClick={handleIssue}
                  disabled={issueLoading || identifiedPerson.medical_status !== "passed"}
                >
                  {issueLoading ? (
                    <Icon name="Loader2" size={16} className="animate-spin" />
                  ) : (
                    <Icon name="ArrowUpRight" size={16} />
                  )}
                  Выдать
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-mine-red/30 text-mine-red hover:bg-mine-red/10"
                  onClick={() => openDeny(identifiedPerson)}
                >
                  <Icon name="Ban" size={16} />
                  Недопуск
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnDialog !== null} onOpenChange={(open) => !open && setShowReturnDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="ArrowDownLeft" size={18} className="text-blue-400" />
              Приём оборудования
            </DialogTitle>
          </DialogHeader>
          {showReturnDialog && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-sm font-semibold text-foreground">{showReturnDialog.person_name}</p>
                <p className="text-xs text-muted-foreground mb-2">{showReturnDialog.person_code}</p>
                <div className="flex flex-wrap gap-2">
                  {showReturnDialog.lantern_number && (
                    <Badge variant="outline" className="text-xs text-mine-amber border-mine-amber/30">
                      <Icon name="Flashlight" size={10} className="mr-1" />
                      {showReturnDialog.lantern_number}
                    </Badge>
                  )}
                  {showReturnDialog.rescuer_number && (
                    <Badge variant="outline" className="text-xs text-indigo-400 border-indigo-500/30">
                      <Icon name="Shield" size={10} className="mr-1" />
                      {showReturnDialog.rescuer_number}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Выдано: {formatDateTime(showReturnDialog.issued_at)}
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Состояние при возврате</label>
                <Select value={returnCondition} onValueChange={setReturnCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Исправно</SelectItem>
                    <SelectItem value="damaged">Повреждено</SelectItem>
                    <SelectItem value="needs_repair">Требует ремонта</SelectItem>
                    <SelectItem value="needs_charging">Требует зарядки</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full gap-2 bg-blue-500 text-white hover:bg-blue-500/90"
                onClick={handleReturn}
                disabled={returnLoading}
              >
                {returnLoading ? (
                  <Icon name="Loader2" size={16} className="animate-spin" />
                ) : (
                  <Icon name="Check" size={16} />
                )}
                Принять
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Ban" size={18} className="text-mine-red" />
              Оформление недопуска
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {denyPerson ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-sm font-semibold text-foreground">{denyPerson.full_name}</p>
                <p className="text-xs text-muted-foreground">{denyPerson.personal_code} · {denyPerson.department}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Введите код или отсканируйте QR для идентификации</p>
                <Input
                  placeholder="Код сотрудника"
                  className="font-mono"
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setDenyPerson({ id: 0, personal_code: val, full_name: val, position: "", department: "", medical_status: "", organization: "", category: "" });
                  }}
                />
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Причина недопуска</label>
              <Textarea
                placeholder="Укажите причину..."
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              className="w-full gap-2 bg-mine-red text-white hover:bg-mine-red/90"
              onClick={handleDeny}
              disabled={denyLoading || !denyReason.trim()}
            >
              {denyLoading ? (
                <Icon name="Loader2" size={16} className="animate-spin" />
              ) : (
                <Icon name="Ban" size={16} />
              )}
              Оформить недопуск
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Lampa;

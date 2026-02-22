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
import { playSuccess, playDenied, playScan, playWarning } from "@/lib/sounds";

interface PersonInfo {
  id: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  medical_status: string;
  organization: string;
  category: string;
  tabular_number?: string;
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
  tabular_number?: string;
  position?: string;
  department?: string;
  organization?: string;
}

interface DenialRecord {
  id: number;
  person_code: string;
  person_name: string;
  reason: string;
  denied_at: string;
  denied_by: string;
  tabular_number?: string;
}

interface RepairItem {
  id: number;
  equipment_type: string;
  equipment_number: string;
  status: string;
  repair_reason: string;
  sent_to_repair_at: string;
  returned_from_repair_at: string;
  notes: string;
}

interface Stats {
  active: number;
  lanterns_out: number;
  rescuers_out: number;
  today_issued: number;
  today_returned: number;
  today_denied: number;
  total_lanterns: number;
  total_rescuers: number;
  lanterns_repair: number;
  rescuers_repair: number;
}

const itemTypeLabels: Record<string, string> = {
  lantern: "Фонарь",
  rescuer: "Самоспасатель",
  both: "Фонарь + СС",
};

const conditionLabels: Record<string, string> = {
  normal: "Исправно",
  damaged: "Повреждено",
  needs_repair: "Требует ремонта",
  needs_charging: "Требует зарядки",
};

const conditionColors: Record<string, string> = {
  normal: "text-mine-green",
  damaged: "text-mine-red",
  needs_repair: "text-mine-amber",
  needs_charging: "text-blue-400",
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

  const [stats, setStats] = useState<Stats>({ active: 0, lanterns_out: 0, rescuers_out: 0, today_issued: 0, today_returned: 0, today_denied: 0, total_lanterns: 300, total_rescuers: 300, lanterns_repair: 0, rescuers_repair: 0 });
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [denials, setDenials] = useState<DenialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"issues" | "denials" | "repairs">("issues");

  const [showSettings, setShowSettings] = useState(false);
  const [settingsLanterns, setSettingsLanterns] = useState("300");
  const [settingsRescuers, setSettingsRescuers] = useState("300");
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [showRepairDialog, setShowRepairDialog] = useState(false);
  const [repairType, setRepairType] = useState<string>("lantern");
  const [repairNumber, setRepairNumber] = useState("");
  const [repairReason, setRepairReason] = useState("");
  const [repairLoading, setRepairLoading] = useState(false);
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

  const [detailType, setDetailType] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDenialDetail, setIsDenialDetail] = useState(false);

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
      const [issuesRes, statsRes, denialsRes, repairsRes] = await Promise.all([
        lampRoomApi.getIssues(p),
        lampRoomApi.getStats(),
        lampRoomApi.getDenials(),
        lampRoomApi.getRepairs(),
      ]);
      setIssues(issuesRes.issues || []);
      setStats(statsRes);
      setDenials(denialsRes.denials || []);
      setRepairs(repairsRes.repairs || []);
      setSettingsLanterns(String(statsRes.total_lanterns || 300));
      setSettingsRescuers(String(statsRes.total_rescuers || 300));
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

      const hasActive = data.active_issues && data.active_issues.length > 0;

      if (scanMode === "return") {
        if (!hasActive) {
          playDenied();
          setError(`${data.person.full_name} (${data.person.personal_code}) — нет активных выдач, нечего принимать`);
          return;
        }
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
        playSuccess();
      } else {
        setLanternNum("");
        setRescuerNum("");
        setIssueMsg("");

        if (hasActive) {
          const hasLantern = data.active_issues.some((ai: ActiveIssue) =>
            ai.item_type === "lantern" || ai.item_type === "both"
          );
          const hasRescuer = data.active_issues.some((ai: ActiveIssue) =>
            ai.item_type === "rescuer" || ai.item_type === "both"
          );

          if (hasLantern && hasRescuer) {
            playDenied();
            const items = data.active_issues.map((ai: ActiveIssue) => {
              const parts = [];
              if (ai.lantern_number) parts.push(`Фонарь ${ai.lantern_number}`);
              if (ai.rescuer_number) parts.push(`СС ${ai.rescuer_number}`);
              return parts.join(" + ");
            }).join(", ");
            setShowIssueDialog(true);
            setItemType("both");
            setIssueError(`Уже выдано: ${items}. Повторная выдача невозможна — сначала примите оборудование.`);
          } else if (hasLantern) {
            playWarning();
            setShowIssueDialog(true);
            setItemType("rescuer");
            setIssueError("Фонарь уже выдан. Можно выдать только самоспасатель.");
          } else {
            playWarning();
            setShowIssueDialog(true);
            setItemType("lantern");
            setIssueError("Самоспасатель уже выдан. Можно выдать только фонарь.");
          }
        } else {
          setShowIssueDialog(true);
          setItemType("both");
          playSuccess();
        }
      }
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
      setLanternNum("");
      setRescuerNum("");
      setIssueMsg("");
      setIssueError("");

      const activeList = data.active_issues || [];
      const hasLantern = activeList.some((ai: ActiveIssue) => ai.item_type === "lantern" || ai.item_type === "both");
      const hasRescuer = activeList.some((ai: ActiveIssue) => ai.item_type === "rescuer" || ai.item_type === "both");

      if (hasLantern && hasRescuer) {
        const items = activeList.map((ai: ActiveIssue) => {
          const parts = [];
          if (ai.lantern_number) parts.push(`Фонарь ${ai.lantern_number}`);
          if (ai.rescuer_number) parts.push(`СС ${ai.rescuer_number}`);
          return parts.join(" + ");
        }).join(", ");
        setItemType("both");
        setIssueError(`Уже выдано: ${items}. Повторная выдача невозможна — сначала примите оборудование.`);
      } else if (hasLantern) {
        setItemType("rescuer");
        setIssueError("Фонарь уже выдан. Можно выдать только самоспасатель.");
      } else if (hasRescuer) {
        setItemType("lantern");
        setIssueError("Самоспасатель уже выдан. Можно выдать только фонарь.");
      } else {
        setItemType("both");
      }
      setShowIssueDialog(true);
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

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await lampRoomApi.saveSettings({
        total_lanterns: parseInt(settingsLanterns) || 300,
        total_rescuers: parseInt(settingsRescuers) || 300,
      });
      playSuccess();
      setShowSettings(false);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSendRepair = async () => {
    if (!repairNumber.trim() || !repairReason.trim()) return;
    setRepairLoading(true);
    try {
      await lampRoomApi.sendToRepair({
        equipment_type: repairType,
        equipment_number: repairNumber.trim(),
        repair_reason: repairReason.trim(),
      });
      playSuccess();
      setShowRepairDialog(false);
      setRepairNumber("");
      setRepairReason("");
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setRepairLoading(false);
    }
  };

  const handleReturnRepair = async (repairId: number) => {
    try {
      await lampRoomApi.returnFromRepair(repairId);
      playSuccess();
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const handleDecommission = async (repairId: number) => {
    const reason = prompt("Причина списания:");
    if (!reason) return;
    try {
      await lampRoomApi.decommission(repairId, reason);
      playSuccess();
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка списания");
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
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 flex-1">
            {[
              { key: "active", label: "Выдано сейчас", value: stats.active, icon: "Package", color: "mine-cyan", sub: "" },
              { key: "lanterns_out", label: "Фонарей выдано", value: stats.lanterns_out, icon: "Flashlight", color: "mine-amber", sub: `из ${stats.total_lanterns}` },
              { key: "rescuers_out", label: "СС выдано", value: stats.rescuers_out, icon: "Shield", color: "indigo-400", sub: `из ${stats.total_rescuers}` },
              { key: "today_issued", label: "За день выдано", value: stats.today_issued, icon: "ArrowUpRight", color: "mine-green", sub: "" },
              { key: "today_returned", label: "За день принято", value: stats.today_returned, icon: "ArrowDownLeft", color: "blue-400", sub: "" },
              { key: "today_denied", label: "Недопусков", value: stats.today_denied, icon: "Ban", color: "mine-red", sub: "" },
              { key: "lanterns_repair_card", label: "Фонарей в ремонте", value: stats.lanterns_repair, icon: "Wrench", color: "orange-400", sub: "" },
              { key: "rescuers_repair_card", label: "СС в ремонте", value: stats.rescuers_repair, icon: "Wrench", color: "orange-400", sub: "" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => s.key.includes("repair_card") ? setTab("repairs") : openDetail(s.key)}
                className={`rounded-xl border border-${s.color}/20 bg-${s.color}/5 p-3 text-left hover:border-${s.color}/40 hover:shadow-lg transition-all cursor-pointer group`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon name={s.icon} size={14} className={`text-${s.color}`} />
                  <span className="text-[10px] text-muted-foreground leading-tight">{s.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-foreground font-mono">{s.value}</p>
                  {s.sub && <span className="text-[10px] text-muted-foreground">{s.sub}</span>}
                </div>
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-3 h-9 gap-1.5 shrink-0"
            onClick={() => setShowSettings(true)}
          >
            <Icon name="Settings" size={14} />
          </Button>
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
                <Button
                  size="sm"
                  variant={tab === "repairs" ? "default" : "outline"}
                  className={tab === "repairs" ? "bg-orange-500 text-white hover:bg-orange-500/90" : ""}
                  onClick={() => setTab("repairs")}
                >
                  <Icon name="Wrench" size={14} className="mr-1" />
                  Ремонт ({repairs.filter(r => r.status === "repair").length})
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
                        {["Время", "Код", "Таб.№", "ФИО", "Тип", "Фонарь", "СС", "Статус", "Возврат", "Состояние", ""].map((h) => (
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
                          <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{r.tabular_number || "—"}</td>
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
                          <td className={`px-3 py-3 text-xs font-medium ${conditionColors[r.condition] || "text-muted-foreground"}`}>{conditionLabels[r.condition] || r.condition || "—"}</td>
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
                          <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Нет записей о выдаче
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : tab === "denials" ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {["Время", "Код", "Таб.№", "ФИО", "Причина", "Кто оформил"].map((h) => (
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
                          <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{d.tabular_number || "—"}</td>
                          <td className="px-3 py-3 text-sm text-foreground font-medium">{d.person_name}</td>
                          <td className="px-3 py-3 text-sm text-mine-red">{d.reason}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{d.denied_by || "—"}</td>
                        </tr>
                      ))}
                      {filteredDenials.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Нет записей о недопусках
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Оборудование в ремонте и списанное</span>
                    <Button size="sm" className="gap-1.5 bg-orange-500 text-white hover:bg-orange-500/90 h-7 text-xs" onClick={() => { setShowRepairDialog(true); setRepairType("lantern"); setRepairNumber(""); setRepairReason(""); }}>
                      <Icon name="Plus" size={12} />
                      Отправить в ремонт
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          {["Тип", "Номер", "Причина", "Дата отправки", "Дата возврата", "Статус", ""].map((h) => (
                            <th key={h} className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {repairs.map((r) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="px-3 py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {r.equipment_type === "lantern" ? "Фонарь" : "Самоспасатель"}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-sm font-mono text-foreground">{r.equipment_number}</td>
                            <td className="px-3 py-3 text-xs text-muted-foreground max-w-[200px]">{r.repair_reason || "—"}</td>
                            <td className="px-3 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatDateTime(r.sent_to_repair_at)}</td>
                            <td className="px-3 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatDateTime(r.returned_from_repair_at)}</td>
                            <td className="px-3 py-3">
                              {r.status === "repair" ? (
                                <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30">В ремонте</Badge>
                              ) : r.status === "available" ? (
                                <Badge className="text-[10px] bg-mine-green/20 text-mine-green border-mine-green/30">Возвращён</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">Списан</Badge>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {r.status === "repair" && (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-mine-green/30 text-mine-green hover:bg-mine-green/10" onClick={() => handleReturnRepair(r.id)}>
                                    <Icon name="Check" size={12} />
                                    Вернуть
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-mine-red/30 text-mine-red hover:bg-mine-red/10" onClick={() => handleDecommission(r.id)}>
                                    <Icon name="Trash2" size={12} />
                                    Списать
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {repairs.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                              Нет оборудования в ремонте
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
                      {identifiedPerson.personal_code}
                      {identifiedPerson.tabular_number ? ` · Таб.№ ${identifiedPerson.tabular_number}` : ""}
                      {" · "}{identifiedPerson.department || identifiedPerson.organization}
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

              {(() => {
                const hasL = activeIssues.some(ai => ai.item_type === "lantern" || ai.item_type === "both");
                const hasR = activeIssues.some(ai => ai.item_type === "rescuer" || ai.item_type === "both");
                const fullyIssued = hasL && hasR;
                const partiallyIssued = (hasL || hasR) && !fullyIssued;

                return fullyIssued ? (
                  <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-4 text-center space-y-2">
                    <Icon name="ShieldX" size={32} className="text-mine-red mx-auto" />
                    <p className="text-sm font-semibold text-mine-red">Повторная выдача невозможна</p>
                    <p className="text-xs text-muted-foreground">Всё оборудование уже выдано. Сначала примите его обратно.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Что выдаём</label>
                        {partiallyIssued ? (
                          <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">
                            {itemType === "lantern" ? "Только фонарь" : "Только самоспасатель"}
                          </div>
                        ) : (
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
                        )}
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
                  </>
                );
              })()}

              {issueError && (
                <div className="flex items-center gap-2 rounded-lg border border-mine-amber/20 bg-mine-amber/5 px-4 py-3">
                  <Icon name="AlertTriangle" size={16} className="text-mine-amber" />
                  <p className="text-sm text-mine-amber">{issueError}</p>
                </div>
              )}
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

      <Dialog open={detailType !== null} onOpenChange={(open) => !open && setDetailType(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon
                name={
                  ({ active: "Package", lanterns_out: "Flashlight", rescuers_out: "Shield", today_issued: "ArrowUpRight", today_returned: "ArrowDownLeft", today_denied: "Ban" } as Record<string, string>)[detailType || ""] || "List"
                }
                size={18}
                className={
                  ({ active: "text-mine-cyan", lanterns_out: "text-mine-amber", rescuers_out: "text-indigo-400", today_issued: "text-mine-green", today_returned: "text-blue-400", today_denied: "text-mine-red" } as Record<string, string>)[detailType || ""] || ""
                }
              />
              {({ active: "Выдано сейчас", lanterns_out: "Фонарей выдано", rescuers_out: "Самоспасателей выдано", today_issued: "Выдано за день", today_returned: "Возвращено за день", today_denied: "Недопуски за день" } as Record<string, string>)[detailType || ""] || "Детали"}
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
                    {["Дата/Время", "Код", "Таб.№", "ФИО", "Причина", "Кто оформил"].map((h) => (
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
                    {["Дата/Время", "Код", "Таб.№", "ФИО", "Должность", "Подразделение", "Фонарь", "СС", "Кто выдал"].map((h) => (
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

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Settings" size={18} className="text-mine-cyan" />
              Настройки ламповой
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-mine-amber/20 bg-mine-amber/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="Flashlight" size={16} className="text-mine-amber" />
                <span className="text-sm font-semibold text-foreground">Шахтные фонари</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Общее количество на руднике</label>
                <Input type="number" value={settingsLanterns} onChange={(e) => setSettingsLanterns(e.target.value)} className="bg-background font-mono" />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Выдано: <strong className="text-mine-amber">{stats.lanterns_out}</strong></span>
                <span>В ремонте: <strong className="text-orange-400">{stats.lanterns_repair}</strong></span>
                <span>Доступно: <strong className="text-mine-green">{(parseInt(settingsLanterns) || 0) - stats.lanterns_out - stats.lanterns_repair}</strong></span>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="Shield" size={16} className="text-indigo-400" />
                <span className="text-sm font-semibold text-foreground">Самоспасатели</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Общее количество на руднике</label>
                <Input type="number" value={settingsRescuers} onChange={(e) => setSettingsRescuers(e.target.value)} className="bg-background font-mono" />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Выдано: <strong className="text-indigo-400">{stats.rescuers_out}</strong></span>
                <span>В ремонте: <strong className="text-orange-400">{stats.rescuers_repair}</strong></span>
                <span>Доступно: <strong className="text-mine-green">{(parseInt(settingsRescuers) || 0) - stats.rescuers_out - stats.rescuers_repair}</strong></span>
              </div>
            </div>
            <Button className="w-full gap-2 bg-mine-cyan text-white hover:bg-mine-cyan/90" onClick={handleSaveSettings} disabled={settingsSaving}>
              {settingsSaving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRepairDialog} onOpenChange={setShowRepairDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Wrench" size={18} className="text-orange-400" />
              Отправить в ремонт
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Тип оборудования</label>
              <Select value={repairType} onValueChange={setRepairType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lantern">Фонарь</SelectItem>
                  <SelectItem value="rescuer">Самоспасатель</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Номер оборудования</label>
              <Input placeholder="Ф-001 или СС-001" value={repairNumber} onChange={(e) => setRepairNumber(e.target.value.toUpperCase())} className="font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Причина ремонта</label>
              <Textarea placeholder="Укажите причину..." value={repairReason} onChange={(e) => setRepairReason(e.target.value)} rows={2} />
            </div>
            <Button className="w-full gap-2 bg-orange-500 text-white hover:bg-orange-500/90" onClick={handleSendRepair} disabled={repairLoading || !repairNumber.trim() || !repairReason.trim()}>
              {repairLoading ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Wrench" size={16} />}
              Отправить в ремонт
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Lampa;
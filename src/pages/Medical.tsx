import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import QrScanner from "@/components/scanner/QrScanner";
import { useState, useEffect, useCallback } from "react";
import { medicalApi } from "@/lib/api";
import { playSuccess, playDenied, playScan } from "@/lib/sounds";

const medicalStatusLabels: Record<string, string> = {
  passed: "пройден",
  failed: "не пройден",
  pending: "ожидает",
};

const statusColors: Record<string, string> = {
  пройден: "bg-mine-green/20 text-mine-green border-mine-green/30",
  "не пройден": "bg-mine-red/20 text-mine-red border-mine-red/30",
  ожидает: "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const shiftLabels: Record<string, string> = {
  day: "Дневная",
  night: "Ночная",
};

const directionLabels: Record<string, string> = {
  to_shift: "На смену",
  from_shift: "Со смены",
};

interface MedicalRecord {
  id?: number;
  personal_code?: string;
  person_code?: string;
  person_name?: string;
  full_name?: string;
  status: string;
  checked_at?: string;
  blood_pressure?: string;
  pulse?: number;
  alcohol_level?: number;
  temperature?: number;
  doctor_name?: string;
  department?: string;
  organization?: string;
  shift_type?: string;
  shift_label?: string;
  check_direction?: string;
  direction_label?: string;
  shift_date?: string;
  notes?: string;
  position?: string;
  is_itr?: boolean;
  tab_number?: string;
}

interface ScanResult {
  result: string;
  message: string;
  shift_type: string;
  shift_label: string;
  check_direction: string;
  direction_label: string;
  shift_date: string;
  person: {
    id: number;
    full_name: string;
    personal_code: string;
    position: string;
    department: string;
    organization: string;
    old_medical: string;
    new_medical: string;
  };
}

interface CategoryStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

interface MedicalStats {
  passed?: number;
  failed?: number;
  pending?: number;
  total?: number;
  itr?: CategoryStats;
  workers?: CategoryStats;
  period?: { passed: number; failed: number };
  by_shift?: Record<string, { passed: number; failed: number }>;
}

interface ShiftInfo {
  shift_type: string;
  shift_label: string;
  check_direction: string;
  direction_label: string;
  shift_date: string;
  schedule?: ShiftSchedule;
}

interface ShiftSchedule {
  day_start: string;
  day_end: string;
  night_start: string;
  night_end: string;
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

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function getTodayStr(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

const Medical = () => {
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [stats, setStats] = useState<MedicalStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null);

  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [filterShift, setFilterShift] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [showDeny, setShowDeny] = useState(false);
  const [denyCode, setDenyCode] = useState("");
  const [denyReason, setDenyReason] = useState("");
  const [denyLoading, setDenyLoading] = useState(false);
  const [denyResult, setDenyResult] = useState<ScanResult | null>(null);

  const [showSchedule, setShowSchedule] = useState(false);
  const [schedDayStart, setSchedDayStart] = useState("05:00");
  const [schedDayEnd, setSchedDayEnd] = useState("17:00");
  const [schedNightStart, setSchedNightStart] = useState("17:00");
  const [schedNightEnd, setSchedNightEnd] = useState("05:00");
  const [schedSaving, setSchedSaving] = useState(false);

  const buildParams = useCallback(() => {
    const p: Record<string, string> = {};
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (filterShift !== "all") p.shift_type = filterShift;
    if (filterDirection !== "all") p.direction = filterDirection;
    return p;
  }, [dateFrom, dateTo, filterShift, filterDirection]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const p = buildParams();
      const [checksRes, statsRes, shiftRes] = await Promise.all([
        medicalApi.getChecks(p),
        medicalApi.getStats(p),
        medicalApi.getShift(),
      ]);
      setRecords(checksRes.checks || []);
      setStats(statsRes);
      setShiftInfo(shiftRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openSchedule = () => {
    const s = shiftInfo?.schedule;
    if (s) {
      setSchedDayStart(s.day_start || "05:00");
      setSchedDayEnd(s.day_end || "17:00");
      setSchedNightStart(s.night_start || "17:00");
      setSchedNightEnd(s.night_end || "05:00");
    }
    setShowSchedule(true);
  };

  const handleSaveSchedule = async () => {
    setSchedSaving(true);
    try {
      await medicalApi.saveSchedule({
        day_start: schedDayStart,
        day_end: schedDayEnd,
        night_start: schedNightStart,
        night_end: schedNightEnd,
      });
      setShowSchedule(false);
      fetchData();
    } catch {
      /* */
    } finally {
      setSchedSaving(false);
    }
  };

  const handleScan = useCallback(
    async (code: string) => {
      if (scanLoading) return;
      playScan();
      setScanLoading(true);
      setScanError("");
      setScanResult(null);

      try {
        const data = await medicalApi.scan(code);
        setScanResult(data);
        playSuccess();
        fetchData();
      } catch (err: unknown) {
        playDenied();
        setScanError(err instanceof Error ? err.message : "Ошибка сканирования");
      } finally {
        setScanLoading(false);
      }
    },
    [scanLoading, fetchData]
  );

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleScan(manualCode.trim());
  };

  const clearScanResult = () => {
    setScanResult(null);
    setScanError("");
    setManualCode("");
    setDenyResult(null);
  };

  const openDeny = (code?: string) => {
    setDenyCode(code || "");
    setDenyReason("");
    setDenyResult(null);
    setShowDeny(true);
  };

  const handleDeny = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denyCode.trim()) return;
    setDenyLoading(true);
    setScanError("");
    try {
      const data = await medicalApi.deny(denyCode.trim(), denyReason.trim());
      setDenyResult(data);
      playDenied();
      fetchData();
    } catch (err: unknown) {
      playDenied();
      setScanError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setDenyLoading(false);
    }
  };

  const handleExport = () => {
    const url = medicalApi.getExportUrl(buildParams());
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    const printData = filtered.length > 0 ? filtered : records;
    const shiftTitle = shiftInfo ? `${shiftInfo.shift_label} смена — ${shiftInfo.direction_label}` : "";
    const dateRange = dateFrom === dateTo
      ? formatDate(dateFrom)
      : `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;

    const rows = printData.map((r) => {
      const code = r.person_code || r.personal_code || "";
      const name = r.person_name || r.full_name || "";
      const st = medicalStatusLabels[r.status] || r.status;
      return `<tr>
        <td>${code}</td>
        <td>${name}</td>
        <td>${r.is_itr ? "ИТР" : "Рабочий"}</td>
        <td>${r.position || "—"}</td>
        <td>${r.department || "—"}</td>
        <td>${r.organization || "—"}</td>
        <td>${r.shift_label || shiftLabels[r.shift_type || ""] || "—"}</td>
        <td>${r.direction_label || directionLabels[r.check_direction || ""] || "—"}</td>
        <td style="color:${r.status === "passed" ? "#22c55e" : r.status === "failed" ? "#ef4444" : "#eab308"}">${st}</td>
        <td>${formatDate(r.shift_date)}</td>
        <td>${formatTime(r.checked_at)}</td>
        <td>${r.notes || "—"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Медицинский контроль</title>
<style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:600}h1{font-size:18px}h2{font-size:14px;color:#666;margin-top:4px}@media print{body{padding:0}}</style>
</head><body><h1>Медицинский контроль — Журнал осмотров</h1><h2>${dateRange}${shiftTitle ? " | " + shiftTitle : ""}</h2>
<table><thead><tr><th>Код</th><th>ФИО</th><th>Категория</th><th>Должность</th><th>Подразделение</th><th>Организация</th><th>Смена</th><th>Направл.</th><th>Результат</th><th>Дата</th><th>Время</th><th>Примечание</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="margin-top:16px;font-size:11px;color:#999">Сформировано: ${new Date().toLocaleString("ru-RU")}</p>
<script>window.print()<${"/"}script></body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const passed = stats.passed ?? 0;
  const failed = stats.failed ?? 0;
  const waiting = stats.pending ?? 0;
  const total = stats.total || passed + failed + waiting || 1;

  const filtered = records.filter((r) => {
    const matchSearch = (r.person_name || r.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.person_code || r.personal_code || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" ||
      (filterCategory === "itr" && r.is_itr) ||
      (filterCategory === "worker" && !r.is_itr);
    return matchSearch && matchCategory;
  });

  return (
    <AppLayout
      title="Медицинский контроль"
      subtitle="Предсменные и послесменные медосмотры"
    >
      <div className="space-y-4">
        {shiftInfo && (
          <div className="rounded-xl border border-mine-cyan/20 bg-mine-cyan/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
                <Icon name="Clock" size={20} className="text-mine-cyan" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Текущая смена: {shiftInfo.shift_label} ({shiftInfo.shift_date})
                </p>
                <p className="text-xs text-muted-foreground">
                  Режим: {shiftInfo.direction_label}
                  {shiftInfo.shift_type === "day"
                    ? ` (дневная ${shiftInfo.schedule?.day_start || "05:00"}–${shiftInfo.schedule?.day_end || "17:00"})`
                    : ` (ночная ${shiftInfo.schedule?.night_start || "17:00"}–${shiftInfo.schedule?.night_end || "05:00"})`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  shiftInfo.check_direction === "to_shift"
                    ? "bg-mine-green/20 text-mine-green border-mine-green/30"
                    : "bg-mine-amber/20 text-mine-amber border-mine-amber/30"
                }
              >
                {shiftInfo.direction_label}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openSchedule} title="Настроить время смен">
                <Icon name="Settings" size={16} />
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Всего", value: total, icon: "Users", border: "border-mine-cyan/20", bg: "bg-mine-cyan/5", iconBg: "bg-mine-cyan/10", iconText: "text-mine-cyan", valueText: "text-mine-cyan" },
            { label: "Рабочие", value: stats.workers?.total ?? 0, icon: "HardHat", border: "border-mine-amber/20", bg: "bg-mine-amber/5", iconBg: "bg-mine-amber/10", iconText: "text-mine-amber", valueText: "text-mine-amber" },
            { label: "ИТР", value: stats.itr?.total ?? 0, icon: "GraduationCap", border: "border-indigo-400/20", bg: "bg-indigo-400/5", iconBg: "bg-indigo-400/10", iconText: "text-indigo-400", valueText: "text-indigo-400" },
            { label: "Допущены", value: passed, icon: "CheckCircle2", border: "border-mine-green/20", bg: "bg-mine-green/5", iconBg: "bg-mine-green/10", iconText: "text-mine-green", valueText: "text-mine-green" },
            { label: "Не допущ.", value: failed, icon: "XCircle", border: "border-mine-red/20", bg: "bg-mine-red/5", iconBg: "bg-mine-red/10", iconText: "text-mine-red", valueText: "text-mine-red" },
            { label: "Ожидают", value: waiting, icon: "Clock", border: "border-mine-amber/20", bg: "bg-mine-amber/5", iconBg: "bg-mine-amber/10", iconText: "text-mine-amber", valueText: "text-mine-amber" },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl border ${card.border} ${card.bg} p-3 flex items-center gap-2.5`}>
              <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center shrink-0`}>
                <Icon name={card.icon} size={16} className={card.iconText} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground leading-tight truncate">{card.label}</p>
                <p className={`text-lg font-bold ${card.valueText} leading-tight`}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-mine-amber/20 bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-mine-amber/10 flex items-center justify-center">
                <Icon name="HardHat" size={18} className="text-mine-amber" />
              </div>
              <span className="text-sm font-semibold text-foreground">Рабочие</span>
              <span className="text-sm font-bold text-mine-amber ml-auto">{stats.workers?.total ?? 0}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-mine-green">
                  <Icon name="CheckCircle2" size={12} />
                  Допущены
                </span>
                <span className="font-medium text-mine-green">{stats.workers?.passed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-mine-red">
                  <Icon name="XCircle" size={12} />
                  Не допущ.
                </span>
                <span className="font-medium text-mine-red">{stats.workers?.failed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-mine-amber">
                  <Icon name="Clock" size={12} />
                  Ожидают
                </span>
                <span className="font-medium text-mine-amber">{stats.workers?.pending ?? 0}</span>
              </div>
            </div>
            <div>
              <Progress value={(stats.workers?.total ?? 0) > 0 ? Math.round(((stats.workers?.passed ?? 0) / (stats.workers?.total ?? 1)) * 100) : 0} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">{(stats.workers?.total ?? 0) > 0 ? Math.round(((stats.workers?.passed ?? 0) / (stats.workers?.total ?? 1)) * 100) : 0}% допущены</p>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-400/20 bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-400/10 flex items-center justify-center">
                <Icon name="GraduationCap" size={18} className="text-indigo-400" />
              </div>
              <span className="text-sm font-semibold text-foreground">ИТР</span>
              <span className="text-sm font-bold text-indigo-400 ml-auto">{stats.itr?.total ?? 0}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-mine-green">
                  <Icon name="CheckCircle2" size={12} />
                  Допущены
                </span>
                <span className="font-medium text-mine-green">{stats.itr?.passed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-mine-red">
                  <Icon name="XCircle" size={12} />
                  Не допущ.
                </span>
                <span className="font-medium text-mine-red">{stats.itr?.failed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-mine-amber">
                  <Icon name="Clock" size={12} />
                  Ожидают
                </span>
                <span className="font-medium text-mine-amber">{stats.itr?.pending ?? 0}</span>
              </div>
            </div>
            <div>
              <Progress value={(stats.itr?.total ?? 0) > 0 ? Math.round(((stats.itr?.passed ?? 0) / (stats.itr?.total ?? 1)) * 100) : 0} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">{(stats.itr?.total ?? 0) > 0 ? Math.round(((stats.itr?.passed ?? 0) / (stats.itr?.total ?? 1)) * 100) : 0}% допущены</p>
            </div>
          </div>
        </div>

        {stats.by_shift && Object.keys(stats.by_shift).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.by_shift).map(([key, val]) => {
              const [st, dir] = key.split("_");
              const remaining = key.replace(st + "_", "");
              return (
                <div key={key} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {shiftLabels[st] || st} / {directionLabels[remaining] || remaining}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-bold text-mine-green">{val.passed}</span>
                    <span className="text-[10px] text-muted-foreground">/</span>
                    <span className="text-sm font-bold text-mine-red">{val.failed}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-green/10 flex items-center justify-center">
                <Icon name="ScanLine" size={20} className="text-mine-green" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Отметить медосмотр</h3>
                <p className="text-xs text-muted-foreground">Сканируйте QR-код или введите личный код сотрудника</p>
              </div>
            </div>

            <QrScanner onScan={handleScan} active={scanning} onToggle={setScanning} />

            {!scanning && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">или введите код</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleManualScan} className="space-y-3">
                  <Input
                    placeholder="Например: МК-001"
                    className="bg-secondary/50 border-border text-lg font-mono text-center h-14 tracking-widest"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="submit"
                      className="gap-2 bg-mine-green hover:bg-mine-green/90 text-white font-semibold"
                      disabled={!manualCode.trim() || scanLoading}
                    >
                      <Icon name="CheckCircle2" size={16} />
                      {scanLoading ? "..." : "Допустить"}
                    </Button>
                    <Button
                      type="button"
                      className="gap-2 bg-mine-red hover:bg-mine-red/90 text-white font-semibold"
                      disabled={!manualCode.trim() || scanLoading}
                      onClick={() => openDeny(manualCode.trim())}
                    >
                      <Icon name="XCircle" size={16} />
                      Отказ
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>

          <div className="space-y-4">
            {scanLoading && (
              <div className="rounded-xl border border-mine-cyan/20 bg-mine-cyan/5 p-6 flex items-center justify-center gap-3 animate-fade-in">
                <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
                <span className="text-sm text-mine-cyan">Обработка медосмотра...</span>
              </div>
            )}

            {scanError && (
              <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-5 animate-fade-in">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-mine-red/10 flex items-center justify-center flex-shrink-0">
                    <Icon name="XCircle" size={20} className="text-mine-red" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-mine-red">Ошибка</p>
                    <p className="text-xs text-mine-red/80">{scanError}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-mine-red/20 text-mine-red hover:bg-mine-red/10"
                  onClick={clearScanResult}
                >
                  Попробовать снова
                </Button>
              </div>
            )}

            {scanResult && (
              <div className="rounded-xl border border-mine-green/20 bg-mine-green/5 p-5 animate-fade-in glow-green">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-mine-green/20 flex items-center justify-center">
                    <Icon name="CheckCircle2" size={24} className="text-mine-green" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {scanResult.person.full_name}
                    </p>
                    <p className="text-sm font-medium text-mine-green">
                      {scanResult.message}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Код", value: scanResult.person.personal_code },
                    { label: "Должность", value: scanResult.person.position },
                    { label: "Подразделение", value: scanResult.person.department },
                    { label: "Организация", value: scanResult.person.organization || "—" },
                    { label: "Смена", value: scanResult.shift_label },
                    { label: "Режим", value: scanResult.direction_label },
                    { label: "Было", value: medicalStatusLabels[scanResult.person.old_medical] || scanResult.person.old_medical },
                    { label: "Стало", value: "пройден" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                    >
                      <p className="text-[10px] text-muted-foreground">{f.label}</p>
                      <p className="text-xs font-medium text-foreground">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 border-border"
                  onClick={clearScanResult}
                >
                  Следующий
                </Button>
              </div>
            )}

            {denyResult && (
              <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-5 animate-fade-in glow-red">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-mine-red/20 flex items-center justify-center">
                    <Icon name="ShieldAlert" size={24} className="text-mine-red" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {denyResult.person.full_name}
                    </p>
                    <p className="text-sm font-medium text-mine-red">
                      {denyResult.message}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Код", value: denyResult.person.personal_code },
                    { label: "Подразделение", value: denyResult.person.department },
                    { label: "Смена", value: denyResult.shift_label },
                    { label: "Режим", value: denyResult.direction_label },
                    { label: "Было", value: medicalStatusLabels[denyResult.person.old_medical] || denyResult.person.old_medical },
                    { label: "Стало", value: "не пройден" },
                  ].map((f) => (
                    <div key={f.label} className="rounded-lg border border-border/50 bg-background/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">{f.label}</p>
                      <p className="text-xs font-medium text-foreground">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3 border-border" onClick={() => { setDenyResult(null); setShowDeny(false); }}>
                  Следующий
                </Button>
              </div>
            )}

            {showDeny && !denyResult && (
              <div className="rounded-xl border border-mine-red/20 bg-card p-5 animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-mine-red/10 flex items-center justify-center">
                    <Icon name="ShieldAlert" size={20} className="text-mine-red" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Отказ в допуске</h3>
                    <p className="text-xs text-muted-foreground">Укажите код сотрудника и причину</p>
                  </div>
                </div>
                <form onSubmit={handleDeny} className="space-y-3">
                  <Input
                    placeholder="Код: МК-001"
                    className="bg-secondary/50 font-mono text-center h-12 tracking-widest"
                    value={denyCode}
                    onChange={(e) => setDenyCode(e.target.value.toUpperCase())}
                    required
                  />
                  <Input
                    placeholder="Причина отказа (алкоголь, давление, температура...)"
                    className="bg-secondary/50"
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {["Алкоголь", "Высокое давление", "Температура", "Плохое самочувствие", "Отказ от осмотра"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setDenyReason(r)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${denyReason === r ? "bg-mine-red/20 border-mine-red/40 text-mine-red" : "border-border text-muted-foreground hover:border-mine-red/30 hover:text-mine-red"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowDeny(false)} disabled={denyLoading}>
                      Отмена
                    </Button>
                    <Button type="submit" className="gap-2 bg-mine-red hover:bg-mine-red/90 text-white" disabled={!denyCode.trim() || denyLoading}>
                      <Icon name="XCircle" size={14} />
                      {denyLoading ? "..." : "Отказать"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {!scanLoading && !scanError && !scanResult && !showDeny && !denyResult && (
              <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
                <div className="w-16 h-16 rounded-2xl bg-mine-green/10 flex items-center justify-center">
                  <Icon name="HeartPulse" size={32} className="text-mine-green/40" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Сканируйте QR-код сотрудника для отметки медосмотра
                </p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-mine-red border-mine-red/30 hover:bg-mine-red/10" onClick={() => openDeny()}>
                    <Icon name="XCircle" size={14} />
                    Отказ вручную
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Дата с</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-secondary/50 w-40 h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Дата по</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-secondary/50 w-40 h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Смена</label>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="w-36 h-9 bg-secondary/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все смены</SelectItem>
                  <SelectItem value="day">Дневная</SelectItem>
                  <SelectItem value="night">Ночная</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Направление</label>
              <Select value={filterDirection} onValueChange={setFilterDirection}>
                <SelectTrigger className="w-36 h-9 bg-secondary/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="to_shift">На смену</SelectItem>
                  <SelectItem value="from_shift">Со смены</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Категория</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-36 h-9 bg-secondary/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="worker">Рабочие</SelectItem>
                  <SelectItem value="itr">ИТР</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <label className="text-[10px] text-muted-foreground block mb-1">Поиск</label>
              <div className="relative">
                <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ФИО или код..."
                  className="pl-8 bg-secondary/50 h-9 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={fetchData}>
                <Icon name="RefreshCw" size={14} />
                Обновить
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={handleExport}>
                <Icon name="Download" size={14} />
                CSV
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={handlePrint}>
                <Icon name="Printer" size={14} />
                Печать
              </Button>
            </div>
          </div>
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
                    {["Дата", "Код", "ФИО", "Таб. №", "Категория", "Должность", "Организация", "Смена", "Направл.", "Статус", "Время", "Давление", "Пульс", "Алкоголь", "Темп.", "Примечание"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const statusText = medicalStatusLabels[r.status] || r.status;
                    const code = r.person_code || r.personal_code || "";
                    const name = r.person_name || r.full_name || "";
                    return (
                      <tr
                        key={(r.id || i)}
                        className={`border-b border-border/50 hover:bg-secondary/50 transition-colors animate-fade-in ${
                          statusText === "не пройден" ? "bg-mine-red/5" : ""
                        }`}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(r.shift_date)}
                        </td>
                        <td className="px-3 py-3">
                          <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                            {code}
                          </code>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                          {name}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
                          {r.tab_number || "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`text-[10px] ${r.is_itr ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-mine-amber/20 text-mine-amber border-mine-amber/30"}`}>
                            {r.is_itr ? "ИТР" : "Рабочий"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {r.position || "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {r.organization || "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`text-[10px] ${r.shift_type === "night" ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-mine-amber/20 text-mine-amber border-mine-amber/30"}`}>
                            {r.shift_label || shiftLabels[r.shift_type || ""] || "—"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {r.direction_label || directionLabels[r.check_direction || ""] || "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${statusColors[statusText] || ""}`}
                          >
                            {statusText}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground font-mono">
                          {formatTime(r.checked_at)}
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground font-mono">
                          {r.blood_pressure || "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground font-mono">
                          {r.pulse || "—"}
                        </td>
                        <td className="px-3 py-3">
                          {(r.alcohol_level ?? 0) > 0 ? (
                            <Badge variant="outline" className="text-[11px] bg-mine-red/20 text-mine-red border-mine-red/30">
                              {r.alcohol_level}‰
                            </Badge>
                          ) : (
                            <span className="text-sm text-mine-green">0</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground font-mono">
                          {r.temperature ? `${r.temperature}°` : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                          {r.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={16} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        Нет записей о медосмотрах за выбранный период
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Clock" size={18} className="text-mine-cyan" />
              Расписание смен
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="rounded-xl border border-mine-amber/20 bg-mine-amber/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="Sun" size={16} className="text-mine-amber" />
                <span className="text-sm font-semibold text-foreground">Дневная смена</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Начало</label>
                  <Input type="time" value={schedDayStart} onChange={(e) => setSchedDayStart(e.target.value)} className="bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Конец</label>
                  <Input type="time" value={schedDayEnd} onChange={(e) => setSchedDayEnd(e.target.value)} className="bg-background" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="Moon" size={16} className="text-indigo-400" />
                <span className="text-sm font-semibold text-foreground">Ночная смена</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Начало</label>
                  <Input type="time" value={schedNightStart} onChange={(e) => setSchedNightStart(e.target.value)} className="bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Конец</label>
                  <Input type="time" value={schedNightEnd} onChange={(e) => setSchedNightEnd(e.target.value)} className="bg-background" />
                </div>
              </div>
            </div>
            <Button className="w-full gap-2 bg-mine-cyan text-white hover:bg-mine-cyan/90" onClick={handleSaveSchedule} disabled={schedSaving}>
              {schedSaving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Save" size={16} />}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Medical;
import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import QrScanner from "@/components/scanner/QrScanner";
import { checkpointApi } from "@/lib/api";
import { playSuccess, playDenied, playScan } from "@/lib/sounds";

interface PersonData {
  id: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  category: string;
  organization: string;
  organization_type: string;
}

interface JournalItem {
  id: number;
  personnel_id: number;
  personal_code: string;
  full_name: string;
  direction: string;
  direction_raw: string;
  checkpoint_name: string;
  medical_ok: boolean;
  notes: string;
  created_at: string;
}

interface OnSiteItem {
  personnel_id: number;
  personal_code: string;
  full_name: string;
  checkpoint_name: string;
  entered_at: string;
  position: string;
  department: string;
  organization: string;
  organization_type: string;
}

interface Stats {
  today_in: number;
  today_out: number;
  today_denied: number;
  total_passes: number;
  currently_on_site: number;
}

type Tab = "scanner" | "journal" | "on-site";

const Checkpoint = () => {
  const [tab, setTab] = useState<Tab>("scanner");
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [passResult, setPassResult] = useState<{
    result: string;
    message: string;
    direction: string;
    person_name: string;
    medical_ok: boolean;
    person?: PersonData;
  } | null>(null);

  const [journal, setJournal] = useState<JournalItem[]>([]);
  const [journalTotal, setJournalTotal] = useState(0);
  const [journalPage, setJournalPage] = useState(1);
  const [journalPages, setJournalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dirFilter, setDirFilter] = useState("");

  const [onSite, setOnSite] = useState<OnSiteItem[]>([]);
  const [stats, setStats] = useState<Stats>({ today_in: 0, today_out: 0, today_denied: 0, total_passes: 0, currently_on_site: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadJournal = useCallback(async () => {
    try {
      const params: Record<string, string> = { page: String(journalPage) };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (dirFilter) params.direction = dirFilter;
      const data = await checkpointApi.getJournal(params);
      setJournal(data.items || []);
      setJournalTotal(data.total || 0);
      setJournalPages(data.pages || 1);
    } catch { /* ignore */ }
  }, [journalPage, dateFrom, dateTo, dirFilter]);

  useEffect(() => {
    if (tab === "journal") loadJournal();
  }, [tab, loadJournal]);

  const loadOnSite = useCallback(async () => {
    try {
      const data = await checkpointApi.getOnSite();
      setOnSite(data.items || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === "on-site") loadOnSite();
  }, [tab, loadOnSite]);

  const loadStats = async () => {
    try {
      const data = await checkpointApi.getStats();
      setStats(data);
    } catch { /* ignore */ }
  };

  const handleScan = useCallback(async (code: string) => {
    if (loading) return;
    playScan();
    setError("");
    setLoading(true);
    setPassResult(null);

    try {
      const data = await checkpointApi.pass(code, direction);
      setPassResult(data);
      if (data.result === "allowed") {
        playSuccess();
      } else {
        playDenied();
      }
      loadStats();
    } catch (err: unknown) {
      playDenied();
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [loading, direction]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleScan(manualCode.trim());
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    window.open(checkpointApi.getExportUrl(params), "_blank");
  };

  const clearResult = () => {
    setPassResult(null);
    setError("");
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("ru-RU", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return "—";
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  const tabItems = [
    { id: "scanner" as Tab, label: "Сканер", icon: "ScanLine" },
    { id: "journal" as Tab, label: "Журнал проходов", icon: "FileText" },
    { id: "on-site" as Tab, label: "На территории", icon: "Users" },
  ];

  return (
    <AppLayout title="КПП" subtitle="Контроль входа и выхода через контрольно-пропускной пункт">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-green/10 flex items-center justify-center">
                <Icon name="LogIn" size={20} className="text-mine-green" />
              </div>
              <div>
                <p className="text-2xl font-bold text-mine-green">{stats.today_in}</p>
                <p className="text-xs text-muted-foreground">Входов</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-amber/10 flex items-center justify-center">
                <Icon name="LogOut" size={20} className="text-mine-amber" />
              </div>
              <div>
                <p className="text-2xl font-bold text-mine-amber">{stats.today_out}</p>
                <p className="text-xs text-muted-foreground">Выходов</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-red/10 flex items-center justify-center">
                <Icon name="ShieldAlert" size={20} className="text-mine-red" />
              </div>
              <div>
                <p className="text-2xl font-bold text-mine-red">{stats.today_denied}</p>
                <p className="text-xs text-muted-foreground">Отказов</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Users" size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{stats.currently_on_site}</p>
                <p className="text-xs text-muted-foreground">На территории</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon name="Database" size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total_passes}</p>
                <p className="text-xs text-muted-foreground">Всего записей</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border pb-3">
          {tabItems.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                tab === t.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setDirection("in")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-lg text-sm font-semibold transition-all ${
                      direction === "in"
                        ? "bg-mine-green/10 text-mine-green border-2 border-mine-green"
                        : "bg-secondary text-muted-foreground border-2 border-transparent hover:border-border"
                    }`}
                  >
                    <Icon name="LogIn" size={20} />
                    ВХОД
                  </button>
                  <button
                    onClick={() => setDirection("out")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-lg text-sm font-semibold transition-all ${
                      direction === "out"
                        ? "bg-mine-amber/10 text-mine-amber border-2 border-mine-amber"
                        : "bg-secondary text-muted-foreground border-2 border-transparent hover:border-border"
                    }`}
                  >
                    <Icon name="LogOut" size={20} />
                    ВЫХОД
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <QrScanner onScan={handleScan} active={scanning} onToggle={setScanning} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    direction === "in" ? "bg-mine-green/10" : "bg-mine-amber/10"
                  }`}>
                    <Icon name="Hash" size={20} className={direction === "in" ? "text-mine-green" : "text-mine-amber"} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {direction === "in" ? "Регистрация входа" : "Регистрация выхода"}
                    </h3>
                    <p className="text-xs text-muted-foreground">Введите код сотрудника или отсканируйте пропуск</p>
                  </div>
                </div>
                <form onSubmit={handleManualSearch} className="space-y-3">
                  <Input
                    placeholder="Например: МК-001"
                    className="bg-secondary/50 border-border text-lg font-mono text-center h-14 tracking-widest"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  />
                  <Button
                    type="submit"
                    className={`w-full gap-2 font-semibold ${
                      direction === "in"
                        ? "bg-mine-green hover:bg-mine-green/90 text-black"
                        : "bg-mine-amber hover:bg-mine-amber/90 text-black"
                    }`}
                    disabled={!manualCode.trim() || loading}
                  >
                    <Icon name={direction === "in" ? "LogIn" : "LogOut"} size={16} />
                    {loading ? "Обработка..." : direction === "in" ? "Зафиксировать вход" : "Зафиксировать выход"}
                  </Button>
                </form>
              </div>

              {loading && (
                <div className="rounded-xl border border-mine-cyan/20 bg-mine-cyan/5 p-6 flex items-center justify-center gap-3 animate-fade-in">
                  <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
                  <span className="text-sm text-mine-cyan">Обработка...</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-5 animate-fade-in">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-mine-red/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="XCircle" size={20} className="text-mine-red" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-mine-red">Ошибка</p>
                      <p className="text-xs text-mine-red/80">{error}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="w-full mt-2 border-mine-red/20 text-mine-red hover:bg-mine-red/10"
                    onClick={clearResult}
                  >
                    Повторить
                  </Button>
                </div>
              )}

              {passResult && (
                <div
                  className={`rounded-xl border p-5 animate-fade-in ${
                    passResult.result === "allowed"
                      ? passResult.direction === "in"
                        ? "border-mine-green/20 bg-mine-green/5"
                        : "border-mine-amber/20 bg-mine-amber/5"
                      : "border-mine-red/20 bg-mine-red/5"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      passResult.result === "allowed"
                        ? passResult.direction === "in" ? "bg-mine-green/20" : "bg-mine-amber/20"
                        : "bg-mine-red/20"
                    }`}>
                      <Icon
                        name={passResult.result === "allowed" ? (passResult.direction === "in" ? "LogIn" : "LogOut") : "ShieldAlert"}
                        size={24}
                        className={
                          passResult.result === "allowed"
                            ? passResult.direction === "in" ? "text-mine-green" : "text-mine-amber"
                            : "text-mine-red"
                        }
                      />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{passResult.person_name}</p>
                      <p className={`text-sm font-medium ${
                        passResult.result === "allowed"
                          ? passResult.direction === "in" ? "text-mine-green" : "text-mine-amber"
                          : "text-mine-red"
                      }`}>
                        {passResult.message}
                      </p>
                    </div>
                  </div>

                  {passResult.person && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: "Код", value: passResult.person.personal_code },
                        { label: "Организация", value: passResult.person.organization },
                        { label: "Должность", value: passResult.person.position },
                        { label: "Подразделение", value: passResult.person.department },
                      ].map((item, i) => (
                        <div key={i} className="bg-background/50 rounded-lg p-2">
                          <span className="text-muted-foreground">{item.label}: </span>
                          <span className="font-medium text-foreground">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full mt-3 gap-2" onClick={clearResult}>
                    <Icon name="RotateCcw" size={14} />
                    Следующий
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "journal" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Дата от</label>
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setJournalPage(1); }} className="w-40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Дата до</label>
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setJournalPage(1); }} className="w-40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Направление</label>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dirFilter}
                  onChange={(e) => { setDirFilter(e.target.value); setJournalPage(1); }}
                >
                  <option value="">Все</option>
                  <option value="in">Вход</option>
                  <option value="out">Выход</option>
                </select>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                <Icon name="Download" size={14} />
                Скачать CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                <Icon name="Printer" size={14} />
                Печать
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">Всего записей: {journalTotal}</div>

            <div className="rounded-xl border border-border bg-card overflow-hidden print:border-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Дата/время</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Код</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ФИО</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Направление</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">КПП</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Медосмотр</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {journal.map((item) => (
                      <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{item.personal_code}</td>
                        <td className="px-4 py-3 font-medium">{item.full_name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.direction_raw === "in"
                              ? "bg-mine-green/10 text-mine-green"
                              : "bg-mine-amber/10 text-mine-amber"
                          }`}>
                            <Icon name={item.direction_raw === "in" ? "LogIn" : "LogOut"} size={12} />
                            {item.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.checkpoint_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${item.medical_ok ? "text-mine-green" : "text-mine-red"}`}>
                            {item.medical_ok ? "Пройден" : "Не пройден"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {journal.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                          Нет записей за выбранный период
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {journalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline" size="sm" disabled={journalPage <= 1}
                  onClick={() => setJournalPage(journalPage - 1)}
                >
                  <Icon name="ChevronLeft" size={14} />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {journalPage} / {journalPages}
                </span>
                <Button
                  variant="outline" size="sm" disabled={journalPage >= journalPages}
                  onClick={() => setJournalPage(journalPage + 1)}
                >
                  <Icon name="ChevronRight" size={14} />
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "on-site" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Сейчас на территории: <span className="font-semibold text-foreground">{onSite.length}</span> чел.
              </p>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadOnSite}>
                <Icon name="RefreshCw" size={14} />
                Обновить
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Код</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ФИО</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Должность</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Организация</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">КПП</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Вошёл</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {onSite.map((item) => (
                      <tr key={item.personnel_id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{item.personal_code}</td>
                        <td className="px-4 py-3 font-medium">{item.full_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.position}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.organization}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.checkpoint_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatTime(item.entered_at)}</td>
                      </tr>
                    ))}
                    {onSite.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                          Нет людей на территории
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Checkpoint;

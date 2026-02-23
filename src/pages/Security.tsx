import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import QrScanner from "@/components/scanner/QrScanner";
import { securityApi } from "@/lib/api";
import { playSuccess, playDenied, playScan } from "@/lib/sounds";
import { useAuth } from "@/contexts/AuthContext";

interface PersonData {
  id: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  category: string;
  status: string;
  medical_status: string;
  medical_ok: boolean;
  room: string;
  shift: string;
  organization: string;
  organization_type: string;
  phone: string;
  tabular_number: string;
  qr_code: string;
  registered_at: string;
}

interface SecurityCheck {
  id: number;
  check_type: string;
  result: string;
  result_raw: string;
  notes: string;
  checked_by: string;
  created_at: string;
}

interface CheckpointPass {
  id: number;
  direction: string;
  direction_raw: string;
  checkpoint_name: string;
  medical_ok: boolean;
  created_at: string;
}

interface HistoryEvent {
  id: number;
  type: string;
  description: string;
  created_at: string;
}

interface JournalItem {
  id: number;
  personnel_id: number;
  personal_code: string;
  full_name: string;
  check_type: string;
  result: string;
  result_raw: string;
  notes: string;
  checked_by: string;
  created_at: string;
}

interface Stats {
  today_checks: number;
  today_valid: number;
  today_issues: number;
  total_checks: number;
}

type Tab = "scanner" | "journal" | "person";

const Security = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("scanner");
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [verifyResult, setVerifyResult] = useState<{
    result: string;
    message: string;
    person: PersonData;
  } | null>(null);

  const [personDetail, setPersonDetail] = useState<{
    person: PersonData;
    security_checks: SecurityCheck[];
    checkpoint_passes: CheckpointPass[];
    events: HistoryEvent[];
  } | null>(null);

  const [journal, setJournal] = useState<JournalItem[]>([]);
  const [journalTotal, setJournalTotal] = useState(0);
  const [journalPage, setJournalPage] = useState(1);
  const [journalPages, setJournalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  const [stats, setStats] = useState<Stats>({ today_checks: 0, today_valid: 0, today_issues: 0, total_checks: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === "journal") loadJournal();
  }, [tab, journalPage, dateFrom, dateTo, resultFilter]);

  const loadStats = async () => {
    try {
      const data = await securityApi.getStats();
      setStats(data);
    } catch { /* ignore */ }
  };

  const loadJournal = useCallback(async () => {
    try {
      const params: Record<string, string> = { page: String(journalPage) };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (resultFilter) params.result = resultFilter;
      const data = await securityApi.getJournal(params);
      setJournal(data.items || []);
      setJournalTotal(data.total || 0);
      setJournalPages(data.pages || 1);
    } catch { /* ignore */ }
  }, [journalPage, dateFrom, dateTo, resultFilter]);

  const handleScan = useCallback(async (code: string) => {
    if (loading) return;
    playScan();
    setError("");
    setLoading(true);
    setVerifyResult(null);

    try {
      const data = await securityApi.verify(code, user?.full_name);
      setVerifyResult(data);
      if (data.result === "valid") {
        playSuccess();
      } else {
        playDenied();
      }
      loadStats();
    } catch (err: unknown) {
      playDenied();
      setError(err instanceof Error ? err.message : "Ошибка проверки");
    } finally {
      setLoading(false);
    }
  }, [loading, user]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleScan(manualCode.trim());
  };

  const openPersonDetail = async (id: number) => {
    try {
      setLoading(true);
      const data = await securityApi.getPerson({ id: String(id) });
      setPersonDetail(data);
      setTab("person");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    window.open(securityApi.getExportUrl(params), "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  const clearResult = () => {
    setVerifyResult(null);
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

  const tabs = [
    { id: "scanner" as Tab, label: "Сканер", icon: "ScanLine" },
    { id: "journal" as Tab, label: "Журнал проверок", icon: "FileText" },
  ];

  return (
    <AppLayout title="Служба безопасности" subtitle="Проверка пропусков и данные сотрудников">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Shield" size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.today_checks}</p>
                <p className="text-xs text-muted-foreground">Проверок сегодня</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-green/10 flex items-center justify-center">
                <Icon name="CheckCircle2" size={20} className="text-mine-green" />
              </div>
              <div>
                <p className="text-2xl font-bold text-mine-green">{stats.today_valid}</p>
                <p className="text-xs text-muted-foreground">Подтверждено</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-red/10 flex items-center justify-center">
                <Icon name="AlertTriangle" size={20} className="text-mine-red" />
              </div>
              <div>
                <p className="text-2xl font-bold text-mine-red">{stats.today_issues}</p>
                <p className="text-xs text-muted-foreground">Проблем</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-mine-amber/10 flex items-center justify-center">
                <Icon name="Database" size={20} className="text-mine-amber" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total_checks}</p>
                <p className="text-xs text-muted-foreground">Всего проверок</p>
              </div>
            </div>
          </div>
        </div>

        {tab !== "person" && (
          <div className="flex gap-2 border-b border-border pb-3">
            {tabs.map((t) => (
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
        )}

        {tab === "person" && personDetail && (
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => setTab("scanner")} className="gap-2">
              <Icon name="ArrowLeft" size={16} />
              Назад
            </Button>
            <PersonDetailView
              data={personDetail}
              formatDateTime={formatDateTime}
              formatTime={formatTime}
            />
          </div>
        )}

        {tab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <QrScanner onScan={handleScan} active={scanning} onToggle={setScanning} />
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="Hash" size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Проверка по коду</h3>
                    <p className="text-xs text-muted-foreground">Введите персональный код с пропуска</p>
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
                    className="w-full gap-2 bg-primary hover:bg-primary/90 font-semibold"
                    disabled={!manualCode.trim() || loading}
                  >
                    <Icon name="ShieldCheck" size={16} />
                    {loading ? "Проверка..." : "Проверить пропуск"}
                  </Button>
                </form>
              </div>

              {loading && (
                <div className="rounded-xl border border-mine-cyan/20 bg-mine-cyan/5 p-6 flex items-center justify-center gap-3 animate-fade-in">
                  <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
                  <span className="text-sm text-mine-cyan">Проверка подлинности...</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-5 animate-fade-in">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-mine-red/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="XCircle" size={20} className="text-mine-red" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-mine-red">Не найден</p>
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

              {verifyResult && (
                <div
                  className={`rounded-xl border p-5 animate-fade-in ${
                    verifyResult.result === "valid"
                      ? "border-mine-green/20 bg-mine-green/5"
                      : "border-mine-red/20 bg-mine-red/5"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      verifyResult.result === "valid" ? "bg-mine-green/20" : "bg-mine-red/20"
                    }`}>
                      <Icon
                        name={verifyResult.result === "valid" ? "ShieldCheck" : "ShieldAlert"}
                        size={24}
                        className={verifyResult.result === "valid" ? "text-mine-green" : "text-mine-red"}
                      />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{verifyResult.person.full_name}</p>
                      <p className={`text-sm font-medium ${
                        verifyResult.result === "valid" ? "text-mine-green" : "text-mine-red"
                      }`}>
                        {verifyResult.message}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: "Код", value: verifyResult.person.personal_code },
                      { label: "Организация", value: verifyResult.person.organization },
                      { label: "Должность", value: verifyResult.person.position },
                      { label: "Подразделение", value: verifyResult.person.department },
                      { label: "Медосмотр", value: verifyResult.person.medical_status },
                      { label: "Статус", value: verifyResult.person.status },
                      { label: "Смена", value: verifyResult.person.shift },
                      { label: "Комната", value: verifyResult.person.room },
                    ].map((item, i) => (
                      <div key={i} className="bg-background/50 rounded-lg p-2">
                        <span className="text-muted-foreground">{item.label}: </span>
                        <span className="font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline" size="sm"
                      className="flex-1 gap-2"
                      onClick={() => openPersonDetail(verifyResult.person.id)}
                    >
                      <Icon name="User" size={14} />
                      Полные данные
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={clearResult}>
                      <Icon name="RotateCcw" size={14} />
                      Сброс
                    </Button>
                  </div>
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
                <label className="text-xs text-muted-foreground mb-1 block">Результат</label>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={resultFilter}
                  onChange={(e) => { setResultFilter(e.target.value); setJournalPage(1); }}
                >
                  <option value="">Все</option>
                  <option value="valid">Подтверждён</option>
                  <option value="medical_issue">Проблема</option>
                  <option value="not_found">Не найден</option>
                </select>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                <Icon name="Download" size={14} />
                Скачать CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Результат</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Проверил</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground print:hidden"></th>
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
                            item.result_raw === "valid"
                              ? "bg-mine-green/10 text-mine-green"
                              : item.result_raw === "not_found"
                              ? "bg-muted text-muted-foreground"
                              : "bg-mine-red/10 text-mine-red"
                          }`}>
                            <Icon name={item.result_raw === "valid" ? "CheckCircle2" : "AlertTriangle"} size={12} />
                            {item.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.checked_by || "—"}</td>
                        <td className="px-4 py-3 print:hidden">
                          {item.personnel_id && (
                            <Button variant="ghost" size="sm" onClick={() => openPersonDetail(item.personnel_id)}>
                              <Icon name="Eye" size={14} />
                            </Button>
                          )}
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
      </div>
    </AppLayout>
  );
};

function PersonDetailView({
  data,
  formatDateTime,
  formatTime,
}: {
  data: {
    person: PersonData;
    security_checks: SecurityCheck[];
    checkpoint_passes: CheckpointPass[];
    events: HistoryEvent[];
  };
  formatDateTime: (s: string) => string;
  formatTime: (s: string) => string;
}) {
  const p = data.person;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            p.medical_ok ? "bg-mine-green/10" : "bg-mine-red/10"
          }`}>
            <Icon name="User" size={28} className={p.medical_ok ? "text-mine-green" : "text-mine-red"} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{p.full_name}</h2>
            <p className="text-sm text-muted-foreground">{p.personal_code} | {p.organization}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Должность", value: p.position },
            { label: "Подразделение", value: p.department },
            { label: "Категория", value: p.category },
            { label: "Статус", value: p.status },
            { label: "Тип организации", value: p.organization_type },
            { label: "Медосмотр", value: p.medical_status },
            { label: "Смена", value: p.shift },
            { label: "Комната", value: p.room },
            { label: "Телефон", value: p.phone },
            { label: "Табельный номер", value: p.tabular_number },
            { label: "Зарегистрирован", value: formatDateTime(p.registered_at) },
          ].map((item, i) => (
            <div key={i} className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {data.security_checks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Icon name="Shield" size={16} className="text-primary" />
            Последние проверки СБ
          </h3>
          <div className="space-y-2">
            {data.security_checks.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon
                    name={c.result_raw === "valid" ? "CheckCircle2" : "AlertTriangle"}
                    size={14}
                    className={c.result_raw === "valid" ? "text-mine-green" : "text-mine-red"}
                  />
                  <span className="text-sm">{c.result}</span>
                  {c.checked_by && <span className="text-xs text-muted-foreground">({c.checked_by})</span>}
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.checkpoint_passes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Icon name="DoorOpen" size={16} className="text-mine-amber" />
            Проходы через КПП
          </h3>
          <div className="space-y-2">
            {data.checkpoint_passes.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon
                    name={p.direction_raw === "in" ? "LogIn" : "LogOut"}
                    size={14}
                    className={p.direction_raw === "in" ? "text-mine-green" : "text-mine-amber"}
                  />
                  <span className="text-sm">{p.direction}</span>
                  <span className="text-xs text-muted-foreground">{p.checkpoint_name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.events.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Icon name="History" size={16} className="text-muted-foreground" />
            История событий
          </h3>
          <div className="space-y-2">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                <span className="text-sm text-foreground">{e.description}</span>
                <span className="text-xs text-muted-foreground">{formatTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Security;
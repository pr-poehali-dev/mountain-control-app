import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import QrScanner from "@/components/scanner/QrScanner";
import { scannerApi } from "@/lib/api";

interface PersonResult {
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
}

interface ScanRecord {
  id: number;
  type: string;
  description: string;
  created_at: string;
  person_name: string;
  person_code: string;
  allowed: boolean;
}

const Scanner = () => {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [person, setPerson] = useState<PersonResult | null>(null);
  const [checkinResult, setCheckinResult] = useState<{
    result: string;
    message: string;
    person_name: string;
  } | null>(null);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRecent();
  }, []);

  const loadRecent = async () => {
    try {
      const data = await scannerApi.getRecent();
      setRecentScans(data.scans || []);
    } catch {
      // ignore
    }
  };

  const handleScan = useCallback(async (code: string) => {
    if (loading) return;
    setError("");
    setLoading(true);
    setPerson(null);
    setCheckinResult(null);

    try {
      const idData = await scannerApi.identify(code);
      setPerson(idData.person);

      const checkData = await scannerApi.checkin(code);
      setCheckinResult(checkData);
      loadRecent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сканирования");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleScan(manualCode.trim());
  };

  const clearResult = () => {
    setPerson(null);
    setCheckinResult(null);
    setError("");
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <AppLayout
      title="Сканирование"
      subtitle="Идентификация персонала по QR-коду или личному коду"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <QrScanner
              onScan={handleScan}
              active={scanning}
              onToggle={setScanning}
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-mine-amber/10 flex items-center justify-center">
                  <Icon name="Hash" size={20} className="text-mine-amber" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Ввод личного кода
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Введите персональный код сотрудника
                  </p>
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
                  className="w-full gap-2 bg-mine-amber hover:bg-mine-amber/90 text-black font-semibold"
                  disabled={!manualCode.trim() || loading}
                >
                  <Icon name="Search" size={16} />
                  {loading ? "Поиск..." : "Найти и отметить"}
                </Button>
              </form>
            </div>

            {loading && (
              <div className="rounded-xl border border-mine-cyan/20 bg-mine-cyan/5 p-6 flex items-center justify-center gap-3 animate-fade-in">
                <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
                <span className="text-sm text-mine-cyan">Идентификация...</span>
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
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-mine-red/20 text-mine-red hover:bg-mine-red/10"
                  onClick={clearResult}
                >
                  Попробовать снова
                </Button>
              </div>
            )}

            {person && checkinResult && (
              <div
                className={`rounded-xl border p-5 animate-fade-in ${
                  checkinResult.result === "allowed"
                    ? "border-mine-green/20 bg-mine-green/5 glow-green"
                    : "border-mine-red/20 bg-mine-red/5 glow-red"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      checkinResult.result === "allowed"
                        ? "bg-mine-green/20"
                        : "bg-mine-red/20"
                    }`}
                  >
                    <Icon
                      name={
                        checkinResult.result === "allowed"
                          ? "CheckCircle2"
                          : "ShieldAlert"
                      }
                      size={24}
                      className={
                        checkinResult.result === "allowed"
                          ? "text-mine-green"
                          : "text-mine-red"
                      }
                    />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {person.full_name}
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        checkinResult.result === "allowed"
                          ? "text-mine-green"
                          : "text-mine-red"
                      }`}
                    >
                      {checkinResult.message}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Код", value: person.personal_code },
                    { label: "Должность", value: person.position },
                    { label: "Подразделение", value: person.department },
                    { label: "Категория", value: person.category },
                    { label: "Медосмотр", value: person.medical_status },
                    { label: "Комната", value: person.room },
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
                  onClick={clearResult}
                >
                  Следующий
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="History" size={18} className="text-mine-amber" />
              <h3 className="text-sm font-semibold text-foreground">
                Последние сканирования
              </h3>
            </div>
            <button
              onClick={loadRecent}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Icon name="RefreshCw" size={12} />
              Обновить
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {recentScans.length === 0 ? (
              <div className="p-8 text-center">
                <Icon name="ScanLine" size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Сканирований пока нет
                </p>
              </div>
            ) : (
              recentScans.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        s.allowed ? "bg-mine-green/10" : "bg-mine-red/10"
                      }`}
                    >
                      <Icon
                        name={s.allowed ? "CheckCircle2" : "XCircle"}
                        size={20}
                        className={s.allowed ? "text-mine-green" : "text-mine-red"}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {s.person_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs text-mine-cyan font-mono">
                          {s.person_code}
                        </code>
                        <span className="text-[10px] text-muted-foreground">
                          QR-скан
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-medium ${
                        s.allowed ? "text-mine-green" : "text-mine-red"
                      }`}
                    >
                      {s.allowed ? "Допущен" : "Отказ"}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatTime(s.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Scanner;

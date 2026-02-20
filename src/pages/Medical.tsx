import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import Icon from "@/components/ui/icon";
import { useState, useEffect } from "react";
import { medicalApi } from "@/lib/api";

const medicalStatusLabels: Record<string, string> = {
  passed: "пройден",
  failed: "не пройден",
  pending: "ожидает",
  expiring: "истекает",
};

const statusColors: Record<string, string> = {
  "пройден": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "не пройден": "bg-mine-red/20 text-mine-red border-mine-red/30",
  "ожидает": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
  "истекает": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

interface MedicalRecord {
  id?: number;
  personal_code: string;
  full_name: string;
  status: string;
  checked_at?: string;
  blood_pressure?: string;
  pulse?: number;
  alcohol?: string;
  temperature?: string;
  doctor_name?: string;
}

interface MedicalStats {
  passed?: number;
  failed?: number;
  pending?: number;
  total?: number;
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

const Medical = () => {
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [stats, setStats] = useState<MedicalStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [checksRes, statsRes] = await Promise.all([
          medicalApi.getChecks(),
          medicalApi.getStats(),
        ]);
        setRecords(checksRes.checks || []);
        setStats(statsRes);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Ошибка загрузки данных";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const passed = stats.passed ?? 0;
  const failed = stats.failed ?? 0;
  const waiting = stats.pending ?? 0;
  const total = stats.total || (passed + failed + waiting) || 1;

  const filtered = records.filter(
    (r) =>
      r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.personal_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout
      title="Медицинский контроль"
      subtitle="Предсменные и послесменные медосмотры"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-mine-green/20 bg-mine-green/5 p-5 glow-green">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="CheckCircle2" size={20} className="text-mine-green" />
                <span className="text-sm font-medium text-foreground">Допущены</span>
              </div>
              <span className="text-3xl font-bold text-mine-green">{passed}</span>
            </div>
            <Progress value={(passed / total) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round((passed / total) * 100)}% от списка
            </p>
          </div>

          <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-5 glow-red">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="XCircle" size={20} className="text-mine-red" />
                <span className="text-sm font-medium text-foreground">Не допущены</span>
              </div>
              <span className="text-3xl font-bold text-mine-red">{failed}</span>
            </div>
            <Progress value={(failed / total) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round((failed / total) * 100)}% от списка
            </p>
          </div>

          <div className="rounded-xl border border-mine-amber/20 bg-mine-amber/5 p-5 glow-amber">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="Clock" size={20} className="text-mine-amber" />
                <span className="text-sm font-medium text-foreground">Ожидают</span>
              </div>
              <span className="text-3xl font-bold text-mine-amber">{waiting}</span>
            </div>
            <Progress value={(waiting / total) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round((waiting / total) * 100)}% от списка
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Поиск по ФИО или коду..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Icon name="ScanLine" size={14} />
              Сканировать QR
            </Button>
            <Button size="sm" variant="outline" className="gap-2">
              <Icon name="Download" size={14} />
              Экспорт
            </Button>
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
                    {["Код", "ФИО", "Статус", "Время", "Давление", "Пульс", "Алкоголь", "Темп.", "Врач"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const statusText = medicalStatusLabels[r.status] || r.status;
                    return (
                      <tr
                        key={r.personal_code || i}
                        className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in ${
                          statusText === "не пройден" ? "bg-mine-red/5" : ""
                        }`}
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <td className="px-4 py-3">
                          <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                            {r.personal_code}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {r.full_name}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${statusColors[statusText] || ""}`}
                          >
                            {statusText}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatTime(r.checked_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground font-mono">
                          {r.blood_pressure || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground font-mono">
                          {r.pulse || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-mono ${
                              r.alcohol && r.alcohol !== "0.0" && r.alcohol !== "—"
                                ? "text-mine-red font-semibold"
                                : "text-muted-foreground"
                            }`}
                          >
                            {r.alcohol || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground font-mono">
                          {r.temperature || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {r.doctor_name || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Medical;

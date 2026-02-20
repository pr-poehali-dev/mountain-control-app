import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useState, useEffect } from "react";
import { dispatcherApi } from "@/lib/api";

const lanternStatusLabels: Record<string, string> = {
  issued: "выдан",
  available: "доступен",
  charging: "на зарядке",
  missing: "не возвращён",
};

const actionColors: Record<string, string> = {
  "выдан": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "доступен": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "на зарядке": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "не возвращён": "bg-mine-red/20 text-mine-red border-mine-red/30",
};

const dotColors: Record<string, string> = {
  "выдан": "bg-mine-green",
  "доступен": "bg-mine-cyan",
  "на зарядке": "bg-mine-cyan",
  "не возвращён": "bg-mine-red animate-pulse-glow",
};

const textStatusColors: Record<string, string> = {
  "выдан": "text-mine-green",
  "доступен": "text-mine-cyan",
  "на зарядке": "text-mine-cyan",
  "не возвращён": "text-mine-red",
};

interface LanternItem {
  id: number;
  lantern_code: string;
  rescuer_code?: string;
  person_name?: string;
  person_code?: string;
  status: string;
  issued_at?: string;
  returned_at?: string;
}

interface DispatcherStats {
  issued?: number;
  available?: number;
  charging?: number;
  missing?: number;
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

const Dispatcher = () => {
  const [search, setSearch] = useState("");
  const [lanterns, setLanterns] = useState<LanternItem[]>([]);
  const [stats, setStats] = useState<DispatcherStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [lanternsRes, statsRes] = await Promise.all([
          dispatcherApi.getLanterns(),
          dispatcherApi.getStats(),
        ]);
        setLanterns(lanternsRes.lanterns || []);
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

  const filtered = lanterns.filter(
    (l) =>
      l.lantern_code?.toLowerCase().includes(search.toLowerCase()) ||
      l.person_name?.toLowerCase().includes(search.toLowerCase()) ||
      ""
  );

  return (
    <AppLayout
      title="Диспетчерская служба"
      subtitle="Учёт шахтных фонарей и самоспасателей"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-mine-green/20 bg-mine-green/5 p-4 glow-green">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Flashlight" size={18} className="text-mine-green" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Выдано
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.issued ?? 0}</p>
          </div>
          <div className="rounded-xl border border-mine-cyan/20 bg-mine-cyan/5 p-4 glow-cyan">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Battery" size={18} className="text-mine-cyan" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                На зарядке
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.charging ?? 0}</p>
          </div>
          <div className="rounded-xl border border-mine-amber/20 bg-mine-amber/5 p-4 glow-amber">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Package" size={18} className="text-mine-amber" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                В наличии
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.available ?? 0}</p>
          </div>
          <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-4 glow-red">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="AlertTriangle" size={18} className="text-mine-red" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Не возвращены
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.missing ?? 0}</p>
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
              placeholder="Поиск по номеру фонаря или ФИО..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2 bg-mine-green text-white hover:bg-mine-green/90">
              <Icon name="ArrowDownToLine" size={14} />
              Выдать
            </Button>
            <Button size="sm" variant="outline" className="gap-2 border-mine-cyan/30 text-mine-cyan hover:bg-mine-cyan/10">
              <Icon name="ArrowUpFromLine" size={14} />
              Принять
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
                    {["Фонарь", "Самоспасатель", "Сотрудник", "Код", "Действие", "Время", "Состояние"].map((h) => (
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
                  {filtered.map((l, i) => {
                    const statusText = lanternStatusLabels[l.status] || l.status;
                    return (
                      <tr
                        key={`${l.lantern_code}-${i}`}
                        className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in ${
                          statusText === "не возвращён" ? "bg-mine-red/5" : ""
                        }`}
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <td className="px-4 py-3">
                          <code className="text-xs text-mine-amber font-mono bg-mine-amber/10 px-1.5 py-0.5 rounded">
                            {l.lantern_code}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-muted-foreground font-mono">
                            {l.rescuer_code || "—"}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {l.person_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-mine-cyan font-mono">
                            {l.person_code || "—"}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${actionColors[statusText] || ""}`}
                          >
                            {statusText}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatTime(l.issued_at || l.returned_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${dotColors[statusText] || "bg-muted-foreground"}`}
                            />
                            <span
                              className={`text-xs ${textStatusColors[statusText] || ""}`}
                            >
                              {statusText}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
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

export default Dispatcher;

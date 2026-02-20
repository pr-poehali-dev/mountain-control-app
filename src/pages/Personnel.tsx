import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useState, useEffect, useCallback } from "react";
import { personnelApi } from "@/lib/api";

const statusLabels: Record<string, string> = {
  on_shift: "на смене",
  arrived: "прибыл",
  departed: "убыл",
  business_trip: "командировка",
};

const categoryLabels: Record<string, string> = {
  mine: "Рудничный",
  contractor: "Подрядчик",
  business_trip: "Командированный",
  guest: "Гость",
};

const statusColors: Record<string, string> = {
  "на смене": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "прибыл": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "убыл": "bg-muted text-muted-foreground border-border",
  "командировка": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const categoryColors: Record<string, string> = {
  "Рудничный": "bg-mine-amber/15 text-mine-amber border-mine-amber/25",
  "Подрядчик": "bg-mine-cyan/15 text-mine-cyan border-mine-cyan/25",
  "Командированный": "bg-mine-green/15 text-mine-green border-mine-green/25",
  "Гость": "bg-secondary text-muted-foreground border-border",
};

interface PersonnelItem {
  id?: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  category: string;
  room?: string;
  status: string;
  phone?: string;
}

interface StatsData {
  mine?: number;
  contractor?: number;
  business_trip?: number;
  guest?: number;
}

const Personnel = () => {
  const [search, setSearch] = useState("");
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [stats, setStats] = useState<StatsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [listRes, statsRes] = await Promise.all([
        personnelApi.getAll(),
        personnelApi.getStats(),
      ]);
      setPersonnel(listRes.personnel || []);
      setStats(statsRes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка загрузки данных";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      // If search is cleared, refetch all
      personnelApi.getAll().then((res) => {
        setPersonnel(res.personnel || []);
      }).catch(() => {});
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await personnelApi.search(search);
        setPersonnel(res.personnel || []);
      } catch {
        // Keep current data on search error
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [search]);

  const filtered = personnel;

  return (
    <AppLayout title="Персонал" subtitle="Учёт и контроль сотрудников рудника">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Поиск по ФИО, коду, подразделению..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Icon name="Filter" size={14} />
              Фильтр
            </Button>
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Icon name="UserPlus" size={14} />
              Добавить
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-mine-amber/20 bg-mine-amber/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-amber">{stats.mine ?? 0}</p>
            <p className="text-xs text-muted-foreground">Рудничных</p>
          </div>
          <div className="rounded-lg border border-mine-cyan/20 bg-mine-cyan/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-cyan">{stats.contractor ?? 0}</p>
            <p className="text-xs text-muted-foreground">Подрядчиков</p>
          </div>
          <div className="rounded-lg border border-mine-green/20 bg-mine-green/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-green">{stats.business_trip ?? 0}</p>
            <p className="text-xs text-muted-foreground">Командированных</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.guest ?? 0}</p>
            <p className="text-xs text-muted-foreground">Гостей</p>
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
                    {["Код", "ФИО", "Должность", "Подразделение", "Категория", "Комната", "Статус"].map((h) => (
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
                  {filtered.map((p, i) => {
                    const statusText = statusLabels[p.status] || p.status;
                    const categoryText = categoryLabels[p.category] || p.category;
                    return (
                      <tr
                        key={p.personal_code || i}
                        className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-4 py-3">
                          <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                            {p.personal_code}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {p.full_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {p.position}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {p.department}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${categoryColors[categoryText] || ""}`}
                          >
                            {categoryText}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {p.room || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${statusColors[statusText] || ""}`}
                          >
                            {statusText}
                          </Badge>
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

export default Personnel;

import { Progress } from "@/components/ui/progress";
import Icon from "@/components/ui/icon";

interface DashboardData {
  on_site?: number;
  by_category?: Record<string, number>;
}

interface ShiftOverviewProps {
  dashboard?: DashboardData;
  loading?: boolean;
}

const categoryLabels: Record<string, string> = {
  mine: "Рудничные",
  contractor: "Подрядчики",
  business_trip: "Командированные",
  guest: "Гости",
};

const categoryColors: Record<string, string> = {
  mine: "bg-mine-amber",
  contractor: "bg-mine-cyan",
  business_trip: "bg-mine-green",
  guest: "bg-muted-foreground",
};

export default function ShiftOverview({ dashboard, loading }: ShiftOverviewProps) {
  const onSite = dashboard?.on_site || 0;
  const byCategory = dashboard?.by_category || {};

  const categories = Object.entries(byCategory).map(([key, count]) => ({
    label: categoryLabels[key] || key,
    count,
    color: categoryColors[key] || "bg-muted-foreground",
  }));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Icon name="Clock" size={18} className="text-mine-amber" />
        <h3 className="text-sm font-semibold text-foreground">Смены</h3>
      </div>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-mine-green animate-pulse-glow" />
                  <span className="text-sm font-medium text-foreground">
                    Текущая смена
                  </span>
                  <span className="text-xs text-muted-foreground">
                    08:00-20:00
                  </span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {onSite}
                </span>
              </div>
              <Progress
                value={onSite > 0 ? Math.min((onSite / 60) * 100, 100) : 0}
                className="h-1.5"
              />
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
                По категориям
              </p>
              <div className="space-y-2">
                {categories.map((c) => (
                  <div key={c.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-sm ${c.color}`} />
                      <span className="text-sm text-muted-foreground">
                        {c.label}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {c.count}
                    </span>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-xs text-muted-foreground">Нет данных</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

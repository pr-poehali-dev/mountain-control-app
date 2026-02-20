import Icon from "@/components/ui/icon";

interface DashboardData {
  lanterns_issued?: number;
  lanterns_total?: number;
}

interface LanternStatusProps {
  dashboard?: DashboardData;
  loading?: boolean;
}

export default function LanternStatus({ dashboard, loading }: LanternStatusProps) {
  const issued = dashboard?.lanterns_issued || 0;
  const total = dashboard?.lanterns_total || 0;
  const available = total - issued;
  const pct = total > 0 ? Math.round((issued / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Icon name="Flashlight" size={18} className="text-mine-amber" />
        <h3 className="text-sm font-semibold text-foreground">
          Шахтные фонари и самоспасатели
        </h3>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">
                  Выдано
                </span>
                <span className="text-xs font-medium text-mine-amber">
                  {pct}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-mine-amber transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">
                  Выдано: {issued}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Всего: {total}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">
                  Доступно
                </span>
                <span className="text-xs font-medium text-mine-green">
                  {total > 0 ? Math.round((available / total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-mine-green transition-all"
                  style={{ width: `${total > 0 ? (available / total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">
                  Свободно: {available}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Всего: {total}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

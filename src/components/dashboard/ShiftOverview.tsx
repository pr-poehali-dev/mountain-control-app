import { Progress } from "@/components/ui/progress";
import Icon from "@/components/ui/icon";

const shifts = [
  { name: "Смена А", total: 52, present: 47, start: "08:00", end: "20:00", active: true },
  { name: "Смена Б", total: 48, present: 0, start: "20:00", end: "08:00", active: false },
];

const categories = [
  { label: "Рудничные", count: 31, color: "bg-mine-amber" },
  { label: "Подрядчики", count: 12, color: "bg-mine-cyan" },
  { label: "Командированные", count: 6, color: "bg-mine-green" },
  { label: "Гости", count: 3, color: "bg-muted-foreground" },
];

export default function ShiftOverview() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Icon name="Clock" size={18} className="text-mine-amber" />
        <h3 className="text-sm font-semibold text-foreground">Смены</h3>
      </div>
      <div className="p-4 space-y-4">
        {shifts.map((s) => (
          <div key={s.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {s.active && (
                  <span className="w-2 h-2 rounded-full bg-mine-green animate-pulse-glow" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {s.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.start}–{s.end}
                </span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {s.present}
                <span className="text-muted-foreground font-normal">
                  /{s.total}
                </span>
              </span>
            </div>
            <Progress
              value={s.total > 0 ? (s.present / s.total) * 100 : 0}
              className="h-1.5"
            />
          </div>
        ))}

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
          </div>
        </div>
      </div>
    </div>
  );
}

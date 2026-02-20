import Icon from "@/components/ui/icon";

const lanterns = [
  { id: "001–050", total: 50, issued: 38, color: "mine-green" },
  { id: "051–100", total: 50, issued: 22, color: "mine-amber" },
  { id: "101–150", total: 50, issued: 45, color: "mine-red" },
  { id: "151–200", total: 50, issued: 10, color: "mine-cyan" },
];

export default function LanternStatus() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Icon name="Flashlight" size={18} className="text-mine-amber" />
        <h3 className="text-sm font-semibold text-foreground">
          Шахтные фонари и самоспасатели
        </h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {lanterns.map((l) => {
          const pct = Math.round((l.issued / l.total) * 100);
          return (
            <div
              key={l.id}
              className="rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">
                  №{l.id}
                </span>
                <span className={`text-xs font-medium text-${l.color}`}>
                  {pct}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full bg-${l.color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">
                  Выдано: {l.issued}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Всего: {l.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-mine-amber/5 border border-mine-amber/20">
          <div className="flex items-center gap-2">
            <Icon name="AlertTriangle" size={16} className="text-mine-amber" />
            <span className="text-xs text-mine-amber">
              3 фонаря не возвращены (смена Б)
            </span>
          </div>
          <Icon name="ChevronRight" size={14} className="text-mine-amber" />
        </div>
      </div>
    </div>
  );
}

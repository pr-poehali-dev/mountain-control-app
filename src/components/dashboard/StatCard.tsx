import Icon from "@/components/ui/icon";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: string;
  color: "amber" | "cyan" | "green" | "red";
  onClick?: () => void;
  actionHint?: string;
}

const colorMap = {
  amber: {
    bg: "bg-mine-amber/10",
    border: "border-mine-amber/20",
    icon: "text-mine-amber",
    glow: "glow-amber",
  },
  cyan: {
    bg: "bg-mine-cyan/10",
    border: "border-mine-cyan/20",
    icon: "text-mine-cyan",
    glow: "glow-cyan",
  },
  green: {
    bg: "bg-mine-green/10",
    border: "border-mine-green/20",
    icon: "text-mine-green",
    glow: "glow-green",
  },
  red: {
    bg: "bg-mine-red/10",
    border: "border-mine-red/20",
    icon: "text-mine-red",
    glow: "glow-red",
  },
};

export default function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  color,
  onClick,
  actionHint,
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      title={actionHint}
      className={`relative rounded-xl border ${c.border} ${c.bg} p-5 ${c.glow} animate-fade-in transition-all hover:scale-[1.02] ${onClick ? "cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" : ""}`}
    >
      {onClick && (
        <span className="absolute bottom-3 right-4 flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
          {actionHint || "Подробнее"}
          <Icon name="ChevronRight" size={12} />
        </span>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {title}
          </p>
          <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              <Icon
                name={
                  changeType === "up"
                    ? "TrendingUp"
                    : changeType === "down"
                    ? "TrendingDown"
                    : "Minus"
                }
                size={14}
                className={
                  changeType === "up"
                    ? "text-mine-green"
                    : changeType === "down"
                    ? "text-mine-red"
                    : "text-muted-foreground"
                }
              />
              <span
                className={`text-xs ${
                  changeType === "up"
                    ? "text-mine-green"
                    : changeType === "down"
                    ? "text-mine-red"
                    : "text-muted-foreground"
                }`}
              >
                {change}
              </span>
            </div>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}
        >
          <Icon name={icon} size={20} className={c.icon} />
        </div>
      </div>
    </div>
  );
}

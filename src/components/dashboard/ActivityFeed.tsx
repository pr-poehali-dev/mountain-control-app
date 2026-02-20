import Icon from "@/components/ui/icon";

const activities = [
  { time: "08:42", text: "Иванов А.С. — прошёл медосмотр", icon: "HeartPulse", color: "text-mine-green" },
  { time: "08:38", text: "Фонарь №147 — выдан Петрову В.И.", icon: "Flashlight", color: "text-mine-amber" },
  { time: "08:35", text: "Козлов Д.М. — прибыл (командировка)", icon: "UserPlus", color: "text-mine-cyan" },
  { time: "08:30", text: "Смена А — начало (47 человек)", icon: "Clock", color: "text-mine-amber" },
  { time: "08:25", text: "Сидоров К.Н. — не прошёл медосмотр", icon: "AlertTriangle", color: "text-mine-red" },
  { time: "08:20", text: "Николаев Е.П. — убыл с объекта", icon: "UserMinus", color: "text-muted-foreground" },
  { time: "08:15", text: "Комната 312 — заселение Фёдоров Г.А.", icon: "Home", color: "text-mine-cyan" },
  { time: "08:10", text: "Фонарь №089 — возвращён (норма)", icon: "Flashlight", color: "text-mine-green" },
];

export default function ActivityFeed() {
  return (
    <div className="rounded-xl border border-border bg-card h-full">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Icon name="Activity" size={18} className="text-mine-cyan" />
        <h3 className="text-sm font-semibold text-foreground">
          Лента событий
        </h3>
      </div>
      <div className="p-2 space-y-0.5 max-h-[400px] overflow-y-auto">
        {activities.map((a, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors animate-fade-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="mt-0.5">
              <Icon name={a.icon} size={16} className={a.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">{a.text}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Сегодня, {a.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

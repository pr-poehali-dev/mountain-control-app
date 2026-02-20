import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

const reports = [
  { title: "Посещаемость за смену", desc: "Кто прибыл / убыл, по категориям", icon: "Users", color: "amber", date: "Ежедневно" },
  { title: "Медосмотры", desc: "Пройденные, не пройденные, причины отстранения", icon: "HeartPulse", color: "green", date: "Ежедневно" },
  { title: "Выдача фонарей", desc: "Статистика выдачи и возврата, просроченные", icon: "Flashlight", color: "cyan", date: "Ежедневно" },
  { title: "Жилой фонд", desc: "Заселение, выселение, загрузка по комнатам", icon: "Home", color: "red", date: "Еженедельно" },
  { title: "Сводный по персоналу", desc: "Все категории: рудничные, подрядчики, гости", icon: "BarChart3", color: "amber", date: "Еженедельно" },
  { title: "Журнал событий", desc: "Полный лог всех действий в системе", icon: "FileText", color: "cyan", date: "По запросу" },
];

const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
  amber: { bg: "bg-mine-amber/10", border: "border-mine-amber/20", icon: "text-mine-amber" },
  cyan: { bg: "bg-mine-cyan/10", border: "border-mine-cyan/20", icon: "text-mine-cyan" },
  green: { bg: "bg-mine-green/10", border: "border-mine-green/20", icon: "text-mine-green" },
  red: { bg: "bg-mine-red/10", border: "border-mine-red/20", icon: "text-mine-red" },
};

const Reports = () => {
  return (
    <AppLayout title="Отчёты" subtitle="Формирование и экспорт отчётной документации">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Доступно {reports.length} типов отчётов
          </p>
          <Button size="sm" variant="outline" className="gap-2">
            <Icon name="Calendar" size={14} />
            Выбрать период
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r, i) => {
            const c = colorMap[r.color];
            return (
              <div
                key={r.title}
                className={`rounded-xl border ${c.border} ${c.bg} p-5 hover:scale-[1.02] transition-all cursor-pointer animate-fade-in group`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <Icon name={r.icon} size={20} className={c.icon} />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1 rounded bg-secondary/50">
                    {r.date}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {r.title}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">{r.desc}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs flex-1 border-border"
                  >
                    <Icon name="Eye" size={12} />
                    Просмотр
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs flex-1 border-border"
                  >
                    <Icon name="Download" size={12} />
                    Экспорт
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;

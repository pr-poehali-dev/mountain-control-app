import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";

const personnel = [
  { id: "МК-001", name: "Иванов А.С.", role: "Горнорабочий", dept: "Участок №3", status: "на смене", medical: "пройден" },
  { id: "МК-002", name: "Петров В.И.", role: "Электрослесарь", dept: "Участок №1", status: "на смене", medical: "пройден" },
  { id: "МК-003", name: "Сидоров К.Н.", role: "Маркшейдер", dept: "Геология", status: "прибыл", medical: "не пройден" },
  { id: "МК-004", name: "Козлов Д.М.", role: "Подрядчик", dept: "СтройМонтаж", status: "командировка", medical: "пройден" },
  { id: "МК-005", name: "Николаев Е.П.", role: "Взрывник", dept: "Участок №2", status: "убыл", medical: "пройден" },
  { id: "МК-006", name: "Фёдоров Г.А.", role: "Механик", dept: "Мех.цех", status: "на смене", medical: "истекает" },
];

const statusColors: Record<string, string> = {
  "на смене": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "прибыл": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "убыл": "bg-muted text-muted-foreground border-border",
  "командировка": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const medicalColors: Record<string, string> = {
  "пройден": "text-mine-green",
  "не пройден": "text-mine-red",
  "истекает": "text-mine-amber",
};

export default function PersonnelTable() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="Users" size={18} className="text-mine-amber" />
          <h3 className="text-sm font-semibold text-foreground">
            Персонал на объекте
          </h3>
        </div>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <span>Все записи</span>
          <Icon name="ArrowRight" size={14} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Код
              </th>
              <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                ФИО
              </th>
              <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Должность
              </th>
              <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Подразделение
              </th>
              <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Статус
              </th>
              <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Медосмотр
              </th>
            </tr>
          </thead>
          <tbody>
            {personnel.map((p, i) => (
              <tr
                key={p.id}
                className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <td className="px-4 py-3">
                  <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                    {p.id}
                  </code>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {p.name}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {p.role}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {p.dept}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${statusColors[p.status] || ""}`}
                  >
                    {p.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      name={
                        p.medical === "пройден"
                          ? "CheckCircle2"
                          : p.medical === "не пройден"
                          ? "XCircle"
                          : "AlertCircle"
                      }
                      size={14}
                      className={medicalColors[p.medical] || ""}
                    />
                    <span
                      className={`text-xs ${medicalColors[p.medical] || ""}`}
                    >
                      {p.medical}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

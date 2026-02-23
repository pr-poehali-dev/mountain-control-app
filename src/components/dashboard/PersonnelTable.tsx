import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";

const statusLabels: Record<string, string> = {
  on_shift: "на смене",
  arrived: "прибыл",
  departed: "убыл",
  business_trip: "командировка",
};

const medicalLabels: Record<string, string> = {
  passed: "пройден",
  failed: "не пройден",
  pending: "ожидает",
  expiring: "истекает",
};

const statusColors: Record<string, string> = {
  "на смене": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "прибыл": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "убыл": "bg-muted text-muted-foreground border-border",
  "командировка": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const medicalColors: Record<string, string> = {
  "пройден": "text-mine-green",
  "не пройден": "text-mine-red",
  "ожидает": "text-mine-amber",
  "истекает": "text-mine-amber",
};

interface PersonnelItem {
  id?: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  status: string;
  medical_status?: string;
  tab_number?: string;
}

interface PersonnelTableProps {
  data?: PersonnelItem[];
  loading?: boolean;
}

export default function PersonnelTable({ data, loading }: PersonnelTableProps) {
  const personnel = (data || []).slice(0, 6);

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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
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
                  Таб. №
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
              {personnel.map((p, i) => {
                const statusText = statusLabels[p.status] || p.status;
                const medicalText = medicalLabels[p.medical_status || ""] || p.medical_status || "—";
                return (
                  <tr
                    key={p.personal_code || i}
                    className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-4 py-3">
                      <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                        {p.personal_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {p.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                      {p.tab_number || "—"}
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
                        className={`text-[11px] ${statusColors[statusText] || ""}`}
                      >
                        {statusText}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon
                          name={
                            medicalText === "пройден"
                              ? "CheckCircle2"
                              : medicalText === "не пройден"
                              ? "XCircle"
                              : "AlertCircle"
                          }
                          size={14}
                          className={medicalColors[medicalText] || ""}
                        />
                        <span
                          className={`text-xs ${medicalColors[medicalText] || ""}`}
                        >
                          {medicalText}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {personnel.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
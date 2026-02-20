import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import Icon from "@/components/ui/icon";
import { useState } from "react";

const medicalRecords = [
  { id: "МК-001", name: "Иванов А.С.", status: "пройден", time: "08:42", bp: "120/80", pulse: 72, alcohol: "0.0", temp: "36.6", doctor: "Смирнова Е.В." },
  { id: "МК-002", name: "Петров В.И.", status: "пройден", time: "08:38", bp: "130/85", pulse: 78, alcohol: "0.0", temp: "36.4", doctor: "Смирнова Е.В." },
  { id: "МК-003", name: "Сидоров К.Н.", status: "не пройден", time: "08:35", bp: "155/95", pulse: 92, alcohol: "0.12", temp: "37.2", doctor: "Смирнова Е.В." },
  { id: "МК-006", name: "Фёдоров Г.А.", status: "пройден", time: "08:30", bp: "125/82", pulse: 68, alcohol: "0.0", temp: "36.5", doctor: "Козлова И.А." },
  { id: "МК-007", name: "Волков А.П.", status: "пройден", time: "08:25", bp: "118/76", pulse: 65, alcohol: "0.0", temp: "36.7", doctor: "Козлова И.А." },
  { id: "МК-008", name: "Морозов С.Д.", status: "ожидает", time: "—", bp: "—", pulse: 0, alcohol: "—", temp: "—", doctor: "—" },
  { id: "МК-009", name: "Лебедев И.В.", status: "ожидает", time: "—", bp: "—", pulse: 0, alcohol: "—", temp: "—", doctor: "—" },
];

const statusColors: Record<string, string> = {
  "пройден": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "не пройден": "bg-mine-red/20 text-mine-red border-mine-red/30",
  "ожидает": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const Medical = () => {
  const [search, setSearch] = useState("");

  const passed = medicalRecords.filter((r) => r.status === "пройден").length;
  const failed = medicalRecords.filter((r) => r.status === "не пройден").length;
  const waiting = medicalRecords.filter((r) => r.status === "ожидает").length;
  const total = medicalRecords.length;

  const filtered = medicalRecords.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout
      title="Медицинский контроль"
      subtitle="Предсменные и послесменные медосмотры"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-mine-green/20 bg-mine-green/5 p-5 glow-green">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="CheckCircle2" size={20} className="text-mine-green" />
                <span className="text-sm font-medium text-foreground">Допущены</span>
              </div>
              <span className="text-3xl font-bold text-mine-green">{passed}</span>
            </div>
            <Progress value={(passed / total) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round((passed / total) * 100)}% от списка
            </p>
          </div>

          <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-5 glow-red">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="XCircle" size={20} className="text-mine-red" />
                <span className="text-sm font-medium text-foreground">Не допущены</span>
              </div>
              <span className="text-3xl font-bold text-mine-red">{failed}</span>
            </div>
            <Progress value={(failed / total) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round((failed / total) * 100)}% от списка
            </p>
          </div>

          <div className="rounded-xl border border-mine-amber/20 bg-mine-amber/5 p-5 glow-amber">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="Clock" size={20} className="text-mine-amber" />
                <span className="text-sm font-medium text-foreground">Ожидают</span>
              </div>
              <span className="text-3xl font-bold text-mine-amber">{waiting}</span>
            </div>
            <Progress value={(waiting / total) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round((waiting / total) * 100)}% от списка
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Поиск по ФИО или коду..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Icon name="ScanLine" size={14} />
              Сканировать QR
            </Button>
            <Button size="sm" variant="outline" className="gap-2">
              <Icon name="Download" size={14} />
              Экспорт
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Код", "ФИО", "Статус", "Время", "Давление", "Пульс", "Алкоголь", "Темп.", "Врач"].map((h) => (
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
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in ${
                      r.status === "не пройден" ? "bg-mine-red/5" : ""
                    }`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-4 py-3">
                      <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                        {r.id}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {r.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${statusColors[r.status] || ""}`}
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.time}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground font-mono">
                      {r.bp}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground font-mono">
                      {r.pulse || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-mono ${
                          r.alcohol !== "0.0" && r.alcohol !== "—"
                            ? "text-mine-red font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {r.alcohol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground font-mono">
                      {r.temp}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.doctor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Medical;

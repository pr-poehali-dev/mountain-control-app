import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useState } from "react";

const lanternLog = [
  { id: "Ф-001", person: "Иванов А.С.", code: "МК-001", action: "выдан", time: "08:05", rescuer: "СС-001", status: "активен" },
  { id: "Ф-012", person: "Петров В.И.", code: "МК-002", action: "выдан", time: "08:08", rescuer: "СС-012", status: "активен" },
  { id: "Ф-023", person: "Волков А.П.", code: "МК-007", action: "выдан", time: "08:12", rescuer: "СС-023", status: "активен" },
  { id: "Ф-089", person: "Морозов С.Д.", code: "МК-008", action: "возвращён", time: "07:55", rescuer: "СС-089", status: "на зарядке" },
  { id: "Ф-147", person: "—", code: "—", action: "не возвращён", time: "вчера 20:15", rescuer: "СС-147", status: "тревога" },
  { id: "Ф-033", person: "Фёдоров Г.А.", code: "МК-006", action: "выдан", time: "08:15", rescuer: "СС-033", status: "активен" },
];

const actionColors: Record<string, string> = {
  "выдан": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "возвращён": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "не возвращён": "bg-mine-red/20 text-mine-red border-mine-red/30",
};

const statusColors: Record<string, string> = {
  "активен": "text-mine-green",
  "на зарядке": "text-mine-cyan",
  "тревога": "text-mine-red",
};

const Dispatcher = () => {
  const [search, setSearch] = useState("");

  const filtered = lanternLog.filter(
    (l) =>
      l.id.toLowerCase().includes(search.toLowerCase()) ||
      l.person.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout
      title="Диспетчерская служба"
      subtitle="Учёт шахтных фонарей и самоспасателей"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-mine-green/20 bg-mine-green/5 p-4 glow-green">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Flashlight" size={18} className="text-mine-green" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Выдано
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">115</p>
          </div>
          <div className="rounded-xl border border-mine-cyan/20 bg-mine-cyan/5 p-4 glow-cyan">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Battery" size={18} className="text-mine-cyan" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                На зарядке
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">42</p>
          </div>
          <div className="rounded-xl border border-mine-amber/20 bg-mine-amber/5 p-4 glow-amber">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Package" size={18} className="text-mine-amber" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                В наличии
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">40</p>
          </div>
          <div className="rounded-xl border border-mine-red/20 bg-mine-red/5 p-4 glow-red">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="AlertTriangle" size={18} className="text-mine-red" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Не возвращены
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">3</p>
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
              placeholder="Поиск по номеру фонаря или ФИО..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2 bg-mine-green text-white hover:bg-mine-green/90">
              <Icon name="ArrowDownToLine" size={14} />
              Выдать
            </Button>
            <Button size="sm" variant="outline" className="gap-2 border-mine-cyan/30 text-mine-cyan hover:bg-mine-cyan/10">
              <Icon name="ArrowUpFromLine" size={14} />
              Принять
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Фонарь", "Самоспасатель", "Сотрудник", "Код", "Действие", "Время", "Состояние"].map((h) => (
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
                {filtered.map((l, i) => (
                  <tr
                    key={`${l.id}-${i}`}
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in ${
                      l.action === "не возвращён" ? "bg-mine-red/5" : ""
                    }`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-4 py-3">
                      <code className="text-xs text-mine-amber font-mono bg-mine-amber/10 px-1.5 py-0.5 rounded">
                        {l.id}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-muted-foreground font-mono">
                        {l.rescuer}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {l.person}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-mine-cyan font-mono">
                        {l.code}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${actionColors[l.action] || ""}`}
                      >
                        {l.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {l.time}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            l.status === "активен"
                              ? "bg-mine-green"
                              : l.status === "тревога"
                              ? "bg-mine-red animate-pulse-glow"
                              : "bg-mine-cyan"
                          }`}
                        />
                        <span
                          className={`text-xs ${statusColors[l.status] || ""}`}
                        >
                          {l.status}
                        </span>
                      </div>
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

export default Dispatcher;

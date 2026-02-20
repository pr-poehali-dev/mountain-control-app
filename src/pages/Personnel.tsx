import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useState } from "react";

const allPersonnel = [
  { id: "МК-001", name: "Иванов Алексей Сергеевич", role: "Горнорабочий", dept: "Участок №3", category: "Рудничный", room: "301", status: "на смене", phone: "+7 (900) 111-22-33" },
  { id: "МК-002", name: "Петров Виталий Иванович", role: "Электрослесарь", dept: "Участок №1", category: "Рудничный", room: "215", status: "на смене", phone: "+7 (900) 222-33-44" },
  { id: "МК-003", name: "Сидоров Кирилл Николаевич", role: "Маркшейдер", dept: "Геология", category: "Командированный", room: "108", status: "прибыл", phone: "+7 (900) 333-44-55" },
  { id: "МК-004", name: "Козлов Дмитрий Михайлович", role: "Монтажник", dept: "СтройМонтаж", category: "Подрядчик", room: "412", status: "командировка", phone: "+7 (900) 444-55-66" },
  { id: "МК-005", name: "Николаев Евгений Петрович", role: "Взрывник", dept: "Участок №2", category: "Рудничный", room: "205", status: "убыл", phone: "+7 (900) 555-66-77" },
  { id: "МК-006", name: "Фёдоров Геннадий Андреевич", role: "Механик", dept: "Мех.цех", category: "Рудничный", room: "312", status: "на смене", phone: "+7 (900) 666-77-88" },
  { id: "МК-007", name: "Волков Артём Павлович", role: "Проходчик", dept: "Участок №1", category: "Рудничный", room: "303", status: "на смене", phone: "+7 (900) 777-88-99" },
  { id: "МК-008", name: "Морозов Сергей Дмитриевич", role: "Инженер ОТ", dept: "ОТиПБ", category: "Рудничный", room: "107", status: "на смене", phone: "+7 (900) 888-99-00" },
  { id: "МК-009", name: "Лебедев Игорь Валерьевич", role: "Геолог", dept: "Геология", category: "Гость", room: "—", status: "прибыл", phone: "+7 (900) 999-00-11" },
];

const statusColors: Record<string, string> = {
  "на смене": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "прибыл": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "убыл": "bg-muted text-muted-foreground border-border",
  "командировка": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const categoryColors: Record<string, string> = {
  "Рудничный": "bg-mine-amber/15 text-mine-amber border-mine-amber/25",
  "Подрядчик": "bg-mine-cyan/15 text-mine-cyan border-mine-cyan/25",
  "Командированный": "bg-mine-green/15 text-mine-green border-mine-green/25",
  "Гость": "bg-secondary text-muted-foreground border-border",
};

const Personnel = () => {
  const [search, setSearch] = useState("");

  const filtered = allPersonnel.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.dept.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Персонал" subtitle="Учёт и контроль сотрудников рудника">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Поиск по ФИО, коду, подразделению..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Icon name="Filter" size={14} />
              Фильтр
            </Button>
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Icon name="UserPlus" size={14} />
              Добавить
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-mine-amber/20 bg-mine-amber/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-amber">31</p>
            <p className="text-xs text-muted-foreground">Рудничных</p>
          </div>
          <div className="rounded-lg border border-mine-cyan/20 bg-mine-cyan/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-cyan">12</p>
            <p className="text-xs text-muted-foreground">Подрядчиков</p>
          </div>
          <div className="rounded-lg border border-mine-green/20 bg-mine-green/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-green">6</p>
            <p className="text-xs text-muted-foreground">Командированных</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
            <p className="text-2xl font-bold text-foreground">3</p>
            <p className="text-xs text-muted-foreground">Гостей</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Код", "ФИО", "Должность", "Подразделение", "Категория", "Комната", "Статус"].map((h) => (
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
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
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
                        className={`text-[11px] ${categoryColors[p.category] || ""}`}
                      >
                        {p.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                      {p.room}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${statusColors[p.status] || ""}`}
                      >
                        {p.status}
                      </Badge>
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

export default Personnel;

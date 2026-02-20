import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useState, useEffect } from "react";
import { ahoApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const users = [
  { id: 1, name: "Иванов А.С.", email: "ivanov@rudnik.ru", role: "Оператор", dept: "Участок №3", active: true },
  { id: 2, name: "Смирнова Е.В.", email: "smirnova@rudnik.ru", role: "Врач", dept: "Медпункт", active: true },
  { id: 3, name: "Козлова И.А.", email: "kozlova@rudnik.ru", role: "Врач", dept: "Медпункт", active: true },
  { id: 4, name: "Громов П.Р.", email: "gromov@rudnik.ru", role: "Диспетчер", dept: "Диспетчерская", active: true },
  { id: 5, name: "Орлов М.К.", email: "orlov@rudnik.ru", role: "Администратор", dept: "ИТ", active: true },
  { id: 6, name: "Борисов Н.Л.", email: "borisov@rudnik.ru", role: "Оператор", dept: "КПП", active: false },
];

const roleColors: Record<string, string> = {
  "Администратор": "bg-mine-red/20 text-mine-red border-mine-red/30",
  "Врач": "bg-mine-green/20 text-mine-green border-mine-green/30",
  "Диспетчер": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
  "Оператор": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
};

const systemModules = [
  { name: "Персонал", status: "активен", uptime: "99.8%", icon: "Users", color: "text-mine-amber" },
  { name: "Диспетчерская", status: "активен", uptime: "99.9%", icon: "Radio", color: "text-mine-cyan" },
  { name: "Медконтроль", status: "активен", uptime: "100%", icon: "HeartPulse", color: "text-mine-green" },
  { name: "АХО", status: "активен", uptime: "100%", icon: "Building2", color: "text-mine-amber" },
];

const Admin = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [itrPositions, setItrPositions] = useState<string[]>([]);
  const [newPosition, setNewPosition] = useState("");
  const [itrLoading, setItrLoading] = useState(false);

  useEffect(() => {
    loadItrPositions();
  }, []);

  const loadItrPositions = async () => {
    try {
      const data = await ahoApi.getItrPositions();
      setItrPositions(data.positions || []);
    } catch { /* ignore */ }
  };

  const handleAddPosition = () => {
    const val = newPosition.trim();
    if (!val) return;
    if (itrPositions.some(p => p.toLowerCase() === val.toLowerCase())) {
      toast({ title: "Такая должность уже есть", variant: "destructive" });
      return;
    }
    setItrPositions([...itrPositions, val]);
    setNewPosition("");
  };

  const handleRemovePosition = (idx: number) => {
    setItrPositions(itrPositions.filter((_, i) => i !== idx));
  };

  const handleSavePositions = async () => {
    setItrLoading(true);
    try {
      const res = await ahoApi.saveItrPositions(itrPositions);
      toast({ title: res.message });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка сохранения", variant: "destructive" });
    } finally { setItrLoading(false); }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Администрирование" subtitle="Управление пользователями и системой">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {systemModules.map((m, i) => (
            <div
              key={m.name}
              className="rounded-xl border border-border bg-card p-4 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon name={m.icon} size={20} className={m.color} />
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-mine-green animate-pulse-glow" />
                  <span className="text-xs text-mine-green">{m.status}</span>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground">
                Uptime: {m.uptime}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="Shield" size={18} className="text-mine-amber" />
                <h3 className="text-sm font-semibold text-foreground">
                  Пользователи системы
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Icon
                    name="Search"
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    placeholder="Поиск..."
                    className="pl-8 h-8 text-xs bg-secondary/50 border-border w-48"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs">
                  <Icon name="UserPlus" size={12} />
                  Добавить
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Имя", "Email", "Роль", "Подразделение", "Статус", "Действия"].map((h) => (
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
                  {filtered.map((u, i) => (
                    <tr
                      key={u.id}
                      className="border-b border-border/50 hover:bg-secondary/50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {u.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${roleColors[u.role] || "bg-secondary text-muted-foreground"}`}
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {u.dept}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              u.active ? "bg-mine-green" : "bg-muted-foreground"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {u.active ? "Активен" : "Отключён"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="p-1.5 rounded hover:bg-secondary transition-colors">
                            <Icon name="Pencil" size={14} className="text-muted-foreground" />
                          </button>
                          <button className="p-1.5 rounded hover:bg-mine-red/10 transition-colors">
                            <Icon name="Trash2" size={14} className="text-mine-red/60" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="Briefcase" size={18} className="text-mine-amber" />
                <h3 className="text-sm font-semibold text-foreground">Должности ИТР</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Список используется для автоматической классификации ИТР / рабочие в медосмотре АХО
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Новая должность..."
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPosition()}
                  className="bg-secondary/50 h-8 text-xs flex-1"
                />
                <Button size="sm" variant="outline" className="h-8 px-3" onClick={handleAddPosition}>
                  <Icon name="Plus" size={14} />
                </Button>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {itrPositions.map((pos, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/30 group hover:bg-secondary/50 transition-colors">
                    <Icon name="Briefcase" size={12} className="text-mine-amber/60" />
                    <span className="text-xs flex-1">{pos}</span>
                    <button
                      onClick={() => handleRemovePosition(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-mine-red/10 transition-all"
                    >
                      <Icon name="X" size={12} className="text-mine-red" />
                    </button>
                  </div>
                ))}
                {itrPositions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Список пуст. Добавьте должности ИТР
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {itrPositions.length} должностей
                </span>
                <Button size="sm" className="gap-1.5 h-8 bg-mine-amber text-white hover:bg-mine-amber/90" onClick={handleSavePositions} disabled={itrLoading}>
                  <Icon name="Save" size={14} />
                  {itrLoading ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Admin;

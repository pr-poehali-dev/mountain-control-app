import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useState, useEffect } from "react";
import { ahoApi, authApi } from "@/lib/api";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SystemUser {
  id: number;
  email: string;
  full_name: string;
  position: string;
  department: string;
  personal_code: string;
  role: string;
  is_active: boolean;
  organization: string;
  organization_type: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-mine-red/20 text-mine-red border-mine-red/30",
  doctor: "bg-mine-green/20 text-mine-green border-mine-green/30",
  dispatcher: "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
  operator: "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  aho_specialist: "bg-mine-purple/20 text-mine-purple border-mine-purple/30",
  security: "bg-mine-red/15 text-mine-red border-mine-red/25",
};

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  operator: "Оператор",
  dispatcher: "Диспетчер",
  doctor: "Врач",
  aho_specialist: "Специалист АХО",
  security: "СБ",
};

const roleOptions = [
  { value: "admin", label: "Администратор" },
  { value: "operator", label: "Оператор" },
  { value: "dispatcher", label: "Диспетчер" },
  { value: "doctor", label: "Врач" },
  { value: "aho_specialist", label: "Специалист АХО" },
  { value: "security", label: "СБ" },
];

const pageLabels: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Дашборд", icon: "LayoutDashboard" },
  personnel: { label: "Персонал", icon: "Users" },
  dispatcher: { label: "Диспетчерская", icon: "Radio" },
  medical: { label: "Медконтроль", icon: "HeartPulse" },
  lampa: { label: "Ламповая", icon: "Lightbulb" },
  scanner: { label: "Сканирование", icon: "ScanLine" },
  aho: { label: "АХО", icon: "Building2" },
  reports: { label: "Отчёты", icon: "BarChart3" },
};

const editableRoles = ["operator", "dispatcher", "doctor", "aho_specialist", "security"];

const systemModules = [
  { name: "Персонал", status: "активен", uptime: "99.8%", icon: "Users", color: "text-mine-amber" },
  { name: "Диспетчерская", status: "активен", uptime: "99.9%", icon: "Radio", color: "text-mine-cyan" },
  { name: "Медконтроль", status: "активен", uptime: "100%", icon: "HeartPulse", color: "text-mine-green" },
  { name: "АХО", status: "активен", uptime: "100%", icon: "Building2", color: "text-mine-amber" },
];

const resetOptions = [
  {
    value: "personnel",
    label: "Обнулить список персонала",
    description: "Скрывает всех сотрудников кроме администраторов. Данные сохраняются в БД для выгрузки.",
    icon: "Users",
    color: "text-mine-amber",
    danger: false,
  },
  {
    value: "aho_arrivals",
    label: "Обнулить список заехавших по АХО",
    description: "Скрывает все записи о заехавших на рудник. Данные сохраняются в БД для выгрузки.",
    icon: "LogIn",
    color: "text-mine-cyan",
    danger: false,
  },
  {
    value: "aho_departures",
    label: "Обнулить список выехавших по АХО",
    description: "Скрывает все записи о выехавших с рудника. Данные сохраняются в БД для выгрузки.",
    icon: "LogOut",
    color: "text-mine-cyan",
    danger: false,
  },
  {
    value: "delete_aho_arrivals",
    label: "Удалить список заехавших по АХО",
    description: "Полностью удаляет все загруженные файлы и записи о заехавших из базы данных. Данные НЕ подлежат восстановлению.",
    icon: "FileX",
    color: "text-mine-red",
    danger: true,
  },
  {
    value: "delete_aho_departures",
    label: "Удалить список выехавших по АХО",
    description: "Полностью удаляет все записи о выехавших из базы данных. Данные НЕ подлежат восстановлению.",
    icon: "FileX",
    color: "text-mine-red",
    danger: true,
  },
  {
    value: "medical",
    label: "Обнулить списки по медосмотрам",
    description: "Скрывает все результаты медосмотров и сбрасывает статусы. Данные сохраняются в БД.",
    icon: "HeartPulse",
    color: "text-mine-green",
    danger: false,
  },
  {
    value: "lamp_room",
    label: "Обнулить списки в Ламповой",
    description: "Удаляет все записи о выдаче и приёме фонарей и самоспасателей. Оборудование остаётся в системе.",
    icon: "Lightbulb",
    color: "text-mine-amber",
    danger: true,
  },
  {
    value: "full",
    label: "Полностью обнулить всю систему",
    description: "Удаляет ВСЕ данные из базы (персонал, АХО, медосмотры, события, история). Администраторы и настройки сохраняются.",
    icon: "Trash2",
    color: "text-mine-red",
    danger: true,
  },
];

const Admin = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [roleChangeLoading, setRoleChangeLoading] = useState<number | null>(null);
  const [itrPositions, setItrPositions] = useState<string[]>([]);
  const [newPosition, setNewPosition] = useState("");
  const [itrLoading, setItrLoading] = useState(false);
  const [selectedReset, setSelectedReset] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [permsLoading, setPermsLoading] = useState(true);
  const [permsSaving, setPermsSaving] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", password: "", role: "operator", position: "", department: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [editFields, setEditFields] = useState({ full_name: "", email: "", position: "", department: "", password: "" });

  const loadPermissions = async () => {
    try {
      const data = await authApi.getPermissions();
      setPermissions(data.permissions || {});
    } catch { /* ignore */ }
    finally { setPermsLoading(false); }
  };

  const togglePageAccess = (role: string, page: string) => {
    setPermissions(prev => {
      const current = prev[role] || [];
      const has = current.includes(page);
      const updated = has ? current.filter(p => p !== page) : [...current, page];
      return { ...prev, [role]: updated };
    });
  };

  const handleSavePermissions = async () => {
    setPermsSaving(true);
    try {
      const res = await authApi.savePermissions(permissions);
      setPermissions(res.permissions);
      toast({ title: res.message });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка сохранения", variant: "destructive" });
    } finally { setPermsSaving(false); }
  };

  const loadUsers = async () => {
    try {
      const data = await authApi.listUsers();
      setUsers(data.users || []);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    setRoleChangeLoading(userId);
    try {
      const res = await authApi.updateRole(userId, newRole);
      toast({ title: res.message });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка смены роли", variant: "destructive" });
    } finally { setRoleChangeLoading(null); }
  };

  const handleCreateUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast({ title: "Заполните ФИО, email и пароль", variant: "destructive" });
      return;
    }
    setAddingUser(true);
    try {
      const res = await authApi.createUser(newUser);
      toast({ title: res.message });
      setShowAddUser(false);
      setNewUser({ full_name: "", email: "", password: "", role: "operator", position: "", department: "" });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка создания", variant: "destructive" });
    } finally { setAddingUser(false); }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await authApi.deleteUser(userId);
      toast({ title: res.message });
      setDeleteUserId(null);
      loadUsers();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка удаления", variant: "destructive" });
    }
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    try {
      const body: Record<string, unknown> = { user_id: editUser.id };
      if (editFields.full_name !== editUser.full_name) body.full_name = editFields.full_name;
      if (editFields.email !== editUser.email) body.email = editFields.email;
      if (editFields.position !== (editUser.position || "")) body.position = editFields.position;
      if (editFields.department !== (editUser.department || "")) body.department = editFields.department;
      if (editFields.password) body.password = editFields.password;
      const res = await authApi.updateUser(body);
      toast({ title: res.message });
      setEditUser(null);
      loadUsers();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка обновления", variant: "destructive" });
    }
  };

  const handleRestoreUser = async (userId: number) => {
    try {
      const res = await authApi.updateUser({ user_id: userId, is_active: true });
      toast({ title: "Пользователь восстановлен" });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка восстановления", variant: "destructive" });
    }
  };

  const openEditUser = (u: SystemUser) => {
    setEditUser(u);
    setEditFields({ full_name: u.full_name, email: u.email, position: u.position || "", department: u.department || "", password: "" });
  };

  useEffect(() => {
    loadUsers();
    loadItrPositions();
    loadPermissions();
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

  const handleResetClick = () => {
    if (!selectedReset) {
      toast({ title: "Выберите тип обнуления", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const handleResetConfirm = async () => {
    setConfirmOpen(false);
    setResetLoading(true);
    try {
      const res = await ahoApi.resetData(selectedReset);
      toast({ title: res.message + ` (затронуто: ${res.affected})` });
      setSelectedReset("");
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка обнуления", variant: "destructive" });
    } finally { setResetLoading(false); }
  };

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      const res = await ahoApi.exportAllData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_rudnik_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Данные выгружены" });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка выгрузки", variant: "destructive" });
    } finally { setExportLoading(false); }
  };

  const currentResetOption = resetOptions.find(r => r.value === selectedReset);

  const filtered = users
    .filter(
      (u) =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1));

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
                <Badge variant="outline" className="text-[11px]">
                  {users.filter(u => u.is_active).length} чел.
                </Badge>
                <Button
                  size="sm"
                  className="gap-1.5 h-8 bg-mine-green text-white hover:bg-mine-green/90"
                  onClick={() => setShowAddUser(!showAddUser)}
                >
                  <Icon name={showAddUser ? "X" : "UserPlus"} size={14} />
                  {showAddUser ? "Отмена" : "Добавить"}
                </Button>
              </div>
            </div>
            {showAddUser && (
              <div className="p-4 border-b border-mine-green/20 bg-mine-green/5 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="ФИО *"
                    className="h-8 text-xs bg-secondary/50"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  />
                  <Input
                    placeholder="Email *"
                    className="h-8 text-xs bg-secondary/50"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                  <Input
                    placeholder="Пароль *"
                    type="password"
                    className="h-8 text-xs bg-secondary/50"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                  <Select value={newUser.role} onValueChange={(val) => setNewUser({ ...newUser, role: val })}>
                    <SelectTrigger className="h-8 text-xs bg-secondary/50">
                      <SelectValue placeholder="Роль" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Должность"
                    className="h-8 text-xs bg-secondary/50"
                    value={newUser.position}
                    onChange={(e) => setNewUser({ ...newUser, position: e.target.value })}
                  />
                  <Input
                    placeholder="Подразделение"
                    className="h-8 text-xs bg-secondary/50"
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                  />
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 h-8 bg-mine-green text-white hover:bg-mine-green/90"
                  onClick={handleCreateUser}
                  disabled={addingUser}
                >
                  <Icon name="UserPlus" size={14} />
                  {addingUser ? "Создаю..." : "Создать пользователя"}
                </Button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Имя", "Email", "Роль", "Подразделение", "Статус", ""].map((h) => (
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
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <Icon name="Loader2" size={20} className="animate-spin mx-auto text-muted-foreground" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : filtered.map((u, i) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-border/50 hover:bg-secondary/50 transition-colors animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-foreground">{u.full_name}</div>
                          {u.personal_code && (
                            <span className="text-[10px] text-muted-foreground font-mono">{u.personal_code}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          {isSelf ? (
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${roleColors[u.role] || "bg-secondary text-muted-foreground"}`}
                            >
                              {roleLabels[u.role] || u.role}
                            </Badge>
                          ) : (
                            <Select
                              value={u.role}
                              onValueChange={(val) => handleRoleChange(u.id, val)}
                              disabled={roleChangeLoading === u.id}
                            >
                              <SelectTrigger className="h-7 text-[11px] w-[140px] bg-secondary/30 border-border/50">
                                {roleChangeLoading === u.id ? (
                                  <Icon name="Loader2" size={12} className="animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {roleOptions.map((r) => (
                                  <SelectItem key={r.value} value={r.value} className="text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${
                                        r.value === "admin" ? "bg-mine-red" :
                                        r.value === "doctor" ? "bg-mine-green" :
                                        r.value === "dispatcher" ? "bg-mine-amber" :
                                        r.value === "aho_specialist" ? "bg-mine-purple" :
                                        r.value === "security" ? "bg-mine-red" : "bg-mine-cyan"
                                      }`} />
                                      {r.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {u.department || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                u.is_active ? "bg-mine-green" : "bg-muted-foreground"
                              }`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {u.is_active ? "Активен" : "Отключён"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {!isSelf && (
                            <div className="flex items-center gap-1">
                              {u.is_active ? (
                                <>
                                  <button
                                    onClick={() => openEditUser(u)}
                                    className="p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                                    title="Редактировать"
                                  >
                                    <Icon name="Pencil" size={13} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteUserId(u.id)}
                                    className="p-1.5 rounded-md hover:bg-mine-red/10 text-muted-foreground hover:text-mine-red transition-colors"
                                    title="Удалить"
                                  >
                                    <Icon name="Trash2" size={13} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleRestoreUser(u.id)}
                                  className="p-1.5 rounded-md hover:bg-mine-green/10 text-muted-foreground hover:text-mine-green transition-colors"
                                  title="Восстановить"
                                >
                                  <Icon name="RotateCcw" size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="Briefcase" size={18} className="text-mine-amber" />
                  <h3 className="text-sm font-semibold text-foreground">Должности ИТР</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Список для автоклассификации ИТР / рабочие
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

                <div className="max-h-[200px] overflow-y-auto space-y-1">
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
                      Список пуст
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {itrPositions.length} должностей
                  </span>
                  <Button size="sm" className="gap-1.5 h-8 bg-mine-amber text-white hover:bg-mine-amber/90" onClick={handleSavePositions} disabled={itrLoading}>
                    <Icon name="Save" size={14} />
                    {itrLoading ? "..." : "Сохранить"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
              <div className="p-4 border-b border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="ShieldCheck" size={18} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Доступ по ролям</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Какие разделы видит каждая роль (кроме администратора — видит всё)
                </p>
              </div>
              <div className="p-4 space-y-4">
                {permsLoading ? (
                  <div className="flex justify-center py-4">
                    <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : editableRoles.map((role) => {
                  const rolePages = permissions[role] || [];
                  return (
                    <div key={role} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[11px] ${roleColors[role] || ""}`}>
                          {roleLabels[role]}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(pageLabels).map(([page, meta]) => {
                          const enabled = rolePages.includes(page);
                          return (
                            <button
                              key={page}
                              onClick={() => togglePageAccess(role, page)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-all border cursor-pointer ${
                                enabled
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50"
                              }`}
                            >
                              <Icon name={meta.icon} size={12} />
                              <span className="truncate">{meta.label}</span>
                              {enabled && <Icon name="Check" size={10} className="ml-auto flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-border">
                  <Button
                    size="sm"
                    className="w-full gap-1.5 h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleSavePermissions}
                    disabled={permsSaving}
                  >
                    <Icon name="Save" size={14} />
                    {permsSaving ? "Сохраняю..." : "Сохранить доступ"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-mine-red/30 bg-card overflow-hidden">
              <div className="p-4 border-b border-mine-red/20">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="RotateCcw" size={18} className="text-mine-red" />
                  <h3 className="text-sm font-semibold text-foreground">Обнуление данных</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Простые обнуления скрывают данные с экрана, но сохраняют в базе для выгрузки
                </p>
              </div>
              <div className="p-4 space-y-4">
                <Select value={selectedReset} onValueChange={setSelectedReset}>
                  <SelectTrigger className="bg-secondary/50 text-xs h-9">
                    <SelectValue placeholder="Выберите тип обнуления..." />
                  </SelectTrigger>
                  <SelectContent>
                    {resetOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Icon name={opt.icon} size={14} className={opt.color} />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {currentResetOption && (
                  <div className={`rounded-lg p-3 text-xs space-y-2 ${currentResetOption.danger ? "bg-mine-red/10 border border-mine-red/20" : "bg-secondary/30"}`}>
                    <div className="flex items-start gap-2">
                      <Icon name={currentResetOption.danger ? "AlertTriangle" : "Info"} size={14} className={currentResetOption.danger ? "text-mine-red mt-0.5" : "text-muted-foreground mt-0.5"} />
                      <p className={currentResetOption.danger ? "text-mine-red" : "text-muted-foreground"}>
                        {currentResetOption.description}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs flex-1 border-mine-red/30 text-mine-red hover:bg-mine-red/10 hover:text-mine-red"
                    onClick={handleResetClick}
                    disabled={!selectedReset || resetLoading}
                  >
                    <Icon name="RotateCcw" size={14} />
                    {resetLoading ? "Выполняется..." : "Обнулить"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs border-border"
                    onClick={handleExportAll}
                    disabled={exportLoading}
                    title="Выгрузить все данные (включая скрытые) для сохранения"
                  >
                    <Icon name="Download" size={14} />
                    {exportLoading ? "..." : "Выгрузка"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteUserId !== null} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon name="Trash2" size={20} className="text-mine-red" />
              Удалить пользователя?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Пользователь будет деактивирован. Он не сможет войти в систему, но данные останутся в базе.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && handleDeleteUser(deleteUserId)}
              className="bg-mine-red hover:bg-mine-red/90 text-white"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={editUser !== null} onOpenChange={() => setEditUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon name="Pencil" size={20} className="text-mine-amber" />
              Редактировать пользователя
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <Input
                  placeholder="ФИО"
                  className="h-9 text-sm"
                  value={editFields.full_name}
                  onChange={(e) => setEditFields({ ...editFields, full_name: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  className="h-9 text-sm"
                  value={editFields.email}
                  onChange={(e) => setEditFields({ ...editFields, email: e.target.value })}
                />
                <Input
                  placeholder="Должность"
                  className="h-9 text-sm"
                  value={editFields.position}
                  onChange={(e) => setEditFields({ ...editFields, position: e.target.value })}
                />
                <Input
                  placeholder="Подразделение"
                  className="h-9 text-sm"
                  value={editFields.department}
                  onChange={(e) => setEditFields({ ...editFields, department: e.target.value })}
                />
                <Input
                  placeholder="Новый пароль (оставьте пустым, если не менять)"
                  type="password"
                  className="h-9 text-sm"
                  value={editFields.password}
                  onChange={(e) => setEditFields({ ...editFields, password: e.target.value })}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEditUser}
              className="bg-mine-amber hover:bg-mine-amber/90 text-white"
            >
              Сохранить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {currentResetOption?.danger ? (
                <Icon name="AlertTriangle" size={20} className="text-mine-red" />
              ) : (
                <Icon name="RotateCcw" size={20} className="text-mine-amber" />
              )}
              Подтверждение обнуления
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block font-medium text-foreground">
                {currentResetOption?.label}
              </span>
              <span className="block">
                {currentResetOption?.description}
              </span>
              {currentResetOption?.danger && (
                <span className="block text-mine-red font-medium">
                  Это действие необратимо! Все данные будут удалены из базы данных безвозвратно.
                  Рекомендуем сначала сделать выгрузку данных.
                </span>
              )}
              {!currentResetOption?.danger && (
                <span className="block text-muted-foreground">
                  Данные будут скрыты с экрана, но останутся в базе. Администратор может выгрузить их в любой момент.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetConfirm}
              className={currentResetOption?.danger ? "bg-mine-red hover:bg-mine-red/90 text-white" : "bg-mine-amber hover:bg-mine-amber/90 text-white"}
            >
              {currentResetOption?.danger ? "Да, удалить всё" : "Да, обнулить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Admin;
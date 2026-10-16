import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PAGE_LABELS, RoleItem } from "@/components/admin/RolesManager";
import PersonnelPicker, { PersonnelOption } from "@/components/admin/PersonnelPicker";

export interface AccessUser {
  id: number;
  email: string;
  full_name: string;
  position: string;
  department: string;
  organization: string;
  role: string;
  personal_code: string;
  login_email?: boolean;
  login_code?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AccessUser | null;
  roles: RoleItem[];
  existingCodes?: string[];
  onSaved: () => void;
}

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  position: "",
  department: "",
  organization: "",
  role: "operator",
  login_email: true,
  login_code: true,
};

const UserAccessDialog = ({ open, onOpenChange, user, roles, existingCodes = [], onSaved }: Props) => {
  const { toast } = useToast();
  const isNew = !user;
  const [form, setForm] = useState(emptyForm);
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<PersonnelOption | null>(null);

  const handlePick = (p: PersonnelOption | null) => {
    setPicked(p);
    if (p) {
      setForm((f) => ({
        ...f,
        full_name: p.full_name || "",
        position: p.position || "",
        department: p.department || "",
        organization: p.organization || "",
      }));
    }
  };

  const assignableRoles = roles.filter((r) => r.key !== "admin");
  const currentRole = roles.find((r) => r.key === form.role);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    if (user) {
      setForm({
        full_name: user.full_name || "",
        email: user.email?.startsWith("nomail_") ? "" : user.email || "",
        password: "",
        position: user.position || "",
        department: user.department || "",
        organization: user.organization || "",
        role: user.role,
        login_email: user.login_email !== false,
        login_code: user.login_code !== false,
      });
    } else {
      setForm({ ...emptyForm, role: assignableRoles.find((r) => r.key === "operator")?.key || assignableRoles[0]?.key || "operator" });
    }
  }, [open, user]);

  useEffect(() => {
    setPages(currentRole?.pages || []);
  }, [form.role, roles]);

  const set = (k: keyof typeof emptyForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const togglePage = (p: string) =>
    setPages((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const pagesChanged =
    !!currentRole &&
    (pages.length !== currentRole.pages.length || pages.some((p) => !currentRole.pages.includes(p)));

  const save = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Укажите ФИО", variant: "destructive" });
      return;
    }
    if (!form.login_email && !form.login_code) {
      toast({ title: "Выберите хотя бы один способ входа", variant: "destructive" });
      return;
    }
    const hadEmailLogin = !isNew && user?.login_email !== false && !user?.email?.startsWith("nomail_");
    if (form.login_email && (!form.email.trim() || (!hadEmailLogin && !form.password))) {
      toast({ title: "Для входа по почте укажите email и пароль", variant: "destructive" });
      return;
    }
    if (form.password && form.password.length < 6) {
      toast({ title: "Пароль должен быть не короче 6 символов", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (pagesChanged && currentRole) {
        await authApi.saveRole({ key: currentRole.key, label: currentRole.label, pages });
      }
      if (isNew) {
        const res = await authApi.createUser({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          personnel_id: picked?.id,
          position: form.position.trim(),
          department: form.department.trim(),
          organization: form.organization.trim(),
          role: form.role,
          login_email: form.login_email,
          login_code: form.login_code,
        });
        toast({
          title: "Пользователь зарегистрирован",
          description: res.user?.personal_code ? `Личный код для входа: ${res.user.personal_code}` : undefined,
        });
      } else if (user) {
        const body: Record<string, unknown> = {
          user_id: user.id,
          full_name: form.full_name.trim(),
          position: form.position.trim(),
          department: form.department.trim(),
          organization: form.organization.trim(),
          login_email: form.login_email,
          login_code: form.login_code,
        };
        if (form.email.trim()) body.email = form.email.trim();
        if (form.password) body.password = form.password;
        if (form.role !== user.role) body.role = form.role;
        await authApi.updateUser(body);
        toast({ title: "Данные пользователя сохранены" });
      }
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка сохранения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name={isNew ? "UserPlus" : "UserCog"} size={20} className="text-mine-green" />
            {isNew ? "Регистрация нового пользователя" : "Доступ пользователя"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            {isNew && (
              <div className="rounded-lg border border-mine-cyan/30 bg-mine-cyan/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-mine-cyan flex items-center gap-1.5">
                  <Icon name="UserSearch" size={14} />
                  Сотрудник из списка персонала
                </p>
                <PersonnelPicker value={picked} onSelect={handlePick} excludeCodes={existingCodes} />
                {picked ? (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Icon name="QrCode" size={12} className="text-mine-amber" />
                    Будет присвоен существующий код и QR-код:
                    <span className="font-mono text-foreground">{picked.personal_code}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Выберите сотрудника — данные и QR-код подставятся автоматически. Или заполните вручную ниже.
                  </p>
                )}
              </div>
            )}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Данные</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="ФИО *" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
              <Input placeholder="Должность" value={form.position} onChange={(e) => set("position", e.target.value)} />
              <Input placeholder="Подразделение" value={form.department} onChange={(e) => set("department", e.target.value)} />
              <Input placeholder="Организация" value={form.organization} onChange={(e) => set("organization", e.target.value)} />
            </div>
            {!isNew && user?.personal_code && (
              <p className="text-xs text-muted-foreground">
                Личный код: <span className="font-mono text-foreground">{user.personal_code}</span>
              </p>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Способ входа в систему</p>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon name="Mail" size={16} className="text-mine-cyan" />
                  <div>
                    <p className="text-sm text-foreground">По почте и паролю</p>
                    <p className="text-[11px] text-muted-foreground">Вход через email и пароль</p>
                  </div>
                </div>
                <Switch checked={form.login_email} onCheckedChange={(v) => set("login_email", v)} />
              </div>
              {form.login_email && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                  <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  <Input
                    placeholder={isNew ? "Пароль * (от 6 символов)" : "Новый пароль (если менять)"}
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Icon name="QrCode" size={16} className="text-mine-amber" />
                  <div>
                    <p className="text-sm text-foreground">По личному коду / QR-коду</p>
                    <p className="text-[11px] text-muted-foreground">Вход вводом кода или сканированием QR</p>
                  </div>
                </div>
                <Switch checked={form.login_code} onCheckedChange={(v) => set("login_code", v)} />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Роль и доступ</p>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(PAGE_LABELS).map(([key, p]) => {
                const on = pages.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePage(key)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                      on ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon name={on ? "CheckSquare" : "Square"} size={14} className={on ? "text-primary" : ""} />
                    <Icon name={p.icon} size={13} />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
            {pagesChanged && (
              <p className="text-[11px] text-mine-amber flex items-start gap-1.5">
                <Icon name="Info" size={12} className="mt-0.5 shrink-0" />
                Разделы изменятся для всех пользователей с ролью «{currentRole?.label}»
                {currentRole && currentRole.users_count > 0 ? ` (${currentRole.users_count} польз.)` : ""}
              </p>
            )}
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button className="gap-1.5 bg-mine-green text-white hover:bg-mine-green/90" onClick={save} disabled={saving}>
              <Icon name={saving ? "Loader2" : "Save"} size={14} className={saving ? "animate-spin" : ""} />
              {saving ? "Сохраняю..." : isNew ? "Зарегистрировать" : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserAccessDialog;
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import FaceEnroll from "@/components/face/FaceEnroll";

interface ProfileUser {
  id?: number;
  full_name?: string;
  email?: string;
  position?: string;
  department?: string;
  organization?: string;
  role?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileUser;
}

const ProfileSettingsDialog = ({ open, onOpenChange, user }: Props) => {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setPosition(user.position || "");
      setDepartment(user.department || "");
      setOrganization(user.organization || "");
      setPassword("");
      setPassword2("");
      setError("");
    }
  }, [open, user]);

  const isAdmin = user.role === "admin";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password && password.length < 6) {
      setError("Пароль должен быть не короче 6 символов");
      return;
    }
    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        user_id: user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        position: position.trim(),
        department: department.trim(),
        organization: organization.trim(),
      };
      if (password) body.password = password;
      await authApi.updateUser(body);
      await refreshUser();
      toast({ title: "Настройки сохранены", description: "Данные обновлены во всех разделах программы" });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки профиля</DialogTitle>
        </DialogHeader>

        <FaceEnroll />

        {!isAdmin ? (
          <p className="text-sm text-muted-foreground">
            Изменение данных профиля доступно через администратора системы.
          </p>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            {error && (
              <div className="p-3 rounded-lg bg-mine-red/10 border border-mine-red/20 text-mine-red text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ФИО</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Должность</label>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Подразделение</label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Организация</label>
              <Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Название организации" />
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                Новый пароль (оставьте пустым, если не меняете)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="password"
                  placeholder="Новый пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Повторите"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;

import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  operator: "Оператор",
  medic: "Медик",
  dispatcher: "Диспетчер",
  worker: "Сотрудник",
};

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) {
    return (
      <AppLayout title="Личный кабинет" subtitle="Информация о сотруднике">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Icon name="UserX" size={40} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Данные пользователя не загружены</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Личный кабинет" subtitle="Информация о сотруднике">
      <div className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="User" size={36} className="text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-xl font-semibold text-foreground">
                {user.full_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {user.position} — {user.department}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="outline" className="bg-mine-amber/20 text-mine-amber border-mine-amber/30 text-xs">
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="IdCard" size={16} className="text-mine-cyan" />
              Персональные данные
            </h4>
            <div className="space-y-3">
              {[
                { label: "Личный код", value: user.personal_code, mono: true },
                { label: "Email", value: user.email },
                { label: "Должность", value: user.position },
                { label: "Подразделение", value: user.department },
              ].map((f) => (
                <div key={f.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span
                    className={`text-sm text-foreground ${
                      f.mono ? "font-mono text-mine-cyan" : ""
                    }`}
                  >
                    {f.value || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="QrCode" size={16} className="text-mine-amber" />
              QR-код
            </h4>
            <div className="aspect-square max-w-[200px] mx-auto rounded-lg border border-border bg-white p-4 flex items-center justify-center">
              {user.qr_code ? (
                <img
                  src={user.qr_code}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-sm ${
                        (i + Math.floor(i / 5)) % 2 === 0 ? "bg-black" : "bg-white"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Предъявите для сканирования при прохождении контроля
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Icon name="Settings" size={14} />
            Настройки
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-mine-red border-mine-red/30 hover:bg-mine-red/10"
            onClick={handleLogout}
          >
            <Icon name="LogOut" size={14} />
            Выйти
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;

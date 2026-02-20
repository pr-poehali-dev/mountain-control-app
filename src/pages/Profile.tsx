import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Icon from "@/components/ui/icon";

const Profile = () => {
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
                Иванов Алексей Сергеевич
              </h3>
              <p className="text-sm text-muted-foreground">Горнорабочий — Участок №3</p>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="outline" className="bg-mine-amber/20 text-mine-amber border-mine-amber/30 text-xs">
                  Рудничный
                </Badge>
                <Badge variant="outline" className="bg-mine-green/20 text-mine-green border-mine-green/30 text-xs">
                  На смене
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
                { label: "Личный код", value: "МК-001", mono: true },
                { label: "Email", value: "ivanov@rudnik.ru" },
                { label: "Должность", value: "Горнорабочий" },
                { label: "Подразделение", value: "Участок №3" },
                { label: "Комната", value: "301" },
              ].map((f) => (
                <div key={f.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span
                    className={`text-sm text-foreground ${
                      f.mono ? "font-mono text-mine-cyan" : ""
                    }`}
                  >
                    {f.value}
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
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-sm ${
                      Math.random() > 0.4 ? "bg-black" : "bg-white"
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Предъявите для сканирования при прохождении контроля
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Icon name="HeartPulse" size={16} className="text-mine-green" />
            Медицинский статус
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Медосмотр", value: "Пройден", color: "text-mine-green" },
              { label: "Давление", value: "120/80", color: "text-foreground" },
              { label: "Алкоголь", value: "0.0 ‰", color: "text-mine-green" },
              { label: "Температура", value: "36.6°", color: "text-foreground" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border p-3 text-center"
              >
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className={`text-lg font-semibold font-mono ${m.color}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Icon name="Settings" size={14} />
            Настройки
          </Button>
          <Button variant="outline" className="gap-2 text-mine-red border-mine-red/30 hover:bg-mine-red/10">
            <Icon name="LogOut" size={14} />
            Выйти
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;

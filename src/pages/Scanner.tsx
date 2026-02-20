import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useState } from "react";

const recentScans = [
  { code: "МК-001", name: "Иванов А.С.", time: "08:42", type: "QR", result: "Допущен" },
  { code: "МК-002", name: "Петров В.И.", time: "08:38", type: "Код", result: "Допущен" },
  { code: "МК-003", name: "Сидоров К.Н.", time: "08:35", type: "QR", result: "Не допущен" },
  { code: "МК-007", name: "Волков А.П.", time: "08:25", type: "QR", result: "Допущен" },
];

const Scanner = () => {
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);

  return (
    <AppLayout
      title="Сканирование"
      subtitle="Идентификация персонала по QR-коду или личному коду"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
                <Icon name="Camera" size={20} className="text-mine-cyan" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Сканирование QR-кода
                </h3>
                <p className="text-xs text-muted-foreground">
                  Наведите камеру на QR-код сотрудника
                </p>
              </div>
            </div>

            <div
              className={`aspect-video rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
                scanning
                  ? "border-mine-cyan bg-mine-cyan/5"
                  : "border-border bg-secondary/30"
              }`}
            >
              {scanning ? (
                <div className="text-center space-y-3">
                  <div className="relative">
                    <Icon
                      name="ScanLine"
                      size={48}
                      className="text-mine-cyan animate-pulse-glow"
                    />
                  </div>
                  <p className="text-sm text-mine-cyan">Ожидание QR-кода...</p>
                  <div className="w-48 h-0.5 bg-mine-cyan/20 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-mine-cyan rounded-full animate-pulse w-1/2" />
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <Icon
                    name="Camera"
                    size={48}
                    className="text-muted-foreground/30 mx-auto"
                  />
                  <p className="text-sm text-muted-foreground">
                    Камера не активна
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={() => setScanning(!scanning)}
              className={`w-full gap-2 ${
                scanning
                  ? "bg-mine-red hover:bg-mine-red/90 text-white"
                  : "bg-mine-cyan hover:bg-mine-cyan/90 text-white"
              }`}
            >
              <Icon name={scanning ? "CameraOff" : "Camera"} size={16} />
              {scanning ? "Остановить камеру" : "Включить камеру"}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-mine-amber/10 flex items-center justify-center">
                <Icon name="Hash" size={20} className="text-mine-amber" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Ввод личного кода
                </h3>
                <p className="text-xs text-muted-foreground">
                  Введите персональный код сотрудника
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Личный код
                </label>
                <Input
                  placeholder="Например: МК-001"
                  className="bg-secondary/50 border-border text-lg font-mono text-center h-14 tracking-widest"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                />
              </div>

              <Button
                className="w-full gap-2 bg-mine-amber hover:bg-mine-amber/90 text-black font-semibold"
                disabled={!manualCode}
              >
                <Icon name="Search" size={16} />
                Найти сотрудника
              </Button>

              <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Результат поиска появится здесь
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <Icon name="History" size={18} className="text-mine-amber" />
            <h3 className="text-sm font-semibold text-foreground">
              Последние сканирования
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {recentScans.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      s.result === "Допущен"
                        ? "bg-mine-green/10"
                        : "bg-mine-red/10"
                    }`}
                  >
                    <Icon
                      name={s.result === "Допущен" ? "CheckCircle2" : "XCircle"}
                      size={20}
                      className={
                        s.result === "Допущен"
                          ? "text-mine-green"
                          : "text-mine-red"
                      }
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {s.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-mine-cyan font-mono">
                        {s.code}
                      </code>
                      <span className="text-[10px] text-muted-foreground">
                        через {s.type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-medium ${
                      s.result === "Допущен"
                        ? "text-mine-green"
                        : "text-mine-red"
                    }`}
                  >
                    {s.result}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Сегодня, {s.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Scanner;

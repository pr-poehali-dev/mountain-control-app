import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { checkpointApi } from "@/lib/api";
import { playSuccess, playDenied, playScan } from "@/lib/sounds";

interface Vehicle {
  personnel_id: number;
  owner_name: string;
  position: string;
  organization: string;
  photo_url: string;
  vehicle_number: string;
  vehicle_brand: string;
  pass_number: string;
  pass_period: string;
  state: "active" | "expired" | "future" | "none";
  reason: string;
  on_site?: boolean;
}

interface PassResult {
  result: "allowed" | "denied";
  message: string;
  reason: string;
  direction: "in" | "out";
  vehicle: Vehicle | null;
  vehicle_number: string;
}

interface JournalRow {
  id: number;
  vehicle_number: string;
  vehicle_brand: string;
  owner_name: string;
  direction: string;
  direction_raw: string;
  checkpoint_name: string;
  allowed: boolean;
  notes: string;
  created_at: string;
}

const stateView: Record<Vehicle["state"], { text: string; cls: string }> = {
  active: { text: "Пропуск действует", cls: "bg-mine-green/15 text-mine-green border-mine-green/30" },
  expired: { text: "Пропуск истёк", cls: "bg-mine-red/15 text-mine-red border-mine-red/30" },
  future: { text: "Ещё не действует", cls: "bg-mine-amber/15 text-mine-amber border-mine-amber/30" },
  none: { text: "Нет пропуска", cls: "bg-mine-red/15 text-mine-red border-mine-red/30" },
};

const fmt = (d: string) => {
  try {
    return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
};

export default function VehicleCheck({ onChanged }: { onChanged?: () => void }) {
  const [number, setNumber] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [result, setResult] = useState<PassResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [onSite, setOnSite] = useState(0);
  const [expFrom, setExpFrom] = useState("");
  const [expTo, setExpTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (expFrom) params.date_from = expFrom;
      if (expTo) params.date_to = expTo;
      const d = await checkpointApi.vehicleExport(params);
      const bin = atob(d.file);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.file_name || "Журнал_автомобилей.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выгрузить журнал");
    } finally {
      setExporting(false);
    }
  };

  const loadJournal = useCallback(async () => {
    try {
      const d = await checkpointApi.getVehicleJournal();
      setJournal(d.items || []);
      setOnSite(d.on_site || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!number.trim()) return;
    playScan();
    setLoading(true);
    setError("");
    setResult(null);
    setVehicle(null);
    try {
      const d = await checkpointApi.vehicleSearch(number.trim());
      setVehicle(d.vehicle);
      if (d.vehicle.state !== "active") playDenied();
    } catch (err) {
      playDenied();
      setError(err instanceof Error ? err.message : "Автомобиль не найден");
    } finally {
      setLoading(false);
    }
  };

  const mark = async (direction: "in" | "out") => {
    const plate = vehicle?.vehicle_number || number.trim();
    if (!plate) return;
    setLoading(true);
    setError("");
    try {
      const d: PassResult = await checkpointApi.vehiclePass(plate, direction);
      setResult(d);
      if (d.result === "allowed") playSuccess();
      else playDenied();
      loadJournal();
      onChanged?.();
    } catch (err) {
      playDenied();
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setNumber("");
    setVehicle(null);
    setResult(null);
    setError("");
  };

  const v = result?.vehicle ?? vehicle;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Car" size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Проверка автомобиля</h3>
              <p className="text-xs text-muted-foreground">Введите госномер — русские или латинские буквы</p>
            </div>
          </div>
          <form onSubmit={search} className="space-y-3">
            <Input
              placeholder="А123ВС 124"
              className="bg-secondary/50 border-border text-2xl font-mono text-center h-16 tracking-widest uppercase"
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
            />
            <Button type="submit" className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={!number.trim() || loading}>
              <Icon name={loading ? "Loader2" : "Search"} size={16} className={loading ? "animate-spin" : ""} />
              Найти автомобиль
            </Button>
          </form>
        </div>

        {error && (
          <div className="rounded-xl border border-mine-red/30 bg-mine-red/10 p-4 animate-fade-in space-y-3">
            <div className="flex items-center gap-3">
              <Icon name="ShieldAlert" size={24} className="text-mine-red shrink-0" />
              <div>
                <p className="text-sm font-semibold text-mine-red">Въезд запрещён</p>
                <p className="text-xs text-mine-red/90">{error}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="w-full border-mine-red/30 text-mine-red hover:bg-mine-red/10" onClick={() => mark("in")} disabled={loading}>
              Записать отказ в журнал
            </Button>
          </div>
        )}

        {v && (
          <div
            className={`rounded-xl border p-5 animate-fade-in space-y-4 ${
              result
                ? result.result === "allowed"
                  ? "border-mine-green/30 bg-mine-green/5"
                  : "border-mine-red/30 bg-mine-red/10"
                : "border-border bg-card"
            }`}
          >
            {result && (
              <div className="flex items-center gap-3">
                <Icon
                  name={result.result === "allowed" ? (result.direction === "in" ? "CheckCircle2" : "LogOut") : "ShieldAlert"}
                  size={28}
                  className={result.result === "allowed" ? "text-mine-green" : "text-mine-red"}
                />
                <div>
                  <p className={`text-base font-bold ${result.result === "allowed" ? "text-mine-green" : "text-mine-red"}`}>{result.message}</p>
                  {result.reason && <p className="text-sm text-mine-red">Причина: {result.reason}</p>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              {v.photo_url ? (
                <img src={v.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                  <Icon name="User" size={28} className="text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Владелец</p>
                <p className="text-base font-semibold text-foreground">{v.owner_name}</p>
                <p className="text-xs text-muted-foreground">{[v.position, v.organization].filter(Boolean).join(" · ")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-background/60 border border-border/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Госномер</p>
                <p className="font-mono font-bold text-foreground">{v.vehicle_number}</p>
              </div>
              <div className="rounded-lg bg-background/60 border border-border/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Марка, модель</p>
                <p className="text-foreground">{v.vehicle_brand || "—"}</p>
              </div>
              <div className="rounded-lg bg-background/60 border border-border/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">№ пропуска</p>
                <p className="font-mono text-foreground">{v.pass_number || "—"}</p>
              </div>
              <div className="rounded-lg bg-background/60 border border-border/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Срок действия</p>
                <p className="text-foreground">{v.pass_period || "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full border ${stateView[v.state].cls}`}>{stateView[v.state].text}</span>
              {v.on_site !== undefined && (
                <span className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                  {v.on_site ? "Сейчас на территории" : "Сейчас за территорией"}
                </span>
              )}
            </div>
            {!result && v.state !== "active" && <p className="text-sm text-mine-red font-medium">Въезд будет запрещён: {v.reason}</p>}

            {result ? (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={reset}>
                <Icon name="RotateCcw" size={14} />
                Следующий автомобиль
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button className="gap-2 bg-mine-green text-black hover:bg-mine-green/90 font-semibold" onClick={() => mark("in")} disabled={loading}>
                  <Icon name="LogIn" size={16} />
                  Въезд
                </Button>
                <Button className="gap-2 bg-mine-amber text-black hover:bg-mine-amber/90 font-semibold" onClick={() => mark("out")} disabled={loading}>
                  <Icon name="LogOut" size={16} />
                  Выезд
                </Button>
              </div>
            )}
          </div>
        )}

        {result && !v && (
          <div className="rounded-xl border border-mine-red/30 bg-mine-red/10 p-4 space-y-3">
            <p className="text-sm font-semibold text-mine-red">{result.message}{result.reason ? `: ${result.reason}` : ""}</p>
            <Button variant="outline" size="sm" className="w-full" onClick={reset}>Следующий автомобиль</Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden self-start">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="FileText" size={18} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Журнал автомобилей</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">На территории: <b className="text-foreground">{onSite}</b></span>
            <button onClick={loadJournal} className="text-muted-foreground hover:text-foreground" title="Обновить">
              <Icon name="RefreshCw" size={14} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 px-4 py-3 border-b border-border bg-secondary/20">
          <div>
            <label className="text-[10px] text-muted-foreground block">С</label>
            <Input type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} className="h-8 text-xs w-36 bg-background" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block">По</label>
            <Input type="date" value={expTo} min={expFrom || undefined} onChange={(e) => setExpTo(e.target.value)} className="h-8 text-xs w-36 bg-background" />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-mine-green/40 text-mine-green hover:bg-mine-green/10 hover:text-mine-green" onClick={exportExcel} disabled={exporting}>
            <Icon name={exporting ? "Loader2" : "FileSpreadsheet"} size={14} className={exporting ? "animate-spin" : ""} />
            Выгрузить в Excel
          </Button>
        </div>
        <div className="divide-y divide-border/50 max-h-[560px] overflow-y-auto">
          {journal.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Записей пока нет</p>
          ) : (
            journal.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <Icon
                  name={!r.allowed ? "ShieldAlert" : r.direction_raw === "in" ? "LogIn" : "LogOut"}
                  size={16}
                  className={!r.allowed ? "text-mine-red" : r.direction_raw === "in" ? "text-mine-green" : "text-mine-amber"}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-mono font-semibold">{r.vehicle_number}</span>
                    {r.vehicle_brand && <span className="text-muted-foreground"> · {r.vehicle_brand}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.owner_name || "Неизвестный владелец"}
                    {!r.allowed && <span className="text-mine-red"> · {r.notes.replace(/^ОТКАЗ:\s*/, "Отказ: ")}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-medium ${!r.allowed ? "text-mine-red" : r.direction_raw === "in" ? "text-mine-green" : "text-mine-amber"}`}>
                    {r.allowed ? r.direction : "Отказ"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{fmt(r.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

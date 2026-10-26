import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { checkpointApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { notifyControlPointsChanged, type ControlPoint, type ControlPointSettings } from "@/hooks/use-control-points";
import { useAuth } from "@/contexts/AuthContext";

const ICONS = ["DoorOpen", "Factory", "Warehouse", "Pickaxe", "Building2", "Truck", "Fuel", "Zap", "FlaskConical", "ShieldCheck", "HardHat", "Mountain"];

const SETTINGS: { key: keyof ControlPointSettings; label: string; hint: string }[] = [
  { key: "counts_territory", label: "Вход и выход с территории предприятия", hint: "Как главный КПП: проход меняет статус «на территории», влияет на расселение и дашборд" },
  { key: "require_on_site", label: "Пускать только отмеченных на главном КПП", hint: "Отказ во входе, если работник не прошёл через главный КПП" },
  { key: "check_pass", label: "Проверять срок пропуска", hint: "Отказ при просроченном или отсутствующем пропуске" },
  { key: "require_medical", label: "Требовать пройденный медосмотр", hint: "Отказ во входе без медосмотра" },
  { key: "vehicles", label: "Учёт автомобилей", hint: "Вкладка «Автомобили»: въезд и выезд по госномеру" },
];

const EMPTY: ControlPointSettings = {
  counts_territory: false, require_on_site: true, check_pass: true, require_medical: false, vehicles: false,
};

interface Form {
  id?: number;
  name: string;
  short_name: string;
  description: string;
  icon: string;
  is_main: boolean;
  settings: ControlPointSettings;
}

export default function ControlPointsManager() {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [points, setPoints] = useState<ControlPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ControlPoint | null>(null);

  const load = () => {
    setLoading(true);
    checkpointApi.getPoints()
      .then((d) => setPoints(d.points || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const afterChange = async () => {
    load();
    notifyControlPointsChanged();
    await refreshUser().catch(() => {});
  };

  const save = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      const isNew = !form.id;
      await checkpointApi.savePoint({
        id: form.id, name: form.name.trim(), short_name: form.short_name.trim(),
        description: form.description.trim(), icon: form.icon, settings: form.settings,
      });
      toast({
        title: isNew ? "Объект добавлен" : "Сохранено",
        description: isNew ? `«${form.name.trim()}» появился в меню, у диспетчера и на дашборде. Доступ для ролей — в «Ролях и доступе».` : undefined,
      });
      setForm(null);
      await afterChange();
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await checkpointApi.deletePoint(toDelete.id);
      toast({ title: "Объект удалён", description: "Журнал проходов сохранён" });
      setToDelete(null);
      await afterChange();
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const setSetting = (key: keyof ControlPointSettings, v: boolean) =>
    setForm((f) => (f ? { ...f, settings: { ...f.settings, [key]: v } } : f));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="MapPinned" size={18} className="text-mine-cyan" />
            <h3 className="text-sm font-semibold text-foreground">Объекты контроля</h3>
          </div>
          <p className="text-xs text-muted-foreground">КПП, ОФ и другие точки прохода с собственным журналом</p>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1 bg-mine-cyan text-white hover:bg-mine-cyan/90 shrink-0"
          onClick={() => setForm({ name: "", short_name: "", description: "", icon: "Factory", is_main: false, settings: { ...EMPTY } })}
        >
          <Icon name="Plus" size={14} />
          Добавить
        </Button>
      </div>
      <div className="p-3 space-y-2">
        {loading ? (
          <div className="py-6 flex justify-center"><Icon name="Loader2" size={18} className="animate-spin text-muted-foreground" /></div>
        ) : points.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-mine-cyan/10 flex items-center justify-center shrink-0">
              <Icon name={p.icon} fallback="DoorOpen" size={16} className="text-mine-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {p.name}
                {p.is_main && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary align-middle">главный</span>}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {p.settings.counts_territory ? "Вход на территорию" : "Внутренний объект"}
                {p.settings.require_medical ? " · медосмотр" : ""}
                {p.settings.vehicles ? " · автомобили" : ""}
              </p>
            </div>
            <button
              onClick={() => setForm({ id: p.id, name: p.name, short_name: p.short_name === p.name ? "" : p.short_name, description: p.description, icon: p.icon, is_main: p.is_main, settings: { ...p.settings } })}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Настройки"
            >
              <Icon name="Settings" size={14} />
            </button>
            {!p.is_main && (
              <button onClick={() => setToDelete(p)} className="p-1.5 rounded-md hover:bg-mine-red/10 text-muted-foreground hover:text-mine-red" title="Удалить">
                <Icon name="Trash2" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Настройки объекта" : "Новый объект контроля"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Название</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Например: ОФ" autoFocus />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Кратко (в журнале)</label>
                  <Input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} placeholder={form.name || "ОФ"} maxLength={30} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Обогатительная фабрика, корпус 2" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Значок</label>
                <div className="flex flex-wrap gap-1.5">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setForm({ ...form, icon: ic })}
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${form.icon === ic ? "border-mine-cyan bg-mine-cyan/10 text-mine-cyan" : "border-border text-muted-foreground hover:bg-secondary"}`}
                    >
                      <Icon name={ic} size={16} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground block">Правила прохода</label>
                {SETTINGS.map((st) => {
                  const locked = form.is_main && st.key === "counts_territory";
                  const hidden = st.key === "require_on_site" && form.settings.counts_territory;
                  if (hidden) return null;
                  return (
                    <div key={st.key} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">{st.label}</p>
                        <p className="text-[11px] text-muted-foreground">{st.hint}</p>
                      </div>
                      <Switch checked={form.settings[st.key]} disabled={locked} onCheckedChange={(v) => setSetting(st.key, v)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Отмена</Button>
            <Button onClick={save} disabled={saving || !form?.name.trim()} className="bg-mine-cyan text-white hover:bg-mine-cyan/90">
              {saving ? "Сохраняю..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить объект «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Объект пропадёт из меню, у диспетчера и на дашборде. Записи журнала проходов сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-mine-red text-white hover:bg-mine-red/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

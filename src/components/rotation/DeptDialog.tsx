import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { rotationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DEPT_COLORS } from "./types";

export interface DeptForm {
  id?: number;
  name: string;
  code: string;
  aliases: string[];
  on_days: number;
  off_days: number;
  handover_days: number;
  anchor_date: string;
  scheme: "full" | "staggered";
  head_name: string;
  color: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export const emptyDept = (): DeptForm => ({
  name: "", code: "", aliases: [], on_days: 60, off_days: 60, handover_days: 1, anchor_date: today(), scheme: "full", head_name: "", color: "amber",
});

const PRESETS = [
  { name: "Участок ОГР", code: "ОГР", aliases: ["ОГР", "Участок №1", "Участок №2", "Участок №3"], color: "amber" },
  { name: "Обогатительная фабрика", code: "ОФ", aliases: ["ОФ"], color: "cyan" },
  { name: "Энергомеханическая служба", code: "ЭМС", aliases: ["Энергоучасток", "Механический цех"], color: "green" },
  { name: "Автотранспортный цех", code: "АТЦ", aliases: ["АТЦ"], color: "purple" },
];

interface Props {
  open: boolean;
  initial: DeptForm | null;
  departments: string[];
  onClose: () => void;
  onSaved: (id: number) => void;
}

export default function DeptDialog({ open, initial, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [f, setF] = useState<DeptForm>(emptyDept());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF(initial || emptyDept());
    }
  }, [open, initial]);

  const save = async () => {
    if (!f.name.trim()) {
      toast({ title: "Укажите название подразделения", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const d = await rotationApi.saveDepartment({ ...f });
      toast({ title: f.id ? "Подразделение обновлено" : "Подразделение добавлено" });
      onSaved(d.id);
    } catch (e) {
      toast({ title: "Не удалось сохранить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{f.id ? "Настройка подразделения" : "Новое подразделение"}</DialogTitle>
          <DialogDescription>График вахт и схема смены. Работников добавите в карточке подразделения.</DialogDescription>
        </DialogHeader>

        {!f.id && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setF({ ...f, name: p.name, code: p.code, aliases: p.aliases, color: p.color })}
                className="text-xs rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-[1fr_120px] gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Название</label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Участок ОГР" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Код</label>
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="ОГР" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Руководитель подразделения</label>
          <Input value={f.head_name} onChange={(e) => setF({ ...f, head_name: e.target.value })} placeholder="ФИО начальника участка" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Дней на вахте</label>
            <Input type="number" min={1} value={f.on_days} onChange={(e) => setF({ ...f, on_days: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Дней отдыха</label>
            <Input type="number" min={0} value={f.off_days} onChange={(e) => setF({ ...f, off_days: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Пересменка, дней</label>
            <Input type="number" min={0} value={f.handover_days} onChange={(e) => setF({ ...f, handover_days: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Дата заезда вахты «А» (опорная дата)</label>
          <Input type="date" value={f.anchor_date} onChange={(e) => setF({ ...f, anchor_date: e.target.value })} />
          <p className="text-[11px] text-muted-foreground mt-1">От неё рассчитываются все будущие перевахтовки. Вахта «Б» заезжает через {f.on_days} дн.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { v: "full" as const, t: "Полная смена", d: "2 вахты (А и Б). В день перевахтовки меняется весь состав." },
            { v: "staggered" as const, t: "Со сдвигом половины", d: "4 вахты. Каждые ~30 дней меняется половина — на объекте всегда остаются опытные люди." },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setF({ ...f, scheme: o.v })}
              className={`rounded-lg border p-3 text-left ${f.scheme === o.v ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50"}`}
            >
              <p className="text-sm font-medium text-foreground">{o.t}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{o.d}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Цвет на графиках</label>
          <div className="flex gap-2 mt-1">
            {Object.entries(DEPT_COLORS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setF({ ...f, color: k })}
                className={`w-7 h-7 rounded-full ${v.bar} ${f.color === k ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : ""}`}
                aria-label={k}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-foreground">Отмена</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Icon name="Loader2" size={16} className="animate-spin" /> : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

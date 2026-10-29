import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { rotationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface WorkerForm {
  id?: number;
  full_name: string;
  position: string;
  tab_number: string;
  phone: string;
  pass_valid_to: string;
  housing: string;
  notes: string;
  crew_id: number | null;
}

export const emptyWorker = (crew_id: number | null = null): WorkerForm => ({
  full_name: "", position: "", tab_number: "", phone: "", pass_valid_to: "", housing: "", notes: "", crew_id,
});

interface Props {
  open: boolean;
  departmentId: number;
  crews: { id: number; name: string }[];
  positions: string[];
  initial: WorkerForm | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function WorkerDialog({ open, departmentId, crews, positions, initial, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [f, setF] = useState<WorkerForm>(emptyWorker());
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (open) setF(initial || emptyWorker(crews[0]?.id ?? null));
  }, [open, initial, crews]);

  const save = async (again = false) => {
    if (!f.full_name.trim()) {
      toast({ title: "Укажите ФИО", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await rotationApi.saveWorker({ ...f, department_id: departmentId });
      toast({ title: f.id ? "Работник обновлён" : "Работник добавлен", description: f.full_name });
      onSaved();
      if (again) setF({ ...emptyWorker(f.crew_id), position: f.position, housing: "" });
      else onClose();
    } catch (e) {
      toast({ title: "Не удалось сохранить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!f.id || !confirm(`Удалить ${f.full_name} из списка подразделения?`)) return;
    setBusy(true);
    try {
      await rotationApi.deleteWorker(f.id);
      toast({ title: "Работник удалён из списка" });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Карточка работника" : "Новый работник"}</DialogTitle>
          <DialogDescription>Данные хранятся только в разделе «Перевахтовка»</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">ФИО</label>
            <Input autoFocus value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder="Иванов Иван Иванович" />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Должность</label>
              <Input list="rot-positions" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} placeholder="Проходчик" />
              <datalist id="rot-positions">
                {positions.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Вахта</label>
              <Select value={f.crew_id ? String(f.crew_id) : "none"} onValueChange={(v) => setF({ ...f, crew_id: v === "none" ? null : Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {crews.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  <SelectItem value="none">Не распределён</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Пропуск действует до</label>
              <Input type="date" value={f.pass_valid_to} onChange={(e) => setF({ ...f, pass_valid_to: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Проживание</label>
              <Input value={f.housing} onChange={(e) => setF({ ...f, housing: e.target.value })} placeholder="Общежитие №1, к. 105" />
            </div>
          </div>
          <button type="button" onClick={() => setMore(!more)} className="text-xs text-primary flex items-center gap-1">
            <Icon name={more ? "ChevronUp" : "ChevronDown"} size={12} />
            Дополнительно
          </button>
          {more && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Табельный №</label>
                  <Input value={f.tab_number} onChange={(e) => setF({ ...f, tab_number: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Телефон</label>
                  <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+7…" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Примечание</label>
                <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {f.id ? (
            <Button variant="ghost" onClick={remove} disabled={busy} className="text-mine-red hover:text-mine-red gap-1.5">
              <Icon name="Trash2" size={14} />
              Удалить
            </Button>
          ) : (
            <Button variant="outline" onClick={() => save(true)} disabled={busy} className="text-foreground">
              Сохранить и добавить ещё
            </Button>
          )}
          <Button onClick={() => save(false)} disabled={busy}>
            {busy ? <Icon name="Loader2" size={16} className="animate-spin" /> : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

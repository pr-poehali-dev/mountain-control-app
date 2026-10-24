import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import Icon from "@/components/ui/icon";
import { checkpointApi } from "@/lib/api";
import { useCanSeeCode } from "@/hooks/use-can-see-code";

export interface EditablePass {
  id: number;
  full_name: string;
  personal_code: string;
  direction_raw: string;
  checkpoint_name: string;
  medical_ok: boolean;
  notes: string;
  created_at: string;
}

interface Props {
  item: EditablePass | null;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalInput(v: string): string {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PassEditDialog({ item, onClose, onSaved }: Props) {
  const canSeeCode = useCanSeeCode();
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [checkpointName, setCheckpointName] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [medicalOk, setMedicalOk] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setDirection(item.direction_raw === "out" ? "out" : "in");
    setCheckpointName(item.checkpoint_name || "КПП-1");
    setCreatedAt(toLocalInput(item.created_at));
    setMedicalOk(!!item.medical_ok);
    setNotes(item.notes || "");
    setError("");
  }, [item]);

  const save = async () => {
    if (!item) return;
    setSaving(true);
    setError("");
    try {
      await checkpointApi.updatePass({
        id: item.id,
        direction,
        checkpoint_name: checkpointName,
        created_at: new Date(createdAt).toISOString(),
        medical_ok: medicalOk,
        notes,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Редактирование прохода</DialogTitle>
          <DialogDescription>
            {item?.full_name}{canSeeCode && <> · <span className="font-mono">{item?.personal_code}</span></>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Направление</p>
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`flex items-center justify-center gap-2 h-10 rounded-lg border text-sm transition-colors ${
                    direction === d
                      ? d === "in"
                        ? "border-mine-green/50 bg-mine-green/10 text-mine-green"
                        : "border-mine-amber/50 bg-mine-amber/10 text-mine-amber"
                      : "border-border text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon name={d === "in" ? "LogIn" : "LogOut"} size={14} />
                  {d === "in" ? "Вход" : "Выход"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Дата и время</p>
              <Input type="datetime-local" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">КПП</p>
              <Input value={checkpointName} onChange={(e) => setCheckpointName(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm">Медосмотр пройден</span>
            <Switch checked={medicalOk} onCheckedChange={setMedicalOk} />
          </label>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Примечание</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {error && <p className="text-sm text-mine-red">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving || !createdAt}>
            {saving ? <Icon name="Loader2" size={14} className="animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

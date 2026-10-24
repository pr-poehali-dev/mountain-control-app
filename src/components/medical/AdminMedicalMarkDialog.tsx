import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import { medicalApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useCanSeeCode } from "@/hooks/use-can-see-code";

export interface MarkPerson {
  id: number;
  full_name: string;
  personal_code?: string;
  position?: string;
  department?: string;
  medical_status?: string;
}

type MarkStatus = "passed" | "failed" | "pending";

interface Props {
  person: MarkPerson | null;
  onClose: () => void;
  onMarked: (personId: number, status: MarkStatus) => void;
}

const current: Record<string, { label: string; cls: string }> = {
  passed: { label: "Пройден", cls: "text-mine-green bg-mine-green/10 border-mine-green/30" },
  failed: { label: "Не допущен", cls: "text-mine-red bg-mine-red/10 border-mine-red/30" },
  pending: { label: "Ожидает", cls: "text-mine-amber bg-mine-amber/10 border-mine-amber/30" },
};

const actions: { status: MarkStatus; label: string; icon: string; cls: string }[] = [
  { status: "passed", label: "Медосмотр пройден", icon: "CheckCircle2", cls: "bg-mine-green text-white hover:bg-mine-green/90" },
  { status: "failed", label: "Не допущен", icon: "XCircle", cls: "border border-mine-red/40 text-mine-red hover:bg-mine-red/10" },
  { status: "pending", label: "Сбросить отметку", icon: "RotateCcw", cls: "border border-border text-muted-foreground hover:bg-secondary" },
];

export default function AdminMedicalMarkDialog({ person, onClose, onMarked }: Props) {
  const { toast } = useToast();
  const canSeeCode = useCanSeeCode();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<MarkStatus | null>(null);

  useEffect(() => {
    if (person) setNotes("");
  }, [person]);

  const mark = async (status: MarkStatus) => {
    if (!person) return;
    setSaving(status);
    try {
      const res = await medicalApi.adminMark(person.id, status, notes);
      toast({ title: res.message || "Отметка сохранена" });
      onMarked(person.id, status);
      onClose();
    } catch (e) {
      toast({ title: "Не удалось сохранить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const st = current[person?.medical_status || "pending"] || current.pending;

  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="HeartPulse" size={18} className="text-mine-green" />
            Отметка медосмотра
          </DialogTitle>
        </DialogHeader>

        {person && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{person.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[person.position, person.department].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {canSeeCode && person.personal_code && (
                    <code className="text-[11px] text-red-500 font-mono">{person.personal_code}</code>
                  )}
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
              </div>
            </div>

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Комментарий (необязательно)"
              rows={2}
            />

            <div className="space-y-2">
              {actions.map((a) => (
                <button
                  key={a.status}
                  type="button"
                  disabled={!!saving || (a.status === "pending" && (person.medical_status || "pending") === "pending")}
                  onClick={() => mark(a.status)}
                  className={`w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${a.cls}`}
                >
                  <Icon name={saving === a.status ? "Loader2" : a.icon} size={16} className={saving === a.status ? "animate-spin" : ""} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

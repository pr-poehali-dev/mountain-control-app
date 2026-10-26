import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ahoApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  room_id: number;
  room_number: string;
  building_name: string;
  floor: number;
  capacity: number;
  occupied: number;
  free_now: number;
  permanent: boolean;
  same_org: number;
  reasons: string[];
  neighbors: { name: string; org: string; on_site: boolean }[];
}

interface Props {
  person: { personnel_id: number; full_name: string } | null;
  onClose: () => void;
  onAssigned: () => void;
}

export default function RoomSuggestDialog({ person, onClose, onAssigned }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [gender, setGender] = useState("");
  const [org, setOrg] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const load = async (pid: number) => {
    setLoading(true);
    try {
      const d = await ahoApi.suggestRooms(pid);
      setItems(d.items || []);
      setGender(d.gender || "");
      setOrg(d.organization || "");
    } catch (e) {
      toast({ title: "Не удалось подобрать", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (person) load(person.personnel_id);
    else setItems([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.personnel_id]);

  const changeGender = async (g: "M" | "F") => {
    if (!person) return;
    await ahoApi.setGender(person.personnel_id, g).catch(() => {});
    load(person.personnel_id);
  };

  const assign = async (s: Suggestion) => {
    if (!person) return;
    setSaving(s.room_id);
    try {
      const res = await ahoApi.assignRoomById({ personnel_id: person.personnel_id, room_id: s.room_id });
      toast({ title: res.temporary ? "Заселён временно" : "Заселён", description: res.message });
      onAssigned();
      onClose();
    } catch (e) {
      toast({ title: "Не удалось заселить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Sparkles" size={18} className="text-mine-amber" />
            Подбор комнаты: {person?.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Пол:</span>
          {(["M", "F"] as const).map((g) => (
            <button
              key={g}
              onClick={() => changeGender(g)}
              className={`px-2.5 py-1 rounded-md border transition-colors ${
                gender === g ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {g === "M" ? "Мужской" : "Женский"}
            </button>
          ))}
          {!gender && <span className="text-mine-amber">не определён — укажите для точного подбора</span>}
          <span className="text-muted-foreground ml-auto">Организация: <b className="text-foreground">{org || "—"}</b></span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Icon name="BedDouble" size={32} className="mx-auto mb-2 opacity-30" />
            Подходящих свободных мест нет
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((s, idx) => (
              <div
                key={s.room_id}
                className={`rounded-xl border p-3 flex gap-3 items-start ${idx === 0 ? "border-mine-green/40 bg-mine-green/5" : "border-border bg-card"}`}
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {idx === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-mine-green text-white font-semibold">ЛУЧШИЙ ВАРИАНТ</span>}
                    <p className="text-sm font-semibold text-foreground">
                      {s.building_name}, комн. {s.room_number}
                    </p>
                    {s.floor > 0 && <span className="text-xs text-muted-foreground">{s.floor} этаж</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground">
                      свободно {s.free_now} из {s.capacity}
                    </span>
                    {s.reasons.map((r) => (
                      <span
                        key={r}
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          r.startsWith("Временно") ? "bg-mine-amber/15 text-mine-amber" : "bg-mine-green/10 text-mine-green"
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  {s.neighbors.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Соседи:{" "}
                      {s.neighbors.map((n, i) => (
                        <span key={i} className={n.on_site ? "" : "opacity-60"}>
                          {i > 0 && ", "}
                          {n.name}
                          {n.org && ` (${n.org})`}
                          {!n.on_site && " — в отъезде"}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="shrink-0 gap-1 bg-mine-green text-white hover:bg-mine-green/90"
                  disabled={saving !== null}
                  onClick={() => assign(s)}
                >
                  <Icon name={saving === s.room_id ? "Loader2" : "Home"} size={14} className={saving === s.room_id ? "animate-spin" : ""} />
                  Заселить
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

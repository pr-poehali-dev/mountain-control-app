import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ResidenceSelect, { type ResidenceValue } from "@/components/personnel/ResidenceSelect";
import { ahoApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface QueueItem {
  personnel_id: number;
  full_name: string;
  personal_code: string;
  organization: string;
  position: string;
  department: string;
  status: string;
  created_at: string | null;
  arrival_date: string | null;
  source: "list" | "manual";
  tab_number: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  expected: { label: "Ожидается", cls: "text-mine-amber bg-mine-amber/10" },
  arrived: { label: "На территории", cls: "text-mine-green bg-mine-green/10" },
  on_shift: { label: "На смене", cls: "text-mine-cyan bg-mine-cyan/10" },
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ru-RU");
  } catch {
    return "—";
  }
};

interface Props {
  canSeeCode: boolean;
  version?: number;
  onChanged: () => void;
}

export default function HousingQueue({ canSeeCode, version = 0, onChanged }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [targets, setTargets] = useState<QueueItem[]>([]);
  const [room, setRoom] = useState<ResidenceValue>({ residence_building_id: null, residence_room_id: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await ahoApi.getUnhoused();
      setItems(d.items || []);
      setSelected((prev) => prev.filter((id) => (d.items || []).some((i: QueueItem) => i.personnel_id === id)));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (status === "all" || (status === "arrived" ? i.status !== "expected" : i.status === status)) &&
        (!q || [i.full_name, i.organization, i.position, i.tab_number].some((v) => (v || "").toLowerCase().includes(q)))
    );
  }, [items, search, status]);

  const counts = useMemo(
    () => ({
      all: items.length,
      arrived: items.filter((i) => i.status === "arrived" || i.status === "on_shift").length,
      expected: items.filter((i) => i.status === "expected").length,
    }),
    [items]
  );

  const allChecked = filtered.length > 0 && filtered.every((i) => selected.includes(i.personnel_id));

  const toggleAll = () => {
    const ids = filtered.map((i) => i.personnel_id);
    setSelected(allChecked ? selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])));
  };

  const openDialog = (list: QueueItem[]) => {
    setTargets(list);
    setRoom({ residence_building_id: null, residence_room_id: null });
  };

  const assign = async () => {
    if (!room.residence_room_id || targets.length === 0) return;
    setSaving(true);
    let ok = 0;
    let lastError = "";
    for (const t of targets) {
      try {
        await ahoApi.assignRoomById({ personnel_id: t.personnel_id, room_id: room.residence_room_id });
        ok++;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Ошибка";
        break;
      }
    }
    setSaving(false);
    if (ok > 0) {
      toast({ title: ok === 1 ? `${targets[0].full_name} заселён` : `Заселено: ${ok} из ${targets.length}` });
    }
    if (lastError) {
      toast({ title: ok > 0 ? "Не все заселены" : "Не удалось заселить", description: lastError, variant: "destructive" });
    }
    setTargets([]);
    setSelected([]);
    load();
    onChanged();
  };

  const filters = [
    { id: "all", label: "Все", count: counts.all },
    { id: "arrived", label: "На территории", count: counts.arrived },
    { id: "expected", label: "Ожидаются", count: counts.expected },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Список расселения</h3>
          {counts.all > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-mine-amber/15 text-mine-amber font-medium">
              ждут заселения: {counts.all}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ФИО, организация..."
              className="h-9 w-56 pl-8 bg-secondary/50 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={load} disabled={loading}>
            <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
            Обновить
          </Button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              status === f.id
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label} · {f.count}
          </button>
        ))}
        {selected.length > 0 && (
          <Button
            size="sm"
            className="h-8 ml-auto gap-1.5 bg-mine-green text-white hover:bg-mine-green/90"
            onClick={() => openDialog(items.filter((i) => selected.includes(i.personnel_id)))}
          >
            <Icon name="Home" size={14} />
            Заселить выбранных ({selected.length})
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Icon name={items.length === 0 ? "CheckCircle2" : "SearchX"} size={32} className={`mx-auto mb-2 ${items.length === 0 ? "text-mine-green/50" : "text-muted-foreground/30"}`} />
            <p className="text-sm text-muted-foreground">
              {loading ? "Загрузка..." : items.length === 0 ? "Все сотрудники расселены" : "Никого не найдено"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-3 py-2 w-8">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ФИО</th>
                  {canSeeCode && <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Код</th>}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Организация / должность</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Статус</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Откуда</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Добавлен</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const st = STATUS[i.status] || STATUS.arrived;
                  return (
                    <tr key={i.personnel_id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={selected.includes(i.personnel_id)}
                          onCheckedChange={(v) =>
                            setSelected(v ? [...selected, i.personnel_id] : selected.filter((id) => id !== i.personnel_id))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-foreground">{i.full_name}</td>
                      {canSeeCode && <td className="px-3 py-2 text-xs font-mono text-red-500">{i.personal_code}</td>}
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {i.organization || "—"}
                        {i.position && <span className="block text-[11px]">{i.position}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Icon name={i.source === "list" ? "FileSpreadsheet" : "UserPlus"} size={12} />
                          {i.source === "list" ? "Список" : "Вручную"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(i.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-mine-green/40 text-mine-green hover:bg-mine-green/10 hover:text-mine-green" onClick={() => openDialog([i])}>
                          <Icon name="Home" size={12} />
                          Заселить
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={targets.length > 0} onOpenChange={(o) => !o && setTargets([])}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {targets.length === 1 ? `Заселение: ${targets[0].full_name}` : `Заселение ${targets.length} сотрудников`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {targets.length > 1 && (
              <div className="max-h-32 overflow-y-auto rounded-lg bg-secondary/40 p-2 text-xs text-muted-foreground space-y-0.5">
                {targets.map((t) => (
                  <p key={t.personnel_id}>{t.full_name}</p>
                ))}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Общежитие и комната</label>
              <ResidenceSelect value={room} onChange={setRoom} roomsOnly key={targets.map((t) => t.personnel_id).join(",")} />
            </div>
            {targets.length > 1 && (
              <p className="text-[11px] text-muted-foreground">Все выбранные будут заселены в одну комнату. Если мест не хватит — оставшиеся останутся в списке.</p>
            )}
            <Button onClick={assign} disabled={!room.residence_room_id || saving} className="w-full gap-2 bg-mine-green text-white hover:bg-mine-green/90">
              <Icon name={saving ? "Loader2" : "Home"} size={16} className={saving ? "animate-spin" : ""} />
              Заселить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

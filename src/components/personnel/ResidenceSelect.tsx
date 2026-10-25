import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { personnelApi } from "@/lib/api";

interface Room {
  id: number;
  room_number: string;
  name?: string;
  floor?: number | null;
  capacity?: number;
  occupied?: number;
}

interface Building {
  id: number;
  name: string;
  rooms: Room[];
}

export interface ResidenceValue {
  residence_building_id: number | null;
  residence_room_id: number | null;
}

interface ResidenceSelectProps {
  value: ResidenceValue;
  onChange: (value: ResidenceValue) => void;
  compact?: boolean;
  roomsOnly?: boolean;
}

const NONE = "none";

function toKey(v: ResidenceValue): string {
  if (v.residence_room_id) return `r:${v.residence_room_id}`;
  if (v.residence_building_id) return `b:${v.residence_building_id}`;
  return NONE;
}

const compactClass = "h-8 px-2 -mx-2 w-[calc(100%+1rem)] bg-transparent border-transparent shadow-none text-sm font-medium hover:bg-secondary/40 hover:border-border focus:ring-1 focus:ring-mine-cyan/50 focus:ring-offset-0 disabled:opacity-100";

export default function ResidenceSelect({ value, onChange, compact, roomsOnly }: ResidenceSelectProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    personnelApi
      .getResidences()
      .then((res) => setBuildings(res.buildings || []))
      .catch(() => setBuildings([]))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string) => {
    if (key === NONE) return onChange({ residence_building_id: null, residence_room_id: null });
    const [kind, id] = key.split(":");
    if (kind === "b") return onChange({ residence_building_id: Number(id), residence_room_id: null });
    const building = buildings.find((b) => b.rooms.some((r) => r.id === Number(id)));
    onChange({ residence_building_id: building?.id ?? null, residence_room_id: Number(id) });
  };

  return (
    <Select value={toKey(value)} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className={compact ? compactClass : "bg-secondary/50"}>
        <SelectValue placeholder={loading ? "Загрузка..." : "Не указано"} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {!roomsOnly && <SelectItem value={NONE}>Не указано</SelectItem>}
        {!loading && buildings.length === 0 && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Помещения ещё не созданы в разделе АХО
          </div>
        )}
        {buildings.map((b) => (
          <SelectGroup key={b.id}>
            <SelectLabel className="text-xs text-mine-cyan">{b.name}</SelectLabel>
            {!roomsOnly && <SelectItem value={`b:${b.id}`}>{b.name} — без комнаты</SelectItem>}
            {b.rooms.map((r) => {
              const cap = r.capacity ?? 0;
              const occ = r.occupied ?? 0;
              const isCurrent = value.residence_room_id === r.id;
              const full = cap > 0 && occ >= cap && !isCurrent;
              return (
                <SelectItem key={r.id} value={`r:${r.id}`} disabled={full}>
                  {b.name}, комн. {r.room_number}{r.name ? ` — ${r.name}` : ""}
                  {r.floor ? ` (${r.floor} эт.)` : ""}
                  {cap > 0 && (
                    <span className={`ml-1.5 text-[10px] ${full ? "text-mine-red" : occ > 0 ? "text-mine-amber" : "text-mine-green"}`}>
                      {full ? "занято" : `свободно ${cap - occ} из ${cap}`}
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

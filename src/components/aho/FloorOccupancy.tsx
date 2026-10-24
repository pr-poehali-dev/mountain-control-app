import Icon from "@/components/ui/icon";

export interface FloorStat {
  floor: number;
  rooms_count: number;
  total_beds: number;
  occupied_beds: number;
  free_beds: number;
}

export interface BuildingFloors {
  id: number;
  name: string;
  number: string;
  total_beds: number;
  free_beds: number;
  floors?: FloorStat[];
}

interface Props {
  buildings: BuildingFloors[];
  onBuildingClick?: (id: number) => void;
}

const floorLabel = (f: number) => (f > 0 ? `${f} этаж` : "Без этажа");

const floorStyle = (f: FloorStat) => {
  if (f.total_beds === 0) return "border-border bg-secondary/30 text-muted-foreground";
  if (f.free_beds <= 0) return "border-mine-red/40 bg-mine-red/10 text-mine-red";
  if (f.free_beds / f.total_beds <= 0.2) return "border-mine-amber/40 bg-mine-amber/10 text-mine-amber";
  return "border-mine-green/30 bg-mine-green/5 text-mine-green";
};

export default function FloorOccupancy({ buildings, onBuildingClick }: Props) {
  if (buildings.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
            <Icon name="Layers" size={16} className="text-mine-cyan" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Свободные места по этажам</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-mine-green/60" />Есть места</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-mine-amber/70" />Почти занят</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-mine-red/70" />Заполнен</span>
        </div>
      </div>

      <div className="space-y-3">
        {buildings.map((b) => {
          const floors = b.floors || [];
          const fullFloors = floors.filter((f) => f.total_beds > 0 && f.free_beds <= 0).length;
          return (
            <div key={b.id} className="rounded-lg border border-border p-3">
              <button
                type="button"
                onClick={() => onBuildingClick?.(b.id)}
                className="w-full flex items-center justify-between gap-2 mb-2 text-left group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-mine-cyan transition-colors">{b.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Свободно {b.free_beds} из {b.total_beds}
                    {fullFloors > 0 && <span className="text-mine-red"> · заполнено этажей: {fullFloors}</span>}
                  </p>
                </div>
                <Icon name="ChevronRight" size={14} className="text-muted-foreground shrink-0" />
              </button>

              {floors.length === 0 ? (
                <p className="text-xs text-muted-foreground">Комнаты не добавлены</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {floors.map((f) => (
                    <div key={f.floor} className={`rounded-md border px-2.5 py-2 ${floorStyle(f)}`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-foreground">{floorLabel(f.floor)}</span>
                        {f.total_beds > 0 && f.free_beds <= 0 && <Icon name="Ban" size={12} />}
                      </div>
                      <p className="text-lg font-bold leading-tight">
                        {f.free_beds}
                        <span className="text-[11px] font-normal text-muted-foreground"> / {f.total_beds} св.</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">{f.rooms_count} комн.</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

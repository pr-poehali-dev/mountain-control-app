import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ahoApi } from "@/lib/api";

interface BuildingStat {
  id: number;
  name: string;
  number: string;
  rooms_count: number;
  total_beds: number;
  occupied_beds: number;
  free_beds: number;
}

interface Resident {
  id: number;
  full_name: string;
  position: string;
  organization: string;
  personal_code: string;
  room?: string;
  building?: string;
}

interface RoomDetail {
  id: number;
  room_number: string;
  capacity: number;
  floor: number;
  occupied: number;
  free: number;
  residents: Resident[];
}

interface HousingStatsData {
  total_buildings: number;
  total_beds: number;
  occupied_beds: number;
  free_beds: number;
  buildings: BuildingStat[];
  building_detail?: {
    building_id: number;
    building_name: string;
    rooms: RoomDetail[];
  };
  all_residents?: Resident[];
}

type DialogMode = null | "buildings" | "occupied" | "free" | "building-rooms" | "residents";

export default function HousingStats() {
  const [data, setData] = useState<HousingStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingStat | null>(null);
  const [roomsData, setRoomsData] = useState<RoomDetail[]>([]);
  const [residentsData, setResidentsData] = useState<Resident[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await ahoApi.getHousingStats();
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const openBuildingsList = () => {
    setDialogMode("buildings");
    setDialogTitle("Все общежития");
  };

  const openOccupied = () => {
    setDialogMode("occupied");
    setDialogTitle("Занятые места");
  };

  const openFree = () => {
    setDialogMode("free");
    setDialogTitle("Свободные места");
  };

  const openBuildingRooms = async (b: BuildingStat, filter: "all" | "occupied" | "free") => {
    setDetailLoading(true);
    setSelectedBuilding(b);
    setDialogMode("building-rooms");
    setDialogTitle(`${b.name} — ${filter === "occupied" ? "занятые" : filter === "free" ? "свободные" : "все"} комнаты`);
    setExpandedRoom(null);
    try {
      const res = await ahoApi.getHousingStats({
        detail: "building-rooms",
        building_id: String(b.id),
      });
      let rooms = res.building_detail?.rooms || [];
      if (filter === "occupied") rooms = rooms.filter((r: RoomDetail) => r.occupied > 0);
      else if (filter === "free") rooms = rooms.filter((r: RoomDetail) => r.free > 0);
      setRoomsData(rooms);
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  const openAllResidents = async () => {
    setDetailLoading(true);
    setDialogMode("residents");
    setDialogTitle("Все проживающие");
    try {
      const res = await ahoApi.getHousingStats({ detail: "all-residents" });
      setResidentsData(res.all_residents || []);
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedBuilding(null);
    setRoomsData([]);
    setResidentsData([]);
    setExpandedRoom(null);
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-6">
        <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const occupancyPct = data.total_beds > 0 ? Math.round((data.occupied_beds / data.total_beds) * 100) : 0;

  return (
    <>
      <div className="rounded-xl border border-mine-cyan/20 bg-gradient-to-br from-mine-cyan/5 via-card to-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
              <Icon name="BarChart3" size={16} className="text-mine-cyan" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Статистика расселения</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={loadStats} disabled={loading}>
            <Icon name="RefreshCw" size={13} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={openBuildingsList}
            className="rounded-lg border border-border bg-card/80 p-3 text-left hover:border-mine-cyan/40 hover:bg-mine-cyan/5 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="Building2" size={13} className="text-mine-cyan" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Общежития</span>
            </div>
            <p className="text-2xl font-bold text-foreground group-hover:text-mine-cyan transition-colors">
              {data.total_buildings}
            </p>
          </button>

          <button
            onClick={() => { if (data.total_beds > 0) openBuildingsList(); }}
            className="rounded-lg border border-border bg-card/80 p-3 text-left hover:border-mine-amber/40 hover:bg-mine-amber/5 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="BedDouble" size={13} className="text-mine-amber" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Всего мест</span>
            </div>
            <p className="text-2xl font-bold text-foreground group-hover:text-mine-amber transition-colors">
              {data.total_beds}
            </p>
          </button>

          <button
            onClick={openOccupied}
            className="rounded-lg border border-border bg-card/80 p-3 text-left hover:border-mine-red/40 hover:bg-mine-red/5 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="UserCheck" size={13} className="text-mine-red" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Занято</span>
            </div>
            <p className="text-2xl font-bold text-mine-red group-hover:text-mine-red transition-colors">
              {data.occupied_beds}
            </p>
          </button>

          <button
            onClick={openFree}
            className="rounded-lg border border-border bg-card/80 p-3 text-left hover:border-mine-green/40 hover:bg-mine-green/5 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="DoorOpen" size={13} className="text-mine-green" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Свободно</span>
            </div>
            <p className="text-2xl font-bold text-mine-green group-hover:text-mine-green transition-colors">
              {data.free_beds}
            </p>
          </button>
        </div>

        {data.total_beds > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Заполненность</span>
              <span>{occupancyPct}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${occupancyPct >= 90 ? "bg-mine-red" : occupancyPct >= 60 ? "bg-mine-amber" : "bg-mine-green"}`}
                style={{ width: `${Math.min(occupancyPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {data.occupied_beds > 0 && (
          <button
            onClick={openAllResidents}
            className="mt-3 flex items-center gap-1.5 text-xs text-mine-cyan hover:text-mine-cyan/80 transition-colors"
          >
            <Icon name="Users" size={13} />
            Показать всех проживающих ({data.occupied_beds})
            <Icon name="ChevronRight" size={12} />
          </button>
        )}
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {dialogMode === "buildings" && (
              <div className="space-y-2 pb-4">
                {data.buildings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Общежития не настроены</p>
                ) : (
                  data.buildings.map(b => {
                    const pct = b.total_beds > 0 ? Math.round((b.occupied_beds / b.total_beds) * 100) : 0;
                    return (
                      <div key={b.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon name="Building2" size={15} className="text-mine-cyan" />
                            <span className="text-sm font-semibold">{b.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{b.rooms_count} комнат</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
                          <div>
                            <p className="font-bold text-foreground">{b.total_beds}</p>
                            <p className="text-[10px] text-muted-foreground">Мест</p>
                          </div>
                          <button onClick={() => openBuildingRooms(b, "occupied")} className="hover:bg-mine-red/5 rounded-md transition-colors cursor-pointer">
                            <p className="font-bold text-mine-red">{b.occupied_beds}</p>
                            <p className="text-[10px] text-muted-foreground">Занято</p>
                          </button>
                          <button onClick={() => openBuildingRooms(b, "free")} className="hover:bg-mine-green/5 rounded-md transition-colors cursor-pointer">
                            <p className="font-bold text-mine-green">{b.free_beds}</p>
                            <p className="text-[10px] text-muted-foreground">Свободно</p>
                          </button>
                        </div>
                        {b.total_beds > 0 && (
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 90 ? "bg-mine-red" : pct >= 60 ? "bg-mine-amber" : "bg-mine-green"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {(dialogMode === "occupied" || dialogMode === "free") && (
              <div className="space-y-2 pb-4">
                {data.buildings.filter(b => dialogMode === "occupied" ? b.occupied_beds > 0 : b.free_beds > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {dialogMode === "occupied" ? "Нет занятых мест" : "Нет свободных мест"}
                  </p>
                ) : (
                  data.buildings
                    .filter(b => dialogMode === "occupied" ? b.occupied_beds > 0 : b.free_beds > 0)
                    .map(b => (
                      <button
                        key={b.id}
                        onClick={() => openBuildingRooms(b, dialogMode === "occupied" ? "occupied" : "free")}
                        className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-mine-cyan/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon name="Building2" size={15} className="text-mine-cyan" />
                            <span className="text-sm font-semibold">{b.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-sm font-bold ${dialogMode === "occupied" ? "text-mine-red" : "text-mine-green"}`}>
                              {dialogMode === "occupied" ? b.occupied_beds : b.free_beds}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {dialogMode === "occupied" ? "занято" : "свободно"}
                            </span>
                            <Icon name="ChevronRight" size={14} className="text-muted-foreground/40 ml-1" />
                          </div>
                        </div>
                      </button>
                    ))
                )}
              </div>
            )}

            {dialogMode === "building-rooms" && (
              <div className="space-y-2 pb-4">
                {detailLoading ? (
                  <div className="flex justify-center py-8">
                    <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : roomsData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Комнат не найдено</p>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (selectedBuilding) {
                          setDialogMode("buildings");
                          setDialogTitle("Все общежития");
                        }
                      }}
                      className="flex items-center gap-1 text-xs text-mine-cyan hover:text-mine-cyan/80 transition-colors mb-2"
                    >
                      <Icon name="ArrowLeft" size={13} />
                      Назад к общежитиям
                    </button>
                    {roomsData.map(room => {
                      const isExpanded = expandedRoom === room.room_number;
                      const hasResidents = room.residents.length > 0;
                      return (
                        <div key={room.id} className="rounded-lg border border-border bg-card overflow-hidden">
                          <button
                            onClick={() => hasResidents && setExpandedRoom(isExpanded ? null : room.room_number)}
                            className={`w-full p-3 text-left flex items-center justify-between ${hasResidents ? "cursor-pointer hover:bg-secondary/20" : ""} transition-colors`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${room.free === 0 ? "bg-mine-red/10 text-mine-red" : room.occupied > 0 ? "bg-mine-amber/10 text-mine-amber" : "bg-mine-green/10 text-mine-green"}`}>
                                {room.room_number}
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">
                                  {room.occupied}/{room.capacity} мест
                                </span>
                                {room.floor > 0 && (
                                  <span className="text-[10px] text-muted-foreground/50 ml-2">
                                    {room.floor} этаж
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {room.free > 0 && (
                                <span className="text-[10px] text-mine-green bg-mine-green/10 px-1.5 py-0.5 rounded">
                                  {room.free} св.
                                </span>
                              )}
                              {hasResidents && (
                                <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground/40" />
                              )}
                            </div>
                          </button>
                          {isExpanded && hasResidents && (
                            <div className="border-t border-border/50 bg-secondary/10">
                              {room.residents.map(r => (
                                <div key={r.id} className="px-3 py-2 border-b border-border/30 last:border-0 flex items-center gap-2">
                                  <Icon name="User" size={13} className="text-muted-foreground/50 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{r.full_name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {[r.position, r.organization].filter(Boolean).join(" · ") || "—"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {dialogMode === "residents" && (
              <div className="space-y-1 pb-4">
                {detailLoading ? (
                  <div className="flex justify-center py-8">
                    <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : residentsData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Нет проживающих</p>
                ) : (
                  residentsData.map(r => (
                    <div key={r.id} className="rounded-lg border border-border/50 bg-card p-2.5 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-mine-cyan/10 flex items-center justify-center shrink-0">
                        <Icon name="User" size={13} className="text-mine-cyan" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{r.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[r.position, r.organization].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-mono text-mine-cyan">{r.room}</p>
                        <p className="text-[9px] text-muted-foreground">{r.building}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
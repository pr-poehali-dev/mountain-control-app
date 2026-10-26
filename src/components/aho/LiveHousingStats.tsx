import { useState } from "react";
import type React from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ahoApi } from "@/lib/api";
import RoomSuggestDialog from "./RoomSuggestDialog";
import { triggerConflictCheck } from "./HousingConflictAlert";

export interface LiveStats {
  total: number;
  on_site: number;
  on_shift: number;
  departed: number;
  expected: number;
  on_site_housed: number;
  on_site_unhoused: number;
  expected_unhoused: number;
  away_keep_place: number;
  temporary: number;
  housed_total: number;
  entered_today: number;
  left_today: number;
  conflicts: number;
  by_org: { organization: string; on_site: number; housed: number; unhoused: number; departed: number }[];
  gender: { M: number; F: number; unknown: number };
}

interface ListItem {
  personnel_id: number;
  full_name: string;
  organization: string;
  position: string;
  status: string;
  room_number: string;
  building_name: string;
  temp_owner_name: string;
}

const KIND_TITLES: Record<string, string> = {
  on_site: "На территории",
  on_shift: "На смене",
  departed: "Выехали / вышли через КПП",
  expected: "Ожидаются",
  on_site_housed: "На территории и заселены",
  on_site_unhoused: "На территории без комнаты",
  expected_unhoused: "Ожидаются без комнаты",
  away_keep_place: "В отъезде, место за ними",
  temporary: "Живут временно",
  housed_total: "Все заселённые",
};

const STATUS_LABEL: Record<string, string> = {
  arrived: "на территории",
  on_shift: "на смене",
  departed: "выехал",
  expected: "ожидается",
};

const COLORS: Record<string, string> = {
  green: "text-mine-green bg-mine-green/10 border-mine-green/25",
  cyan: "text-mine-cyan bg-mine-cyan/10 border-mine-cyan/25",
  amber: "text-mine-amber bg-mine-amber/10 border-mine-amber/25",
  red: "text-mine-red bg-mine-red/10 border-mine-red/25",
  muted: "text-foreground bg-secondary/50 border-border",
};

function Tile({ icon, label, value, color, hint, onClick, pulse }: {
  icon: string; label: string; value: number; color: string; hint?: string; onClick?: () => void; pulse?: boolean;
}) {
  const cls = COLORS[color] || COLORS.muted;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`group text-left rounded-xl border p-3.5 transition-all ${cls} ${onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default"} ${pulse ? "animate-pulse" : ""}`}
    >
      <div className="flex items-center justify-between">
        <Icon name={icon} size={18} />
        {onClick && <Icon name="ChevronRight" size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
      </div>
      <div className="text-2xl font-bold mt-1.5">{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
      {hint && <div className="text-[10px] mt-0.5 opacity-80">{hint}</div>}
    </button>
  );
}

function Bar({ parts }: { parts: { value: number; cls: string; label: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
        {parts.map((p) => p.value > 0 && (
          <div key={p.label} className={`${p.cls} transition-all`} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${p.cls}`} />
            {p.label}: <b className="text-foreground">{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LiveHousingStats({ live, onChanged, updatedAt, canHouse = true, title = "Сейчас на предприятии", headerAction }: {
  live: LiveStats; onChanged: () => void; updatedAt: Date | null; canHouse?: boolean; title?: string; headerAction?: React.ReactNode;
}) {
  const [list, setList] = useState<{ kind: string; org?: string } | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggest, setSuggest] = useState<{ personnel_id: number; full_name: string } | null>(null);

  const open = async (kind: string, org?: string) => {
    setList({ kind, org });
    setLoading(true);
    try {
      const d = await ahoApi.getLiveList(kind, org);
      setItems(d.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const unhousedAll = live.on_site_unhoused + live.expected_unhoused;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-mine-green opacity-75 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-mine-green" />
          </span>
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              обновлено в {updatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · автообновление
            </span>
          )}
          {headerAction}
        </div>
      </div>

      {live.conflicts > 0 && canHouse && (
        <button
          onClick={triggerConflictCheck}
          className="w-full flex items-center gap-3 rounded-xl border-2 border-mine-red bg-mine-red/10 p-3 text-left hover:bg-mine-red/15 transition-colors"
        >
          <Icon name="BellRing" size={20} className="text-mine-red animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-mine-red">Конфликты расселения: {live.conflicts}</p>
            <p className="text-[11px] text-muted-foreground">Вернулись хозяева мест, на которых живут временные жильцы</p>
          </div>
          <span className="text-xs font-medium text-mine-red">Разобрать →</span>
        </button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon="MapPin" label="На территории" value={live.on_site} color="green" hint={live.on_shift ? `из них на смене: ${live.on_shift}` : undefined} onClick={() => open("on_site")} />
        <Tile icon="LogOut" label="Выехали / вышли через КПП" value={live.departed} color="muted" onClick={() => open("departed")} />
        <Tile icon="Clock" label="Ожидаются" value={live.expected} color="cyan" onClick={() => open("expected")} />
        <Tile icon="ArrowLeftRight" label="Сегодня через КПП" value={live.entered_today + live.left_today} color="muted" hint={`вход ${live.entered_today} · выход ${live.left_today}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon="Home" label="На территории — заселены" value={live.on_site_housed} color="green" onClick={() => open("on_site_housed")} />
        <Tile icon="UserX" label="Не заселены" value={unhousedAll} color={unhousedAll ? "amber" : "muted"} hint={`на территории ${live.on_site_unhoused} · ожидаются ${live.expected_unhoused}`} onClick={() => open(live.on_site_unhoused ? "on_site_unhoused" : "expected_unhoused")} pulse={live.on_site_unhoused > 0} />
        <Tile icon="Luggage" label="В отъезде, место за ними" value={live.away_keep_place} color="muted" onClick={() => open("away_keep_place")} />
        <Tile icon="Repeat" label="Живут временно" value={live.temporary} color="cyan" onClick={() => open("temporary")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Icon name="Users" size={16} className="text-mine-cyan" />
            Где работники
          </h4>
          <Bar parts={[
            { value: live.on_site, cls: "bg-mine-green", label: "На территории" },
            { value: live.expected, cls: "bg-mine-cyan", label: "Ожидаются" },
            { value: live.departed, cls: "bg-muted-foreground/50", label: "Выехали" },
          ]} />
          <h4 className="text-sm font-semibold flex items-center gap-2 pt-2">
            <Icon name="BedDouble" size={16} className="text-mine-amber" />
            Расселение на территории
          </h4>
          <Bar parts={[
            { value: live.on_site_housed - Math.min(live.temporary, live.on_site_housed), cls: "bg-mine-green", label: "Постоянно" },
            { value: Math.min(live.temporary, live.on_site_housed), cls: "bg-mine-cyan", label: "Временно" },
            { value: live.on_site_unhoused, cls: "bg-mine-amber", label: "Без комнаты" },
          ]} />
          <div className="flex gap-4 text-[11px] text-muted-foreground pt-1">
            <span>Мужчин: <b className="text-foreground">{live.gender.M}</b></span>
            <span>Женщин: <b className="text-foreground">{live.gender.F}</b></span>
            {live.gender.unknown > 0 && <span>Пол не указан: <b className="text-mine-amber">{live.gender.unknown}</b></span>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Icon name="Building" size={16} className="text-muted-foreground" />
            По организациям
          </h4>
          {live.by_org.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Нет данных</p>
          ) : (
            <div className="overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left py-1 font-medium">Организация</th>
                    <th className="text-right py-1 font-medium">На терр.</th>
                    <th className="text-right py-1 font-medium">Засел.</th>
                    <th className="text-right py-1 font-medium">Без комн.</th>
                    <th className="text-right py-1 font-medium">Выехали</th>
                  </tr>
                </thead>
                <tbody>
                  {live.by_org.map((o) => (
                    <tr key={o.organization} className="border-t border-border/50">
                      <td className="py-1.5 pr-2 text-foreground truncate max-w-[140px]">{o.organization}</td>
                      <td className="py-1.5 text-right"><button className="hover:underline text-mine-green font-medium" onClick={() => open("on_site", o.organization)}>{o.on_site}</button></td>
                      <td className="py-1.5 text-right"><button className="hover:underline" onClick={() => open("on_site_housed", o.organization)}>{o.housed}</button></td>
                      <td className="py-1.5 text-right"><button className={`hover:underline ${o.unhoused ? "text-mine-amber font-semibold" : ""}`} onClick={() => open("on_site_unhoused", o.organization)}>{o.unhoused}</button></td>
                      <td className="py-1.5 text-right"><button className="hover:underline text-muted-foreground" onClick={() => open("departed", o.organization)}>{o.departed}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!list} onOpenChange={(o) => !o && setList(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">
              {list ? KIND_TITLES[list.kind] : ""}
              {list?.org && <span className="text-muted-foreground font-normal"> · {list.org}</span>}
              {!loading && <span className="text-muted-foreground font-normal"> ({items.length})</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6 space-y-1.5">
            {loading ? (
              <div className="py-8 flex justify-center"><Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Никого нет</p>
            ) : items.map((i) => (
              <div key={i.personnel_id} className="rounded-lg border border-border p-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{i.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[i.organization, STATUS_LABEL[i.status] || i.status].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[11px] truncate">
                    {i.room_number ? (
                      <span className="text-foreground">{i.building_name}, комн. {i.room_number}{i.temp_owner_name && <span className="text-mine-cyan"> — временно, место {i.temp_owner_name}</span>}</span>
                    ) : (
                      <span className="text-mine-amber">без комнаты</span>
                    )}
                  </p>
                </div>
                {canHouse && (!i.room_number || i.temp_owner_name) && i.status !== "departed" && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 shrink-0 border-mine-amber/40 text-mine-amber hover:bg-mine-amber/10 hover:text-mine-amber" onClick={() => setSuggest({ personnel_id: i.personnel_id, full_name: i.full_name })}>
                    <Icon name="Sparkles" size={12} />
                    Подобрать
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <RoomSuggestDialog
        person={suggest}
        onClose={() => setSuggest(null)}
        onAssigned={() => {
          onChanged();
          if (list) open(list.kind, list.org);
        }}
      />
    </div>
  );
}

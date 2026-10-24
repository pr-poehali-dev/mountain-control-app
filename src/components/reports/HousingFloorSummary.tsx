export interface HousingFloorRow {
  building: string;
  floor: number;
  rooms_count: number;
  capacity: number;
  occupied: number;
  free: number;
  status: "full" | "almost_full" | "free";
}

const STATUS: Record<HousingFloorRow["status"], { label: string; bg: string; color: string }> = {
  full: { label: "Заполнен", bg: "rgba(239,68,68,0.14)", color: "#dc2626" },
  almost_full: { label: "Почти занят", bg: "rgba(245,158,11,0.14)", color: "#d97706" },
  free: { label: "Есть места", bg: "transparent", color: "#16a34a" },
};

export default function HousingFloorSummary({ rows }: { rows: HousingFloorRow[] }) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold mb-2">Сводка по этажам</h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Корпус</th>
              <th className="px-3 py-2 font-medium">Этаж</th>
              <th className="px-3 py-2 font-medium">Комнат</th>
              <th className="px-3 py-2 font-medium">Мест</th>
              <th className="px-3 py-2 font-medium">Заселено</th>
              <th className="px-3 py-2 font-medium">Свободно</th>
              <th className="px-3 py-2 font-medium">Состояние</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = STATUS[r.status] || STATUS.free;
              return (
                <tr key={`${r.building}-${r.floor}`} className="border-t border-border" style={{ background: st.bg }}>
                  <td className="px-3 py-2">{r.building}</td>
                  <td className="px-3 py-2">{r.floor > 0 ? `${r.floor} этаж` : "Без этажа"}</td>
                  <td className="px-3 py-2">{r.rooms_count}</td>
                  <td className="px-3 py-2">{r.capacity}</td>
                  <td className="px-3 py-2">{r.occupied}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: st.color }}>{r.free}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: st.color }}>{st.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

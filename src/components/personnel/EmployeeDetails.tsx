import Icon from "@/components/ui/icon";

export interface PassInfo {
  number: string;
  permanent: boolean;
  valid_from: string;
  valid_to: string;
  state: "none" | "active" | "expired" | "future";
  inspection?: string;
  vehicle_number?: string;
  vehicle_brand?: string;
}

export interface EmployeeFull {
  full_name: string;
  position?: string;
  department?: string;
  organization?: string;
  organization_type?: string;
  category?: string;
  status?: string;
  medical_status?: string;
  shift?: string;
  phone?: string;
  tab_number?: string;
  housing?: {
    building: string;
    building_number: string;
    room: string;
    floor: number | null;
    room_name: string;
    residence: string;
  };
  personal_pass?: PassInfo;
  vehicle_pass?: PassInfo;
}

function fmt(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function period(p: PassInfo) {
  if (p.permanent) return "Бессрочно";
  if (p.valid_from && p.valid_to) return `с ${fmt(p.valid_from)} по ${fmt(p.valid_to)}`;
  if (p.valid_from) return `с ${fmt(p.valid_from)}`;
  if (p.valid_to) return `по ${fmt(p.valid_to)}`;
  return "Срок не указан";
}

const stateView: Record<PassInfo["state"], { text: string; cls: string }> = {
  active: { text: "Действует", cls: "bg-mine-green/15 text-mine-green border-mine-green/30" },
  expired: { text: "Истёк", cls: "bg-mine-red/15 text-mine-red border-mine-red/30" },
  future: { text: "Ещё не начал действовать", cls: "bg-mine-amber/15 text-mine-amber border-mine-amber/30" },
  none: { text: "Нет пропуска", cls: "bg-secondary text-muted-foreground border-border" },
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-words">{value || value === 0 ? value : "—"}</span>
    </div>
  );
}

function Section({ icon, color, title, children, badge }: { icon: string; color: string; title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Icon name={icon} size={16} className={color} />
          {title}
        </h4>
        {badge}
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

function StateBadge({ state }: { state: PassInfo["state"] }) {
  const v = stateView[state] || stateView.none;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${v.cls}`}>{v.text}</span>;
}

export default function EmployeeDetails({ person, compact = false }: { person: EmployeeFull; compact?: boolean }) {
  const h = person.housing;
  const pp = person.personal_pass;
  const vp = person.vehicle_pass;
  const building = h?.building ? `${h.building}${h.building_number ? ` (№ ${h.building_number})` : ""}` : h?.residence;

  return (
    <div className={`grid grid-cols-1 ${compact ? "" : "md:grid-cols-2"} gap-3`}>
      <Section icon="Briefcase" color="text-mine-cyan" title="Работа">
        <Row label="Должность" value={person.position} />
        <Row label="Подразделение" value={person.department} />
        <Row label="Организация" value={person.organization} />
        <Row label="Тип организации" value={person.organization_type} />
        <Row label="Категория" value={person.category} />
        <Row label="Табельный №" value={person.tab_number} />
        <Row label="Статус" value={person.status} />
        <Row label="Смена" value={person.shift && person.shift !== "—" ? `Смена ${person.shift === "A" ? "А" : person.shift === "B" ? "Б" : person.shift}` : ""} />
        <Row label="Медосмотр" value={person.medical_status} />
        <Row label="Телефон" value={person.phone} />
      </Section>

      <Section icon="Home" color="text-mine-amber" title="Проживание">
        <Row label="Общежитие" value={building} />
        <Row label="Этаж" value={h?.floor ?? ""} />
        <Row label="Комната" value={h?.room ? `${h.room}${h.room_name ? ` — ${h.room_name}` : ""}` : ""} />
      </Section>

      {pp && (
        <Section icon="CreditCard" color="text-mine-green" title="Личный пропуск" badge={<StateBadge state={pp.state} />}>
          <Row label="Номер" value={pp.number} />
          <Row label="Срок действия" value={pp.state === "none" ? "" : period(pp)} />
          <Row label="Досмотр" value={pp.inspection} />
        </Section>
      )}

      {vp && (
        <Section icon="Car" color="text-primary" title="Пропуск на автомобиль" badge={<StateBadge state={vp.state} />}>
          <Row label="Номер пропуска" value={vp.number} />
          <Row label="Госномер" value={vp.vehicle_number} />
          <Row label="Марка, модель" value={vp.vehicle_brand} />
          <Row label="Срок действия" value={vp.state === "none" ? "" : period(vp)} />
        </Section>
      )}
    </div>
  );
}

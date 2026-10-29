export interface CrewSummary {
  id: number;
  name: string;
  offset_days: number;
  on_site: boolean;
  day_no: number;
  period_days: number;
  next_change: string;
  next_direction: "in" | "out";
  days_to_change: number;
  members_count: number;
  present_count: number;
}

export interface Gap {
  position: string;
  need: number;
  have: number;
  date_from: string;
  date_to: string;
}

export interface DeptCard {
  id: number;
  name: string;
  code: string;
  color: string;
  head_name: string;
  on_days: number;
  off_days: number;
  scheme: "full" | "staggered";
  crews: CrewSummary[];
  members_total: number;
  on_site: number;
  unassigned: number;
  next_change: string | null;
  days_to_change: number | null;
  gaps: Gap[];
  gaps_count: number;
  norms_count: number;
}

export interface Alert {
  level: "red" | "amber";
  department_id: number;
  kind: string;
  text: string;
  date?: string;
}

export interface Upcoming {
  date: string;
  department_id: number;
  department: string;
  color: string;
  days_left: number;
  issues: number;
  done: number;
  total: number;
  in_count: number;
  out_count: number;
}

export interface Overview {
  today: string;
  totals: { departments: number; people: number; on_site: number; unassigned: number; gaps: number; changes_30: number };
  departments: DeptCard[];
  alerts: Alert[];
  upcoming: Upcoming[];
}

export interface Issue {
  code: string;
  text: string;
}

export interface MovePerson {
  id: number;
  full_name: string;
  position: string;
  is_key: boolean;
  phone: string;
  status: string;
  transport: string;
  notes: string;
  issues: Issue[];
  exception: string;
  overdue: boolean;
  residence: string;
}

export interface ChangeGroup {
  crew_id: number;
  crew: string;
  people: MovePerson[];
}

export interface Change {
  date: string;
  department_id: number;
  department: string;
  color: string;
  days_left: number;
  in: ChangeGroup[];
  out: ChangeGroup[];
  issues: number;
  done: number;
  total: number;
}

export const DEPT_COLORS: Record<string, { bg: string; text: string; bar: string; border: string }> = {
  amber: { bg: "bg-mine-amber/15", text: "text-mine-amber", bar: "bg-mine-amber", border: "border-mine-amber/40" },
  cyan: { bg: "bg-mine-cyan/15", text: "text-mine-cyan", bar: "bg-mine-cyan", border: "border-mine-cyan/40" },
  green: { bg: "bg-mine-green/15", text: "text-mine-green", bar: "bg-mine-green", border: "border-mine-green/40" },
  purple: { bg: "bg-mine-purple/15", text: "text-mine-purple", bar: "bg-mine-purple", border: "border-mine-purple/40" },
  red: { bg: "bg-mine-red/15", text: "text-mine-red", bar: "bg-mine-red", border: "border-mine-red/40" },
};

export const colorOf = (c: string) => DEPT_COLORS[c] || DEPT_COLORS.amber;

export const MOVE_STATUS: Record<string, { label: string; cls: string }> = {
  planned: { label: "Запланирован", cls: "bg-muted text-muted-foreground border-border" },
  confirmed: { label: "Подтверждён", cls: "bg-mine-cyan/15 text-mine-cyan border-mine-cyan/30" },
  tickets: { label: "Билеты куплены", cls: "bg-mine-purple/15 text-mine-purple border-mine-purple/30" },
  arrived: { label: "Прибыл", cls: "bg-mine-green/15 text-mine-green border-mine-green/30" },
  departed: { label: "Выехал", cls: "bg-mine-green/15 text-mine-green border-mine-green/30" },
  no_show: { label: "Не явился", cls: "bg-mine-red/15 text-mine-red border-mine-red/30" },
  cancelled: { label: "Отменён", cls: "bg-muted text-muted-foreground border-border line-through" },
};

export const EXC_KINDS: { value: string; label: string }[] = [
  { value: "vacation", label: "Отпуск" },
  { value: "sick", label: "Больничный" },
  { value: "training", label: "Обучение" },
  { value: "business_trip", label: "Командировка" },
  { value: "dismissal", label: "Увольнение" },
  { value: "other", label: "Другое" },
];

export const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join(".") : "—");
export const fmtShort = (d?: string | null) => (d ? d.slice(5, 10).split("-").reverse().join(".") : "—");

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 10;
  const b = Math.abs(n) % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

export function daysLabel(n: number) {
  if (n === 0) return "сегодня";
  if (n === 1) return "завтра";
  if (n < 0) return `${Math.abs(n)} ${plural(n, "день", "дня", "дней")} назад`;
  return `через ${n} ${plural(n, "день", "дня", "дней")}`;
}

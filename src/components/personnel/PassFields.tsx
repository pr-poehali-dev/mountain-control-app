import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PassValue {
  pass_number: string;
  pass_permanent: boolean;
  pass_valid_from: string;
  pass_valid_to: string;
  inspection_mode: string;
}

export const EMPTY_PASS: PassValue = {
  pass_number: "",
  pass_permanent: false,
  pass_valid_from: "",
  pass_valid_to: "",
  inspection_mode: "general",
};

export const inspectionLabels: Record<string, string> = {
  general: "Досмотр на общих основаниях",
  none: "Без досмотра",
};

function fmt(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export function passPeriodLabel(p: Partial<PassValue>): string {
  if (p.pass_permanent) return "Постоянно";
  if (p.pass_valid_from && p.pass_valid_to) return `с ${fmt(p.pass_valid_from)} по ${fmt(p.pass_valid_to)}`;
  if (p.pass_valid_from) return `с ${fmt(p.pass_valid_from)}`;
  if (p.pass_valid_to) return `по ${fmt(p.pass_valid_to)}`;
  return "Не указано";
}

export function isPassExpired(p: Partial<PassValue>): boolean {
  if (p.pass_permanent || !p.pass_valid_to) return false;
  return p.pass_valid_to < new Date().toISOString().slice(0, 10);
}

interface PassFieldsProps {
  value: PassValue;
  onChange: (value: PassValue) => void;
}

export default function PassFields({ value, onChange }: PassFieldsProps) {
  const set = (patch: Partial<PassValue>) => onChange({ ...value, ...patch });
  const invalid = !value.pass_permanent && value.pass_valid_from && value.pass_valid_to && value.pass_valid_from > value.pass_valid_to;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">№ пропуска</label>
          <Input
            value={value.pass_number}
            onChange={(e) => set({ pass_number: e.target.value })}
            placeholder="000123"
            className="bg-secondary/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Досмотр</label>
          <Select value={value.inspection_mode} onValueChange={(v) => set({ inspection_mode: v })}>
            <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">{inspectionLabels.general}</SelectItem>
              <SelectItem value="none">{inspectionLabels.none}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">Действие пропуска</label>
          <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={value.pass_permanent}
              onChange={(e) => set({ pass_permanent: e.target.checked })}
              className="w-4 h-4 accent-mine-cyan cursor-pointer"
            />
            Постоянно
          </label>
        </div>
        {value.pass_permanent ? (
          <p className="text-xs text-mine-green rounded-md bg-mine-green/10 px-3 py-2">Пропуск действует бессрочно</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-muted-foreground">Начало</span>
              <Input
                type="date"
                value={value.pass_valid_from}
                onChange={(e) => set({ pass_valid_from: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Окончание</span>
              <Input
                type="date"
                value={value.pass_valid_to}
                min={value.pass_valid_from || undefined}
                onChange={(e) => set({ pass_valid_to: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
          </div>
        )}
        {invalid && <p className="text-[11px] text-mine-red mt-1">Дата окончания раньше даты начала</p>}
      </div>
    </div>
  );
}

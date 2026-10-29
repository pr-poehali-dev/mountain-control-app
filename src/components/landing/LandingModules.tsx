import Icon from "@/components/ui/icon";
import Section from "./Section";
import { MODULES } from "./data";

const COLORS: Record<string, string> = {
  amber: "bg-mine-amber/15 text-mine-amber",
  cyan: "bg-mine-cyan/15 text-mine-cyan",
  green: "bg-mine-green/15 text-mine-green",
  red: "bg-mine-red/15 text-mine-red",
  purple: "bg-mine-purple/15 text-mine-purple",
};

const LandingModules = () => (
  <Section id="modules" eyebrow="Разделы системы" title="12 рабочих мест — для каждой службы" lead="У каждой службы свой раздел и свои права доступа. Администратор сам решает, кто что видит." className="bg-secondary/30">
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MODULES.map((m) => (
        <div key={m.title} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${COLORS[m.color]}`}>
              <Icon name={m.icon} size={20} />
            </div>
            <p className="font-semibold text-foreground">{m.title}</p>
          </div>
          <ul className="mt-4 space-y-2">
            {m.items.map((it) => (
              <li key={it} className="flex gap-2 text-sm text-muted-foreground">
                <Icon name="Check" size={16} className="text-mine-green shrink-0 mt-0.5" />
                {it}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </Section>
);

export default LandingModules;

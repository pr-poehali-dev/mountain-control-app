import Icon from "@/components/ui/icon";
import { setTheme, useTheme } from "@/components/theme/ThemeToggle";

const OPTIONS = [
  { value: "light" as const, icon: "Sun", label: "Светлая" },
  { value: "dark" as const, icon: "Moon", label: "Тёмная" },
];

const ThemeSwitch = ({ compact = false }: { compact?: boolean }) => {
  const { theme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Тема оформления" className="inline-flex items-center rounded-full border border-border bg-card/70 backdrop-blur p-0.5">
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${o.label} тема`}
            onClick={() => setTheme(o.value)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name={o.icon} size={14} />
            {!compact && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSwitch;

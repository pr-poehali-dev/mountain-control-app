import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

type Theme = "dark" | "light";
const KEY = "mc_theme";
const EVENT = "mc-theme-change";

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const [theme, setState] = useState<Theme>(readTheme);
  useEffect(() => {
    const sync = () => setState(readTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === "dark" || e.newValue === "light")) {
        document.documentElement.classList.toggle("dark", e.newValue === "dark");
        sync();
      }
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

interface Props {
  className?: string;
  floating?: boolean;
}

export default function ThemeToggle({ className = "", floating = false }: Props) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Включить светлую тему" : "Включить тёмную тему";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`${
        floating ? "fixed top-4 right-4 z-50 shadow-md bg-card border border-border" : "relative"
      } p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground ${className}`}
    >
      <Icon name={isDark ? "Sun" : "Moon"} size={20} />
    </button>
  );
}

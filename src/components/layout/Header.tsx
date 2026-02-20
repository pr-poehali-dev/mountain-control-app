import Icon from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  operator: "Оператор",
  medic: "Медик",
  dispatcher: "Диспетчер",
  worker: "Сотрудник",
};

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();

  const displayName = user?.full_name || user?.email || "Оператор";
  const displayRole = user?.role ? (roleLabels[user.role] || user.role) : "Смена А";

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mine-green/10 border border-mine-green/20">
          <span className="w-2 h-2 rounded-full bg-mine-green animate-pulse-glow" />
          <span className="text-xs text-mine-green font-medium">
            Система активна
          </span>
        </div>

        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Icon name="Bell" size={20} className="text-muted-foreground" />
          <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center bg-mine-red text-white text-[10px] p-0">
            3
          </Badge>
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Icon name="User" size={16} className="text-primary" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">
              {displayRole}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { useControlPoints, pointPath } from "@/hooks/use-control-points";

const navItems = [
  { path: "/", page: "dashboard", icon: "LayoutDashboard", label: "Дашборд" },
  { path: "/personnel", page: "personnel", icon: "Users", label: "Персонал" },
  { path: "/dispatcher", page: "dispatcher", icon: "Radio", label: "Диспетчерская" },
  { path: "/medical", page: "medical", icon: "HeartPulse", label: "Медконтроль" },
  { path: "/lampa", page: "lampa", icon: "Lightbulb", label: "Ламповая" },
  { path: "/scanner", page: "scanner", icon: "ScanLine", label: "Сканирование" },
  { path: "/security", page: "security", icon: "ShieldCheck", label: "СБ" },
  { path: "/checkpoint", page: "checkpoint", icon: "DoorOpen", label: "КПП" },
  { path: "/aho", page: "aho", icon: "Building2", label: "АХО" },
  { path: "/ohs", page: "ohs", icon: "HardHat", label: "ОТ и ПБ" },
  { path: "/reports", page: "reports", icon: "BarChart3", label: "Отчёты" },
  { path: "/rotation", page: "rotation", icon: "CalendarSync", label: "Перевахтовка", adminOnly: true },
  { path: "/profile", page: "profile", icon: "UserCircle", label: "Кабинет" },
  { path: "/admin", page: "admin", icon: "Shield", label: "Админ" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, allowedPages } = useAuth();
  const { points, extra } = useControlPoints(!!user);
  const mainPoint = points.find((p) => p.is_main);
  const { isDemo, exitDemo, isPreview } = useDemo();

  const handleLogout = () => {
    if (isDemo) {
      exitDemo();
      if (isPreview) return;
    } else {
      logout();
    }
    navigate("/login");
  };

  const pointItems = extra.map((p) => ({ path: pointPath(p), page: p.page_key, icon: p.icon || "DoorOpen", label: p.name, sub: true }));
  const allItems = navItems.flatMap((item) => {
    const base = item.page === "checkpoint" && mainPoint ? { ...item, label: mainPoint.name, icon: mainPoint.icon || item.icon } : item;
    return item.page === "checkpoint" ? [base, ...pointItems] : [base];
  });

  const visibleItems = allItems.filter((item) => {
    if ("adminOnly" in item && item.adminOnly) return user?.role === "admin" && !isDemo;
    if (!allowedPages.includes(item.page)) return false;
    if (isDemo && (item.page === "admin" || item.page === "profile")) return false;
    return true;
  });

  return (
    <aside
      className={`fixed left-0 h-screen bg-card border-r border-border flex flex-col z-40 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      } ${isDemo ? "top-10" : "top-0"}`}
    >
      <div className="flex items-center gap-3 p-4 border-b border-border min-h-[64px]">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Icon name="Mountain" size={18} className="text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-sm font-semibold text-foreground leading-tight">
              Горный контроль
            </h1>
            <p className="text-[10px] text-muted-foreground">v1.0 — Рудник</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon
                name={item.icon}
                size={20}
                className={isActive ? "text-primary" : ""}
              />
              {!collapsed && <span className="truncate text-left">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-mine-red hover:bg-mine-red/10 transition-all text-sm"
        >
          <Icon name="LogOut" size={18} />
          {!collapsed && <span>Выйти</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all text-sm"
        >
          <Icon
            name={collapsed ? "ChevronRight" : "ChevronLeft"}
            size={18}
          />
          {!collapsed && <span>Свернуть</span>}
        </button>
      </div>
    </aside>
  );
}
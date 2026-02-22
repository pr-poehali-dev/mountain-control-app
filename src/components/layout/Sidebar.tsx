import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/", icon: "LayoutDashboard", label: "Дашборд", adminOnly: false },
  { path: "/personnel", icon: "Users", label: "Персонал", adminOnly: true },
  { path: "/dispatcher", icon: "Radio", label: "Диспетчерская", adminOnly: true },
  { path: "/medical", icon: "HeartPulse", label: "Медконтроль", adminOnly: true },
  { path: "/lampa", icon: "Lightbulb", label: "Ламповая", adminOnly: true },
  { path: "/scanner", icon: "ScanLine", label: "Сканирование", adminOnly: true },
  { path: "/aho", icon: "Building2", label: "АХО", adminOnly: true },
  { path: "/reports", icon: "BarChart3", label: "Отчёты", adminOnly: true },
  { path: "/profile", icon: "UserCircle", label: "Кабинет", adminOnly: false },
  { path: "/admin", icon: "Shield", label: "Админ", adminOnly: true },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
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
        {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
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
              {!collapsed && <span>{item.label}</span>}
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
import { useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";

const POLL_MS = 60000;

export default function PendingAccessBanner() {
  const { user, isPending, refreshUser } = useAuth();

  useEffect(() => {
    if (!user) return;
    const h = () => refreshUser().catch(() => {});
    window.addEventListener("mc-access-changed", h);
    if (!isPending) return () => window.removeEventListener("mc-access-changed", h);
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") h();
    }, POLL_MS);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("mc-access-changed", h);
    };
  }, [user, isPending, refreshUser]);

  useEffect(() => {
    if (user && !isPending && localStorage.getItem("mc_was_pending") === "true") {
      localStorage.removeItem("mc_was_pending");
      window.location.reload();
    }
    if (isPending) localStorage.setItem("mc_was_pending", "true");
  }, [user, isPending]);

  if (!user || !isPending) return null;

  return (
    <div className="mb-4 rounded-xl border border-mine-amber/40 bg-mine-amber/10 px-4 py-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-mine-amber/20 flex items-center justify-center shrink-0">
        <Icon name="Eye" size={18} className="text-mine-amber" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Режим просмотра — ожидается допуск администратора</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Вы можете знакомиться со всеми разделами, но сохранять изменения нельзя. Фамилии сотрудников, коды и контакты скрыты.
          Как только администратор откроет доступ, страница обновится сама.
        </p>
      </div>
    </div>
  );
}

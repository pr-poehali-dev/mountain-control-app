import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { ahoApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import LiveHousingStats, { type LiveStats } from "@/components/aho/LiveHousingStats";

const POLL_MS = 15000;

export default function LiveSiteSummary() {
  const { user, allowedPages } = useAuth();
  const canHouse = user?.role === "admin" || allowedPages.includes("aho");
  const [live, setLive] = useState<LiveStats | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await ahoApi.getStats();
      if (d.live) {
        setLive(d.live);
        setUpdatedAt(new Date());
        setFailed(false);
      }
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const h = () => load();
    window.addEventListener("housing-changed", h);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("housing-changed", h);
    };
  }, [load]);

  if (!live) {
    if (failed) return null;
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex justify-center">
        <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <LiveHousingStats
        live={live}
        updatedAt={updatedAt}
        onChanged={load}
        canHouse={canHouse}
        title="Сейчас на предприятии — люди и расселение"
        headerAction={canHouse ? (
          <Link to="/aho" className="text-xs text-primary hover:underline flex items-center gap-1">
            Расселение в АХО
            <Icon name="ArrowRight" size={12} />
          </Link>
        ) : undefined}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/dashboard/StatCard";
import PersonnelTable from "@/components/dashboard/PersonnelTable";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import ShiftOverview from "@/components/dashboard/ShiftOverview";
import LanternStatus from "@/components/dashboard/LanternStatus";
import Icon from "@/components/ui/icon";
import { eventsApi, personnelApi } from "@/lib/api";

interface DashboardData {
  on_site: number;
  lanterns_issued: number;
  lanterns_total: number;
  medical_passed_pct: number;
  medical_not_passed: number;
  housing_pct: number;
  housing_occupied: number;
  housing_total: number;
  by_category: Record<string, number>;
}

interface EventItem {
  id: number;
  type: string;
  description: string;
  created_at: string;
  person_name?: string;
  person_code?: string;
}

interface PersonnelItem {
  id?: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  status: string;
  medical_status?: string;
}

const Index = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [dashRes, eventsRes, personnelRes] = await Promise.all([
          eventsApi.getDashboard(),
          eventsApi.getEvents(10),
          personnelApi.getAll(),
        ]);
        setDashboard(dashRes);
        setEvents(eventsRes.events || []);
        setPersonnel(personnelRes.personnel || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Ошибка загрузки данных";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (error) {
    return (
      <AppLayout title="Дашборд" subtitle="Общая сводка по руднику">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Icon name="AlertTriangle" size={40} className="text-mine-red" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Попробовать снова
          </button>
        </div>
      </AppLayout>
    );
  }

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <AppLayout title="Дашборд" subtitle={`Общая сводка по руднику — ${today}`}>
      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="На объекте"
                value={dashboard?.on_site ?? 0}
                change={`категорий: ${Object.keys(dashboard?.by_category || {}).length}`}
                changeType="neutral"
                icon="Users"
                color="amber"
              />
              <StatCard
                title="Фонари выданы"
                value={dashboard?.lanterns_issued ?? 0}
                change={`из ${dashboard?.lanterns_total ?? 0} доступных`}
                changeType="neutral"
                icon="Flashlight"
                color="cyan"
              />
              <StatCard
                title="Медосмотр пройден"
                value={`${dashboard?.medical_passed_pct ?? 0}%`}
                change={`${dashboard?.medical_not_passed ?? 0} не прошли`}
                changeType={
                  (dashboard?.medical_not_passed ?? 0) > 0 ? "down" : "neutral"
                }
                icon="HeartPulse"
                color="green"
              />
              <StatCard
                title="Жилой фонд"
                value={`${dashboard?.housing_pct ?? 0}%`}
                change={`занято ${dashboard?.housing_occupied ?? 0} из ${dashboard?.housing_total ?? 0}`}
                changeType="neutral"
                icon="Home"
                color="red"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PersonnelTable data={personnel} loading={false} />
              </div>
              <div>
                <ActivityFeed events={events} loading={false} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ShiftOverview dashboard={dashboard || undefined} loading={false} />
              <LanternStatus dashboard={dashboard || undefined} loading={false} />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;

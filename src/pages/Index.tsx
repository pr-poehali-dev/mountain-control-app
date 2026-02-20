import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/dashboard/StatCard";
import PersonnelTable from "@/components/dashboard/PersonnelTable";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import ShiftOverview from "@/components/dashboard/ShiftOverview";
import LanternStatus from "@/components/dashboard/LanternStatus";

const Index = () => {
  return (
    <AppLayout title="Дашборд" subtitle="Общая сводка по руднику — 20.02.2026">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="На объекте"
            value={52}
            change="+5 за сегодня"
            changeType="up"
            icon="Users"
            color="amber"
          />
          <StatCard
            title="Фонари выданы"
            value={115}
            change="из 200 доступных"
            changeType="neutral"
            icon="Flashlight"
            color="cyan"
          />
          <StatCard
            title="Медосмотр пройден"
            value="94%"
            change="3 не прошли"
            changeType="down"
            icon="HeartPulse"
            color="green"
          />
          <StatCard
            title="Жилой фонд"
            value="78%"
            change="занято 156 из 200"
            changeType="neutral"
            icon="Home"
            color="red"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PersonnelTable />
          </div>
          <div>
            <ActivityFeed />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ShiftOverview />
          <LanternStatus />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;

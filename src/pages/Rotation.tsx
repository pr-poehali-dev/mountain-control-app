import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { rotationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import RotationOverview from "@/components/rotation/RotationOverview";
import RotationCalendar from "@/components/rotation/RotationCalendar";
import RotationChanges from "@/components/rotation/RotationChanges";
import RotationAbsences from "@/components/rotation/RotationAbsences";
import RotationGuide from "@/components/rotation/RotationGuide";
import RotationManual from "@/components/rotation/RotationManual";
import DeptDetail from "@/components/rotation/DeptDetail";
import DeptDialog, { type DeptForm } from "@/components/rotation/DeptDialog";
import type { Overview } from "@/components/rotation/types";

type Tab = "overview" | "changes" | "calendar" | "absences" | "guide";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Подразделения", icon: "LayoutGrid" },
  { id: "changes", label: "Перевахтовки", icon: "ArrowLeftRight" },
  { id: "calendar", label: "График вахт", icon: "GanttChart" },
  { id: "absences", label: "Отсутствия", icon: "UserX" },
  { id: "guide", label: "Методика", icon: "BookOpen" },
];

export default function Rotation() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; initial: DeptForm | null; departments: string[] }>({ open: false, initial: null, departments: [] });
  const [manual, setManual] = useState(false);
  const [focus, setFocus] = useState<{ date: string; deptId: number } | null>(null);

  const load = useCallback(() => {
    rotationApi
      .overview()
      .then(setData)
      .catch((e) => toast({ title: "Не удалось загрузить", description: e.message, variant: "destructive" }));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const departments = (data?.departments || []).map((d) => ({ id: d.id, name: d.name }));

  return (
    <AppLayout title="Перевахтовка" subtitle="Планирование вахт, графики заездов и выездов, контроль укомплектованности">
      <div className="space-y-6">
        <div className="flex items-center gap-2 rounded-lg border border-mine-amber/30 bg-mine-amber/5 px-3 py-2 text-xs text-mine-amber">
          <Icon name="EyeOff" size={14} />
          Раздел в настройке: виден только администратору и не показывается в демо-версии.
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setDeptId(null);
                if (t.id !== "changes") setFocus(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
                tab === t.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon name={t.icon} size={16} fallback="Circle" />
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setManual(true)} className="gap-1.5 text-foreground">
            <Icon name="BookOpenCheck" size={14} fallback="BookOpen" />
            Инструкция
          </Button>
          {tab === "overview" && !deptId && data && data.departments.length > 0 && (
            <Button size="sm" onClick={() => setDialog({ open: true, initial: null, departments: data?.personnel_departments || [] })} className="gap-1.5">
              <Icon name="Plus" size={14} />
              Подразделение
            </Button>
          )}
        </div>

        {!data ? (
          <div className="p-10 flex justify-center">
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {tab === "overview" &&
              (deptId ? (
                <DeptDetail
                  id={deptId}
                  onBack={() => setDeptId(null)}
                  onEdit={(d, deps) => setDialog({ open: true, initial: d, departments: deps })}
                  onChanged={load}
                />
              ) : (
                <RotationOverview
                  data={data}
                  onOpenDept={setDeptId}
                  onAddDept={() => setDialog({ open: true, initial: null, departments: data?.personnel_departments || [] })}
                  onOpenChange={(date, id) => {
                    setFocus({ date, deptId: id });
                    setTab("changes");
                  }}
                />
              ))}
            {tab === "changes" && <RotationChanges key={focus ? `${focus.date}-${focus.deptId}` : "all"} departments={departments} focus={focus} />}
            {tab === "calendar" && <RotationCalendar departments={departments} />}
            {tab === "absences" && <RotationAbsences onChanged={load} />}
            {tab === "guide" && <RotationGuide />}
          </>
        )}
      </div>

      <RotationManual open={manual} onOpenChange={setManual} />

      <DeptDialog
        open={dialog.open}
        initial={dialog.initial}
        departments={dialog.departments}
        onClose={() => setDialog({ ...dialog, open: false })}
        onSaved={(id) => {
          setDialog({ ...dialog, open: false });
          load();
          setTab("overview");
          setDeptId(id);
        }}
      />
    </AppLayout>
  );
}

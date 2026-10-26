import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import HousingFloorSummary, { type HousingFloorRow } from "@/components/reports/HousingFloorSummary";
import { reportsApi, eventsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useControlPoints } from "@/hooks/use-control-points";

interface ReportConfig {
  key: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  freq: string;
  action: string;
  pointId?: number | "all";
}

const REPORTS: ReportConfig[] = [
  { key: "attendance", title: "Посещаемость за смену", desc: "Кто прибыл / убыл, по категориям", icon: "Users", color: "amber", freq: "Ежедневно", action: "attendance" },
  { key: "medical", title: "Медосмотры", desc: "Пройденные, не пройденные, причины отстранения", icon: "HeartPulse", color: "green", freq: "Ежедневно", action: "medical" },
  { key: "equipment", title: "Выдача фонарей и СС", desc: "Статистика выдачи и возврата, состояние", icon: "Flashlight", color: "cyan", freq: "Ежедневно", action: "equipment" },
  { key: "housing", title: "Жилой фонд", desc: "Заселение, загрузка по комнатам и корпусам", icon: "Home", color: "red", freq: "Еженедельно", action: "housing" },
  { key: "personnel-summary", title: "Сводный по персоналу", desc: "Все категории: рудничные, подрядчики, гости", icon: "BarChart3", color: "amber", freq: "Еженедельно", action: "personnel-summary" },
  { key: "housing-history", title: "История проживания", desc: "Заселения, переселения и выселения за период", icon: "BedDouble", color: "green", freq: "По запросу", action: "housing-history" },
  { key: "events-log", title: "Журнал событий", desc: "Полный лог всех действий в системе", icon: "FileText", color: "cyan", freq: "По запросу", action: "events-log" },
];

const colorMap: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  amber: { bg: "bg-mine-amber/10", border: "border-mine-amber/20", icon: "text-mine-amber", text: "text-mine-amber" },
  cyan: { bg: "bg-mine-cyan/10", border: "border-mine-cyan/20", icon: "text-mine-cyan", text: "text-mine-cyan" },
  green: { bg: "bg-mine-green/10", border: "border-mine-green/20", icon: "text-mine-green", text: "text-mine-green" },
  red: { bg: "bg-mine-red/10", border: "border-mine-red/20", icon: "text-mine-red", text: "text-mine-red" },
};

const STATUS_LABELS: Record<string, string> = {
  passed: "Пройден", failed: "Не пройден", pending: "Ожидание",
  arrived: "На объекте", departed: "Убыл", on_shift: "На смене",
  day_off: "Выходной", sick_leave: "Больничный", vacation: "Отпуск",
  business_trip: "Командировка",
  issued: "Выдан", available: "Доступен", charging: "Зарядка", missing: "Утерян",
  normal: "Норма", damaged: "Повреждён", needs_repair: "Требует ремонта",
  active: "Активна", maintenance: "Обслуживание",
  mine: "Рудничный", office: "Офисный", contractor: "Подрядчик", guest: "Гость", gov: "Гос.органы",
  rudnik: "Рудник",
  full: "Заполнена", partial: "Частично", free: "Свободна", occupied: "Занята",
  almost_full: "Почти занят",
  day: "Дневная", night: "Ночная", to_shift: "На смену", from_shift: "Со смены",
  pre_shift: "Предсменный", post_shift: "Послесменный",
  checkin: "Заселение", move: "Переселение", evict: "Выселение",
  lantern: "Фонарь", rescuer: "Самоспасатель", both: "Фонарь и самоспасатель", returned: "Возвращён",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  checkin: "Вход", checkout: "Выход", check_in: "Вход", check_out: "Выход",
  checkpoint_in: "Вход через КПП", checkpoint_out: "Выход через КПП",
  checkpoint_denied: "Отказ на КПП", checkpoint_edit: "Исправление прохода", checkpoint_delete: "Удаление прохода",
  scan_checkin: "Отметка по QR", scan_denied: "Отказ при сканировании",
  medical_pass: "Медосмотр пройден", medical_deny: "Медосмотр не пройден", medical_fail: "Медосмотр не пройден",
  medical_reset: "Автосброс медосмотров", medical_change: "Изменение медстатуса",
  lantern_issued: "Выдача фонаря", lantern_returned: "Возврат фонаря",
  lamp_room_issue: "Выдача в ламповой", lamp_room_return: "Возврат в ламповую", lamp_room_denial: "Недопуск в ламповой",
  equipment_repair: "Оборудование в ремонт", equipment_repair_return: "Возврат из ремонта", equipment_decommission: "Списание оборудования",
  status_change: "Смена статуса", person_added: "Добавлен сотрудник", person_edited: "Редактирование сотрудника",
  edit: "Редактирование", arrival: "Заезд", housing: "Расселение", aho_upload: "Загрузка списка АХО",
  security_check: "Проверка СБ", security_check_failed: "Проверка СБ не пройдена", valid: "Проверка пройдена",
  system_reset: "Сброс системы",
  point_in: "Вход на объект", point_out: "Выход с объекта", control_point: "Настройка объектов контроля",
  vehicle_in: "Въезд автомобиля", vehicle_out: "Выезд автомобиля", vehicle_denied: "Отказ во въезде",
};

function eventLabel(val: string) {
  return EVENT_TYPE_LABELS[val] || val || "—";
}

function label(val: string) {
  return STATUS_LABELS[val] || val || "—";
}

function formatDate(s: string) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ru-RU");
  } catch { return s; }
}

function formatDateTime(s: string) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const Reports = () => {
  const [active, setActive] = useState<string | null>(null);
  const [passDirection, setPassDirection] = useState("all");
  const [passResult, setPassResult] = useState("all");
  const [passQuery, setPassQuery] = useState("");
  const { points, loaded: pointsLoaded } = useControlPoints();
  const pointReports: ReportConfig[] = [
    ...points.map((p) => ({
      key: `point-${p.id}`,
      title: `Проходы: ${p.name}`,
      desc: p.description || (p.is_main || p.settings.counts_territory ? "Вход и выход с территории, отказы, кто проходил" : "Вход и выход на объект, отказы, кто проходил"),
      icon: p.icon || "DoorOpen",
      color: p.is_main ? "amber" : "cyan",
      freq: "Ежедневно",
      action: "point-passes",
      pointId: p.id,
    })),
    ...(points.length > 1 ? [{
      key: "point-all", title: "Проходы: все объекты", desc: "Сводный журнал по всем пунктам контроля одной таблицей",
      icon: "MapPinned", color: "green", freq: "По запросу", action: "point-passes", pointId: "all" as const,
    }] : []),
  ];
  const allReports = [...pointReports, ...REPORTS];
  const isPointReport = !!active?.startsWith("point-");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [shiftType, setShiftType] = useState("all");
  const [direction, setDirection] = useState("all");
  const [housingAction, setHousingAction] = useState("all");
  const [housingQuery, setHousingQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<{ items: Record<string, unknown>[]; summary: Record<string, unknown> } | null>(null);
  const [error, setError] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const isAdminUser = authUser?.role === "admin" && localStorage.getItem("mc_demo") !== "true";
  const [editEventId, setEditEventId] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState("");
  const [busyEventId, setBusyEventId] = useState<number | null>(null);

  const saveEventEdit = async (id: number) => {
    const text = eventDraft.trim();
    if (!text) return;
    setBusyEventId(id);
    try {
      await eventsApi.editEvent(id, text);
      setReportData(prev => prev ? { ...prev, items: prev.items.map(it => it.id === id ? { ...it, description: text } : it) } : prev);
      setEditEventId(null);
    } catch (err) {
      toast({ title: "Не удалось сохранить", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyEventId(null);
    }
  };

  const hideEventRow = async (id: number) => {
    if (!confirm("Убрать это событие из журнала, ленты и отчётов?")) return;
    setBusyEventId(id);
    try {
      await eventsApi.hideEvent(id);
      setReportData(prev => {
        if (!prev) return prev;
        const total = Number(prev.summary.total) || 0;
        return { items: prev.items.filter(it => it.id !== id), summary: { ...prev.summary, total: Math.max(0, total - 1) } };
      });
    } catch (err) {
      toast({ title: "Не удалось убрать событие", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyEventId(null);
    }
  };

  const activeReport = allReports.find(r => r.key === active);

  useEffect(() => {
    if (active && isPointReport && pointsLoaded && !activeReport) {
      setActive(null);
      setReportData(null);
      toast({ title: "Объект контроля удалён", description: "Отчёт по нему больше недоступен" });
    }
  }, [active, isPointReport, pointsLoaded, activeReport, toast]);

  useEffect(() => {
    if (active && activeReport) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const buildParams = () => {
    const p: Record<string, string> = {};
    if (active !== "housing" && active !== "personnel-summary") {
      p.date_from = dateFrom;
      p.date_to = dateTo;
    }
    if (shiftType !== "all" && (active === "attendance" || active === "medical")) {
      p.shift_type = shiftType;
    }
    if (direction !== "all" && active === "medical") {
      p.direction = direction;
    }
    if (active === "housing-history") {
      if (housingAction !== "all") p.housing_action = housingAction;
      if (housingQuery.trim()) p.q = housingQuery.trim();
    }
    if (activeReport?.pointId !== undefined) {
      p.control_point_id = String(activeReport.pointId);
      if (passDirection !== "all") p.direction = passDirection;
      if (passResult !== "all") p.result = passResult;
      if (passQuery.trim()) p.q = passQuery.trim();
    }
    return p;
  };

  const loadReport = async () => {
    if (!active || !activeReport) return;
    setLoading(true);
    setError("");
    try {
      const data = await reportsApi.getReport(activeReport.action, buildParams());
      setReportData({ items: data.items || [], summary: data.summary || {} });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки отчёта");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!active || !activeReport) return;
    const url = reportsApi.getExportUrl(activeReport.action, buildParams());
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    if (!tableRef.current || !activeReport) return;
    const html = tableRef.current.innerHTML;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activeReport.title}</title>
<style>body{font-family:Arial,sans-serif;padding:20px;color:#222}
h2{margin-bottom:4px}p.sub{color:#666;margin-bottom:16px;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#f0f0f0;font-weight:600}
.summary{margin-bottom:16px;display:flex;gap:24px;flex-wrap:wrap}
.summary-item{background:#f8f8f8;padding:8px 16px;border-radius:6px}
.summary-item .val{font-size:20px;font-weight:700}
.summary-item .lbl{font-size:11px;color:#666}
.no-print{display:none}
@media print{body{padding:0}}
</style></head><body>
<h2>${activeReport.title}</h2>
<p class="sub">${dateFrom !== dateTo ? formatDate(dateFrom) + " — " + formatDate(dateTo) : formatDate(dateFrom)}</p>
${html}
<${"/"}>body><${"/"}>html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  };

  const renderSummary = () => {
    if (!reportData?.summary || !active) return null;
    const s = reportData.summary;

    const cards: { label: string; value: string | number; color?: string }[] = [];

    if (active === "attendance") {
      cards.push(
        { label: "Всего персонала", value: (s.total_personnel as number) || 0 },
        { label: "Прибыло", value: (s.total_arrived as number) || 0, color: "text-mine-green" },
        { label: "Посещаемость", value: `${(s.attendance_pct as number) || 0}%`, color: "text-mine-cyan" },
      );
      const byCat = (s.by_category as Record<string, number>) || {};
      Object.entries(byCat).forEach(([k, v]) => {
        cards.push({ label: label(k), value: v });
      });
    } else if (active === "medical") {
      cards.push(
        { label: "Всего осмотров", value: (s.total as number) || 0 },
        { label: "Пройден", value: (s.passed as number) || 0, color: "text-mine-green" },
        { label: "Не пройден", value: (s.failed as number) || 0, color: "text-mine-red" },
        { label: "Ожидание", value: (s.pending as number) || 0 },
        { label: "% прохождения", value: `${(s.pass_rate as number) || 0}%`, color: "text-mine-cyan" },
      );
    } else if (active === "equipment") {
      cards.push(
        { label: "Всего", value: (s.total as number) || 0 },
        { label: "Выдано", value: (s.issued as number) || 0, color: "text-mine-amber" },
        { label: "Доступно", value: (s.available as number) || 0, color: "text-mine-green" },
        { label: "Зарядка", value: (s.charging as number) || 0, color: "text-mine-cyan" },
        { label: "Утеряно", value: (s.missing as number) || 0, color: "text-mine-red" },
        { label: "Выдач за период", value: (s.issues_in_period as number) || 0 },
        { label: "Возвратов за период", value: (s.returns_in_period as number) || 0 },
      );
    } else if (active === "housing") {
      cards.push(
        { label: "Вместимость", value: (s.total_capacity as number) || 0 },
        { label: "Заселено", value: (s.total_occupied as number) || 0, color: "text-mine-amber" },
        { label: "Свободно", value: (s.total_free as number) || 0, color: "text-mine-green" },
        { label: "Загрузка", value: `${(s.occupancy_pct as number) || 0}%`, color: "text-mine-cyan" },
      );
    } else if (active === "housing-history") {
      cards.push(
        { label: "Всего записей", value: (s.total as number) || 0 },
        { label: "Заселений", value: (s.checkin as number) || 0, color: "text-mine-green" },
        { label: "Переселений", value: (s.move as number) || 0, color: "text-mine-cyan" },
        { label: "Выселений", value: (s.evict as number) || 0, color: "text-mine-red" },
        { label: "Сотрудников", value: (s.people as number) || 0 },
      );
    } else if (active === "personnel-summary") {
      cards.push({ label: "Всего", value: (s.total as number) || 0 });
      const bySt = (s.by_status as Record<string, number>) || {};
      Object.entries(bySt).forEach(([k, v]) => {
        cards.push({ label: label(k), value: v });
      });
    } else if (isPointReport) {
      cards.push(
        { label: "Всего проходов", value: (s.total as number) || 0 },
        { label: "Входов", value: (s.entries as number) || 0, color: "text-mine-green" },
        { label: "Выходов", value: (s.exits as number) || 0, color: "text-mine-amber" },
        { label: "Отказов", value: (s.denied as number) || 0, color: (s.denied as number) ? "text-mine-red" : undefined },
        { label: "Человек", value: (s.people as number) || 0, color: "text-mine-cyan" },
      );
      ((s.by_point as { name: string; count: number }[]) || []).forEach((b) => cards.push({ label: b.name, value: b.count }));
    } else if (active === "events-log") {
      cards.push({ label: "Всего событий", value: (s.total as number) || 0 });
      const byType = (s.by_type as { type: string; count: number }[]) || [];
      byType.slice(0, 5).forEach((t) => {
        cards.push({ label: eventLabel(t.type), value: t.count });
      });
    }

    const byFloor = active === "housing" ? ((s.by_floor as HousingFloorRow[]) || []) : [];

    return (
      <>
        <div className="summary flex flex-wrap gap-3 mb-4">
          {cards.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-secondary/30 px-4 py-2 min-w-[120px]">
              <div className={`text-xl font-bold ${c.color || "text-foreground"}`}>{c.value}</div>
              <div className="text-[11px] text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
        {byFloor.length > 0 && <HousingFloorSummary rows={byFloor} />}
      </>
    );
  };

  type TableCol = { key: string; label: string; noPrint?: boolean; render?: (v: unknown, row: Record<string, unknown>) => React.ReactNode };

  const getColumns = (): TableCol[] => {
    if (isPointReport) return [
      { key: "created_at", label: "Дата/Время", render: v => formatDateTime(v as string) },
      ...(activeReport?.pointId === "all" ? [{ key: "point_name", label: "Объект" }] : []),
      { key: "full_name", label: "ФИО" },
      { key: "tab_number", label: "Таб. №", render: v => (v as string) || "—" },
      { key: "personal_code", label: "Код" },
      { key: "organization", label: "Организация", render: v => (v as string) || "—" },
      { key: "position", label: "Должность", render: v => (v as string) || "—" },
      { key: "direction_label", label: "Направление", render: (v, row) => (
        <span className={row.direction === "in" ? "text-mine-green" : "text-mine-amber"}>{String(v)}</span>
      )},
      { key: "result_label", label: "Результат", render: (v, row) => (
        <span className={row.result === "denied" ? "text-mine-red font-medium" : "text-mine-green"}>{String(v)}</span>
      )},
      { key: "reason", label: "Причина / примечание", render: v => (v as string) || "—" },
      { key: "medical_label", label: "Медосмотр" },
    ];
    if (active === "attendance") return [
      { key: "full_name", label: "ФИО" },
      { key: "personal_code", label: "Код" },
      { key: "department", label: "Подразделение" },
      { key: "category", label: "Категория", render: v => label(v as string) },
      { key: "organization", label: "Организация" },
      { key: "status", label: "Статус", render: v => label(v as string) },
      { key: "medical_status", label: "Медосмотр", render: v => (
        <span className={v === "passed" ? "text-mine-green" : v === "failed" ? "text-mine-red" : "text-mine-amber"}>
          {label(v as string)}
        </span>
      )},
      { key: "check_in_count", label: "Явок" },
      { key: "check_out_count", label: "Уходов" },
    ];
    if (active === "medical") return [
      { key: "full_name", label: "ФИО" },
      { key: "personal_code", label: "Код" },
      { key: "department", label: "Подразделение" },
      { key: "status", label: "Результат", render: v => (
        <span className={v === "passed" ? "text-mine-green" : v === "failed" ? "text-mine-red" : "text-mine-amber"}>
          {label(v as string)}
        </span>
      )},
      { key: "shift_label", label: "Смена" },
      { key: "direction_label", label: "Направление" },
      { key: "shift_date", label: "Дата", render: v => formatDate(v as string) },
      { key: "blood_pressure", label: "Давление" },
      { key: "pulse", label: "Пульс" },
      { key: "temperature", label: "Темп." },
      { key: "alcohol_level", label: "Алк." },
      { key: "notes", label: "Примечание" },
      { key: "checked_at", label: "Время", render: v => formatDateTime(v as string) },
    ];
    if (active === "equipment") return [
      { key: "lantern_number", label: "Фонарь" },
      { key: "rescuer_number", label: "Самоспасатель" },
      { key: "status", label: "Статус", render: v => (
        <span className={v === "issued" ? "text-mine-amber" : v === "available" ? "text-mine-green" : v === "missing" ? "text-mine-red" : "text-mine-cyan"}>
          {label(v as string)}
        </span>
      )},
      { key: "condition", label: "Состояние", render: v => label(v as string) },
      { key: "person_name", label: "Сотрудник" },
      { key: "person_code", label: "Код" },
      { key: "department", label: "Подразделение" },
      { key: "issued_at", label: "Выдан", render: v => formatDateTime(v as string) },
      { key: "returned_at", label: "Возврат", render: v => formatDateTime(v as string) },
    ];
    if (active === "housing") return [
      { key: "room_number", label: "Комната" },
      { key: "room_name", label: "Название", render: v => (v as string) || "—" },
      { key: "building", label: "Корпус" },
      { key: "floor", label: "Этаж", render: v => ((v as number) > 0 ? String(v) : "—") },
      { key: "capacity", label: "Вместимость" },
      { key: "occupied", label: "Заселено" },
      { key: "free", label: "Свободно", render: (v) => (
        <span className={(v as number) > 0 ? "text-mine-green" : "text-muted-foreground"}>{String(v)}</span>
      )},
      { key: "status", label: "Статус", render: v => label(v as string) },
    ];
    if (active === "housing-history") return [
      { key: "created_at", label: "Дата/Время", render: v => formatDateTime(v as string) },
      { key: "action_label", label: "Действие", render: (v, row) => (
        <span className={row.action === "checkin" ? "text-mine-green" : row.action === "evict" ? "text-mine-red" : "text-mine-cyan"}>{String(v)}</span>
      )},
      { key: "full_name", label: "ФИО" },
      { key: "personal_code", label: "Код" },
      { key: "organization", label: "Организация" },
      { key: "place", label: "Общежитие / комната" },
      { key: "prev_place", label: "Откуда переселён", render: v => (v as string) || "—" },
      { key: "source", label: "Где оформлено" },
    ];
    if (active === "personnel-summary") return [
      { key: "personal_code", label: "Код" },
      { key: "full_name", label: "ФИО" },
      { key: "position", label: "Должность" },
      { key: "department", label: "Подразделение" },
      { key: "category_label", label: "Категория" },
      { key: "organization", label: "Организация" },
      { key: "org_type_label", label: "Тип орг." },
      { key: "status_label", label: "Статус" },
      { key: "medical_status", label: "Медосмотр", render: v => (
        <span className={v === "passed" ? "text-mine-green" : v === "failed" ? "text-mine-red" : "text-mine-amber"}>
          {label(v as string)}
        </span>
      )},
      { key: "shift", label: "Смена", render: v => label(v as string) },
      { key: "room", label: "Комната" },
      { key: "phone", label: "Телефон" },
    ];
    if (active === "events-log") return [
      { key: "created_at", label: "Дата/Время", render: v => formatDateTime(v as string) },
      { key: "type_label", label: "Тип", render: (v, row) => eventLabel(String(row.event_type || v || "")) },
      { key: "description", label: "Описание", render: (v, row) => {
        const id = row.id as number;
        if (editEventId === id) return (
          <div className="space-y-1.5 min-w-[260px]">
            <textarea
              value={eventDraft}
              onChange={e => setEventDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full text-xs rounded-md border border-border bg-secondary/50 text-foreground p-2 whitespace-normal focus:outline-none focus:ring-1 focus:ring-mine-cyan"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveEventEdit(id)}
                disabled={busyEventId === id || !eventDraft.trim()}
                className="text-xs px-2.5 py-1 rounded-md bg-mine-cyan text-background font-medium disabled:opacity-50"
              >
                Сохранить
              </button>
              <button
                onClick={() => setEditEventId(null)}
                className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                Отмена
              </button>
            </div>
          </div>
        );
        return String(v ?? "—");
      }},
      { key: "person_name", label: "Сотрудник" },
      { key: "person_code", label: "Код" },
      ...(isAdminUser ? [{ key: "__actions", label: "", noPrint: true, render: (_v: unknown, row: Record<string, unknown>) => {
        const id = row.id as number;
        if (editEventId === id) return null;
        return (
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => { setEditEventId(id); setEventDraft(String(row.description ?? "")); }}
              disabled={busyEventId === id}
              title="Редактировать"
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-mine-cyan"
            >
              <Icon name="Pencil" size={13} />
            </button>
            <button
              onClick={() => hideEventRow(id)}
              disabled={busyEventId === id}
              title="Убрать запись"
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-mine-red"
            >
              <Icon name={busyEventId === id ? "Loader2" : "Trash2"} size={13} className={busyEventId === id ? "animate-spin" : ""} />
            </button>
          </div>
        );
      }} as TableCol] : []),
    ];
    return [];
  };

  const renderTable = () => {
    if (!reportData) return null;
    const cols = getColumns().filter((c) => isAdminUser || (c.key !== "personal_code" && c.key !== "person_code"));
    const items = reportData.items;

    if (items.length === 0) return (
      <div className="p-8 text-center">
        <Icon name="FileX" size={32} className="text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Нет данных за выбранный период</p>
      </div>
    );

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {cols.map(c => (
                <th key={c.key} className={`${c.noPrint ? "no-print " : ""}px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={(item.id as number) ?? i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                {cols.map(c => (
                  <td key={c.key} className={`${c.noPrint ? "no-print " : ""}px-3 py-2 text-xs whitespace-nowrap`}>
                    {c.render ? c.render(item[c.key], item) : (c.key === "personal_code" || c.key === "person_code") ? <span className="font-mono text-red-500">{String(item[c.key] ?? "—")}</span> : (String(item[c.key] ?? "—"))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!active) {
    return (
      <AppLayout title="Отчёты" subtitle="Формирование и экспорт отчётной документации">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Доступно {allReports.length} типов отчётов. Выберите нужный для просмотра и экспорта.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allReports.map((r, i) => {
              const c = colorMap[r.color];
              return (
                <div
                  key={r.key}
                  onClick={() => setActive(r.key)}
                  className={`rounded-xl border ${c.border} ${c.bg} p-5 hover:scale-[1.02] transition-all cursor-pointer animate-fade-in group`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                      <Icon name={r.icon} size={20} className={c.icon} />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 py-1 rounded bg-secondary/50">
                      {r.freq}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{r.desc}</p>
                  <Button size="sm" variant="outline" className={`gap-1.5 text-xs w-full border-border group-hover:${c.text}`}>
                    <Icon name="Eye" size={12} />
                    Открыть отчёт
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </AppLayout>
    );
  }

  const rc = colorMap[activeReport?.color || "cyan"];

  return (
    <AppLayout title="Отчёты" subtitle={activeReport?.title || ""}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setActive(null); setReportData(null); setPassDirection("all"); setPassResult("all"); setPassQuery(""); }}>
            <Icon name="ArrowLeft" size={14} />
            Назад
          </Button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${rc.bg} border ${rc.border}`}>
            <Icon name={activeReport?.icon || "FileText"} size={16} className={rc.icon} />
            <span className={`text-sm font-semibold ${rc.text}`}>{activeReport?.title}</span>
          </div>

          <div className="flex-1" />

          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={loading}>
            <Icon name="Download" size={14} />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint} disabled={loading || !reportData}>
            <Icon name="Printer" size={14} />
            Печать
          </Button>
        </div>

        {active !== "housing" && active !== "personnel-summary" && (
          <div className="flex items-end gap-3 flex-wrap rounded-xl border border-border bg-card p-4">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Дата от</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-secondary/50 w-[160px] h-9 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Дата до</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-secondary/50 w-[160px] h-9 text-sm" />
            </div>

            {(active === "attendance" || active === "medical") && (
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Смена</label>
                <Select value={shiftType} onValueChange={setShiftType}>
                  <SelectTrigger className="bg-secondary/50 w-[140px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все смены</SelectItem>
                    <SelectItem value="day">Дневная</SelectItem>
                    <SelectItem value="night">Ночная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {active === "housing-history" && (
              <>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Действие</label>
                  <Select value={housingAction} onValueChange={setHousingAction}>
                    <SelectTrigger className="bg-secondary/50 w-[160px] h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="checkin">Заселение</SelectItem>
                      <SelectItem value="move">Переселение</SelectItem>
                      <SelectItem value="evict">Выселение</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Сотрудник, общежитие или комната</label>
                  <Input value={housingQuery} onChange={e => setHousingQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") loadReport(); }} placeholder="Например: Шнюков или 45" className="bg-secondary/50 w-[240px] h-9 text-sm" />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { label: "Неделя", days: 7 },
                    { label: "Месяц", days: 30 },
                    { label: "Квартал", days: 90 },
                    { label: "Год", days: 365 },
                  ].map(p => (
                    <Button key={p.days} type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - p.days + 1);
                      setDateFrom(d.toISOString().slice(0, 10));
                      setDateTo(today());
                    }}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {isPointReport && (
              <>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Направление</label>
                  <Select value={passDirection} onValueChange={setPassDirection}>
                    <SelectTrigger className="bg-secondary/50 w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="in">Вход</SelectItem>
                      <SelectItem value="out">Выход</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Результат</label>
                  <Select value={passResult} onValueChange={setPassResult}>
                    <SelectTrigger className="bg-secondary/50 w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="allowed">Пропущены</SelectItem>
                      <SelectItem value="denied">Отказы</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Поиск</label>
                  <Input
                    value={passQuery}
                    onChange={e => setPassQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loadReport()}
                    placeholder="ФИО, организация, таб. №"
                    className="bg-secondary/50 w-[220px] h-9 text-sm"
                  />
                </div>
              </>
            )}

            {active === "medical" && (
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Направление</label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger className="bg-secondary/50 w-[160px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="to_shift">На смену</SelectItem>
                    <SelectItem value="from_shift">Со смены</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button size="sm" className="gap-1.5 h-9 bg-primary text-primary-foreground" onClick={loadReport} disabled={loading}>
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Загрузка..." : "Сформировать"}
            </Button>
          </div>
        )}

        {active === "personnel-summary" && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Icon name="Info" size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Актуальные данные по всему персоналу на текущий момент</span>
            <div className="flex-1" />
            <Button size="sm" className="gap-1.5 h-9 bg-primary text-primary-foreground" onClick={loadReport} disabled={loading}>
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </Button>
          </div>
        )}

        {active === "housing" && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Icon name="Info" size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Текущая загрузка жилого фонда</span>
            <div className="flex-1" />
            <Button size="sm" className="gap-1.5 h-9 bg-primary text-primary-foreground" onClick={loadReport} disabled={loading}>
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </Button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl border border-mine-red/20 bg-mine-red/5 flex items-center gap-3">
            <Icon name="AlertCircle" size={18} className="text-mine-red" />
            <span className="text-sm text-mine-red">{error}</span>
          </div>
        )}

        <div ref={tableRef} className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center gap-3">
              <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
              <span className="text-sm text-muted-foreground">Формирование отчёта...</span>
            </div>
          ) : reportData ? (
            <>
              <div className="p-4 border-b border-border">
                {renderSummary()}
                <div className="text-xs text-muted-foreground">
                  Записей: {reportData.items.length}
                </div>
              </div>
              {renderTable()}
            </>
          ) : (
            <div className="p-12 text-center">
              <Icon name="FileBarChart" size={40} className="text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Нажмите «Сформировать» для загрузки отчёта</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;

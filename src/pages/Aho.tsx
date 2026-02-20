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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import { ahoApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ArrivalItem {
  id: number;
  batch_id: string;
  personnel_id: number;
  full_name: string;
  position: string;
  department: string;
  organization: string;
  phone: string;
  arrival_date: string;
  departure_date: string;
  arrival_status: string;
  check_in_at: string;
  check_out_at: string;
  room: string;
  building: string;
  personal_code: string;
  qr_code: string;
  current_medical: string;
  person_status: string;
  notes: string;
}

interface Batch {
  id: number;
  batch_id: string;
  file_name: string;
  total_count: number;
  arrived_count: number;
  departed_count: number;
  arrival_date: string;
  departure_date: string;
  created_at: string;
}

interface Stats {
  total: number;
  by_status: Record<string, number>;
  housed: number;
  not_housed: number;
  medical: Record<string, number>;
  today_expected: number;
  today_departing: number;
  total_batches: number;
  rooms_capacity: number;
  rooms_occupied: number;
}

interface MedicalItem {
  id: number;
  full_name: string;
  personal_code: string;
  department: string;
  organization: string;
  arrival_status: string;
  room: string;
  medical_status: string;
  person_id: number;
  last_check_status: string;
  last_check_time: string;
  blood_pressure: string;
  pulse: number;
  temperature: string;
  alcohol_level: string;
  check_notes: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  expected: { label: "Ожидается", color: "text-mine-amber", icon: "Clock" },
  arrived: { label: "На территории", color: "text-mine-green", icon: "CheckCircle" },
  departed: { label: "Выехал", color: "text-muted-foreground", icon: "LogOut" },
};

const MED_MAP: Record<string, { label: string; color: string }> = {
  passed: { label: "Пройден", color: "text-mine-green" },
  failed: { label: "Не пройден", color: "text-mine-red" },
  pending: { label: "Не пройден", color: "text-mine-amber" },
};

function formatDate(s: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("ru-RU"); } catch { return s; }
}

function formatDateTime(s: string) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

const Aho = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState("upload");
  const [loading, setLoading] = useState(false);

  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [medicals, setMedicals] = useState<MedicalItem[]>([]);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");
  const [medFilter, setMedFilter] = useState("all");

  const [roomDialog, setRoomDialog] = useState<ArrivalItem | null>(null);
  const [roomValue, setRoomValue] = useState("");
  const [buildingValue, setBuildingValue] = useState("");

  const [uploadDate, setUploadDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploadDepDate, setUploadDepDate] = useState("");
  const [uploadOrgType, setUploadOrgType] = useState("contractor");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStats();
    loadBatches();
  }, []);

  useEffect(() => {
    if (tab === "control") loadArrivals();
    if (tab === "housing") loadArrivals();
    if (tab === "medical") loadMedicals();
    if (tab === "stats") loadStats();
  }, [tab]);

  const loadArrivals = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterBatch !== "all") params.batch_id = filterBatch;
      const data = await ahoApi.getList(params);
      setArrivals(data.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const loadBatches = async () => {
    try {
      const data = await ahoApi.getBatches();
      setBatches(data.batches || []);
    } catch { /* ignore */ }
  };

  const loadStats = async () => {
    try {
      const data = await ahoApi.getStats();
      setStats(data);
    } catch { /* ignore */ }
  };

  const loadMedicals = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (medFilter !== "all") params.medical = medFilter;
      if (filterBatch !== "all") params.batch_id = filterBatch;
      const data = await ahoApi.getMedicalStatus(params);
      setMedicals(data.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === "control" || tab === "housing") loadArrivals();
  }, [filterStatus, filterBatch]);

  useEffect(() => {
    if (tab === "medical") loadMedicals();
  }, [medFilter, filterBatch]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Выберите Excel-файл", variant: "destructive" });
      return;
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Поддерживаются только .xlsx и .xls файлы", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await ahoApi.upload({
        file: base64,
        file_name: file.name,
        arrival_date: uploadDate,
        departure_date: uploadDepDate || undefined,
        organization_type: uploadOrgType,
      });

      toast({
        title: result.message,
        description: `Партия: ${result.batch_id}. Каждому присвоен личный код и QR.`,
      });

      if (fileRef.current) fileRef.current.value = "";
      loadBatches();
      loadStats();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleCheckIn = async (item: ArrivalItem) => {
    try {
      const res = await ahoApi.checkIn(item.id);
      toast({ title: res.message });
      loadArrivals();
      loadStats();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleCheckOut = async (item: ArrivalItem) => {
    try {
      const res = await ahoApi.checkOut(item.id);
      toast({ title: res.message });
      loadArrivals();
      loadStats();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleAssignRoom = async () => {
    if (!roomDialog || !roomValue) return;
    try {
      const res = await ahoApi.assignRoom(roomDialog.id, roomValue, buildingValue);
      toast({ title: res.message });
      setRoomDialog(null);
      setRoomValue("");
      setBuildingValue("");
      loadArrivals();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  return (
    <AppLayout title="АХО" subtitle="Административно-хозяйственный отдел">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="upload" className="gap-1.5">
            <Icon name="Upload" size={14} /> Загрузка
          </TabsTrigger>
          <TabsTrigger value="control" className="gap-1.5">
            <Icon name="ShieldCheck" size={14} /> Въезд / Выезд
          </TabsTrigger>
          <TabsTrigger value="housing" className="gap-1.5">
            <Icon name="Home" size={14} /> Расселение
          </TabsTrigger>
          <TabsTrigger value="medical" className="gap-1.5">
            <Icon name="HeartPulse" size={14} /> Медосмотр
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <Icon name="BarChart3" size={14} /> Статистика
          </TabsTrigger>
        </TabsList>

        {/* === ЗАГРУЗКА === */}
        <TabsContent value="upload" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-mine-amber/10 flex items-center justify-center">
                <Icon name="FileSpreadsheet" size={20} className="text-mine-amber" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Загрузка списка въезжающих</h3>
                <p className="text-xs text-muted-foreground">Excel файл с колонками: ФИО, Должность, Подразделение, Организация, Телефон</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Дата заезда</label>
                <Input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)} className="bg-secondary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Дата выезда (необязательно)</label>
                <Input type="date" value={uploadDepDate} onChange={e => setUploadDepDate(e.target.value)} className="bg-secondary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Тип организации</label>
                <Select value={uploadOrgType} onValueChange={setUploadOrgType}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contractor">Подрядчик</SelectItem>
                    <SelectItem value="mine">Рудничный</SelectItem>
                    <SelectItem value="office">Офисный</SelectItem>
                    <SelectItem value="guest">Гость</SelectItem>
                    <SelectItem value="gov">Гос.органы</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Файл Excel (.xlsx)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-mine-amber/10 file:text-mine-amber hover:file:bg-mine-amber/20 cursor-pointer"
              />
            </div>

            <Button onClick={handleUpload} disabled={loading} className="gap-2 bg-mine-amber text-white hover:bg-mine-amber/90">
              <Icon name="Upload" size={16} />
              {loading ? "Загрузка..." : "Загрузить и создать записи"}
            </Button>

            <div className="p-3 rounded-lg bg-mine-cyan/5 border border-mine-cyan/20 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-mine-cyan">Что произойдёт при загрузке:</p>
              <p>• Каждому сотруднику автоматически присвоится личный код (МК-XXX) и QR-код</p>
              <p>• Все добавленные сотрудники появятся в разделе «Персонал»</p>
              <p>• Можно отслеживать въезд/выезд и прохождение медосмотра</p>
            </div>
          </div>

          {batches.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Icon name="Package" size={16} className="text-muted-foreground" />
                Загруженные партии
              </h3>
              <div className="space-y-2">
                {batches.map(b => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50 text-sm">
                    <Icon name="FileSpreadsheet" size={16} className="text-mine-amber" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">{b.file_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {b.batch_id} • {formatDate(b.arrival_date || b.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{b.total_count} чел.</span>
                      <span className="text-mine-green">{b.arrived_count} въехали</span>
                      <span>{b.departed_count} выехали</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* === КОНТРОЛЬ ВЪЕЗДА/ВЫЕЗДА === */}
        <TabsContent value="control" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] bg-secondary/50 h-9 text-sm">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="expected">Ожидается</SelectItem>
                <SelectItem value="arrived">На территории</SelectItem>
                <SelectItem value="departed">Выехал</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="w-[220px] bg-secondary/50 h-9 text-sm">
                <SelectValue placeholder="Партия" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все партии</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.batch_id} value={b.batch_id}>
                    {b.file_name} ({b.total_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={loadArrivals} disabled={loading}>
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-12 flex items-center justify-center gap-3">
                <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
                <span className="text-sm text-muted-foreground">Загрузка...</span>
              </div>
            ) : arrivals.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="Users" size={32} className="text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Нет записей. Загрузите список на вкладке «Загрузка»</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ФИО</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Код</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Организация</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Заезд</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Выезд</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Статус</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Медосмотр</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrivals.map(item => {
                      const st = STATUS_MAP[item.arrival_status] || STATUS_MAP.expected;
                      const med = MED_MAP[item.current_medical] || MED_MAP.pending;
                      return (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-3 py-2 text-xs font-medium">{item.full_name}</td>
                          <td className="px-3 py-2 text-xs font-mono text-mine-cyan">{item.personal_code}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{item.organization || "—"}</td>
                          <td className="px-3 py-2 text-xs">{formatDate(item.arrival_date)}</td>
                          <td className="px-3 py-2 text-xs">{formatDate(item.departure_date)}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-medium flex items-center gap-1 ${st.color}`}>
                              <Icon name={st.icon} size={12} />
                              {st.label}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-medium ${med.color}`}>{med.label}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {item.arrival_status === "expected" && (
                                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-mine-green border-mine-green/30 hover:bg-mine-green/10" onClick={() => handleCheckIn(item)}>
                                  <Icon name="LogIn" size={12} />
                                  Въезд
                                </Button>
                              )}
                              {item.arrival_status === "arrived" && (
                                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-mine-red border-mine-red/30 hover:bg-mine-red/10" onClick={() => handleCheckOut(item)}>
                                  <Icon name="LogOut" size={12} />
                                  Выезд
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === РАССЕЛЕНИЕ === */}
        <TabsContent value="housing" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] bg-secondary/50 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="arrived">На территории</SelectItem>
                <SelectItem value="expected">Ожидается</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={loadArrivals} disabled={loading}>
              <Icon name="RefreshCw" size={14} />
              Обновить
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {arrivals.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="Home" size={32} className="text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Нет записей</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ФИО</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Код</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Организация</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Статус</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Комната</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Корпус</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrivals.map(item => {
                      const st = STATUS_MAP[item.arrival_status] || STATUS_MAP.expected;
                      return (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="px-3 py-2 text-xs font-medium">{item.full_name}</td>
                          <td className="px-3 py-2 text-xs font-mono text-mine-cyan">{item.personal_code}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{item.organization || "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs ${st.color}`}>{st.label}</span>
                          </td>
                          <td className="px-3 py-2 text-xs font-medium">
                            {item.room ? (
                              <span className="text-mine-green">{item.room}</span>
                            ) : (
                              <span className="text-mine-amber">Не заселён</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{item.building || "—"}</td>
                          <td className="px-3 py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1"
                              onClick={() => {
                                setRoomDialog(item);
                                setRoomValue(item.room || "");
                                setBuildingValue(item.building || "");
                              }}
                            >
                              <Icon name="Home" size={12} />
                              {item.room ? "Переселить" : "Заселить"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === МЕДОСМОТР === */}
        <TabsContent value="medical" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={medFilter} onValueChange={setMedFilter}>
              <SelectTrigger className="w-[180px] bg-secondary/50 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="pending">Не пройден</SelectItem>
                <SelectItem value="passed">Пройден</SelectItem>
                <SelectItem value="failed">Отстранён</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="w-[220px] bg-secondary/50 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все партии</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.batch_id} value={b.batch_id}>
                    {b.file_name} ({b.total_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={loadMedicals} disabled={loading}>
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-12 flex items-center justify-center gap-3">
                <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
              </div>
            ) : medicals.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="HeartPulse" size={32} className="text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Нет данных</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ФИО</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Код</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Организация</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Комната</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Медосмотр</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Посл. осмотр</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Давл.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Пульс</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Темп.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Алк.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Примечание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicals.map(item => {
                      const med = MED_MAP[item.medical_status] || MED_MAP.pending;
                      return (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="px-3 py-2 text-xs font-medium">{item.full_name}</td>
                          <td className="px-3 py-2 text-xs font-mono text-mine-cyan">{item.personal_code}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{item.organization || "—"}</td>
                          <td className="px-3 py-2 text-xs">{item.room || "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-semibold ${med.color}`}>{med.label}</span>
                          </td>
                          <td className="px-3 py-2 text-xs">{item.last_check_time ? formatDateTime(item.last_check_time) : "—"}</td>
                          <td className="px-3 py-2 text-xs">{item.blood_pressure || "—"}</td>
                          <td className="px-3 py-2 text-xs">{item.pulse || "—"}</td>
                          <td className="px-3 py-2 text-xs">{item.temperature || "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            {item.alcohol_level ? (
                              <span className={parseFloat(item.alcohol_level) > 0 ? "text-mine-red font-semibold" : ""}>
                                {item.alcohol_level}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{item.check_notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === СТАТИСТИКА === */}
        <TabsContent value="stats" className="space-y-4">
          {stats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon="Users" label="Всего в списках" value={stats.total} color="amber" />
                <StatCard icon="LogIn" label="На территории" value={stats.by_status.arrived || 0} color="green" />
                <StatCard icon="Clock" label="Ожидается" value={stats.by_status.expected || 0} color="cyan" />
                <StatCard icon="LogOut" label="Выехали" value={stats.by_status.departed || 0} color="muted" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon="Home" label="Заселены" value={stats.housed} color="green" />
                <StatCard icon="Home" label="Не заселены" value={stats.not_housed} color="amber" />
                <StatCard icon="CalendarCheck" label="Заезд сегодня" value={stats.today_expected} color="cyan" />
                <StatCard icon="CalendarX" label="Выезд сегодня" value={stats.today_departing} color="red" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="HeartPulse" size={16} className="text-mine-green" />
                    Медосмотр (на территории)
                  </h3>
                  <div className="space-y-2">
                    <MedBar label="Пройден" count={stats.medical.passed || 0} total={stats.by_status.arrived || 1} color="bg-mine-green" />
                    <MedBar label="Не пройден" count={stats.medical.pending || 0} total={stats.by_status.arrived || 1} color="bg-mine-amber" />
                    <MedBar label="Отстранён" count={stats.medical.failed || 0} total={stats.by_status.arrived || 1} color="bg-mine-red" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="Home" size={16} className="text-mine-cyan" />
                    Жилой фонд
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Вместимость</span>
                      <span className="font-semibold">{stats.rooms_capacity} мест</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Занято</span>
                      <span className="font-semibold text-mine-amber">{stats.rooms_occupied} мест</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Свободно</span>
                      <span className="font-semibold text-mine-green">{stats.rooms_capacity - stats.rooms_occupied} мест</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-mine-amber h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((stats.rooms_occupied / Math.max(stats.rooms_capacity, 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      Загрузка: {Math.round((stats.rooms_occupied / Math.max(stats.rooms_capacity, 1)) * 100)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Icon name="Package" size={16} className="text-muted-foreground" />
                  Загружено партий: {stats.total_batches}
                </h3>
              </div>
            </>
          ) : (
            <div className="p-12 flex items-center justify-center gap-3">
              <Icon name="Loader2" size={20} className="animate-spin text-mine-cyan" />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Назначение комнаты */}
      <Dialog open={!!roomDialog} onOpenChange={() => setRoomDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Заселение: {roomDialog?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Номер комнаты</label>
              <Input value={roomValue} onChange={e => setRoomValue(e.target.value)} placeholder="Например: 101" className="bg-secondary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Корпус (необязательно)</label>
              <Input value={buildingValue} onChange={e => setBuildingValue(e.target.value)} placeholder="Например: Корпус 1" className="bg-secondary/50" />
            </div>
            <Button onClick={handleAssignRoom} disabled={!roomValue} className="w-full gap-2 bg-mine-green text-white hover:bg-mine-green/90">
              <Icon name="Home" size={16} />
              Заселить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    amber: "text-mine-amber bg-mine-amber/10 border-mine-amber/20",
    green: "text-mine-green bg-mine-green/10 border-mine-green/20",
    cyan: "text-mine-cyan bg-mine-cyan/10 border-mine-cyan/20",
    red: "text-mine-red bg-mine-red/10 border-mine-red/20",
    muted: "text-muted-foreground bg-secondary/50 border-border",
  };
  const cls = colorMap[color] || colorMap.muted;
  const textColor = color === "muted" ? "text-foreground" : cls.split(" ")[0];

  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <Icon name={icon} size={20} className={`${textColor} mb-2`} />
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function MedBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / Math.max(total, 1)) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{count} ({pct}%)</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default Aho;

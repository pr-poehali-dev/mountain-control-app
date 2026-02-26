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
import HousingStats from "@/components/aho/HousingStats";
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

  const [itrStats, setItrStats] = useState<{
    summary: Record<string, number>;
    itr_list: Record<string, unknown>[];
    worker_list: Record<string, unknown>[];
    itr_positions: string[];
  } | null>(null);
  const [itrView, setItrView] = useState<"itr" | "worker">("itr");

  const [uploadDate, setUploadDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploadDepDate, setUploadDepDate] = useState("");
  const [uploadOrgType, setUploadOrgType] = useState("contractor");
  const fileRef = useRef<HTMLInputElement>(null);

  const [buildings, setBuildings] = useState<Array<{
    id: number; name: string; number: string; total_rooms: number;
    total_capacity: number; actual_rooms: number; actual_capacity: number;
    occupied_people: number; sort_order: number; is_active: boolean;
  }>>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [showBuildingSettings, setShowBuildingSettings] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingNumber, setNewBuildingNumber] = useState("");

  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [buildingRooms, setBuildingRooms] = useState<Array<{
    id: number; room_number: string; capacity: number; floor: number;
    notes: string; is_active: boolean; building_name: string; occupied: number;
  }>>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("2");
  const [batchFrom, setBatchFrom] = useState("");
  const [batchTo, setBatchTo] = useState("");
  const [batchCapacity, setBatchCapacity] = useState("2");

  const [editingBuilding, setEditingBuilding] = useState<number | null>(null);
  const [editBuildingName, setEditBuildingName] = useState("");
  const [editBuildingNumber, setEditBuildingNumber] = useState("");

  const [assignFromRoom, setAssignFromRoom] = useState<{ room_number: string; building_name: string } | null>(null);
  const [unhoustedList, setUnhoustedList] = useState<ArrivalItem[]>([]);
  const [unhoustedLoading, setUnhoustedLoading] = useState(false);

  useEffect(() => {
    loadStats();
    loadBatches();
    loadBuildings();
  }, []);

  useEffect(() => {
    if (tab === "control") loadArrivals();
    if (tab === "housing") loadArrivals();
    if (tab === "medical") { loadMedicals(); loadItrStats(); }
    if (tab === "stats") loadStats();
  }, [tab]);

  const downloadTemplate = async () => {
    try {
      const data = await ahoApi.getTemplate();
      const byteChars = atob(data.file);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.file_name || "Шаблон.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Ошибка скачивания шаблона", variant: "destructive" });
    }
  };

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

  const loadItrStats = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterBatch !== "all") params.batch_id = filterBatch;
      const data = await ahoApi.getMedicalItrStats(params);
      setItrStats(data);
    } catch { /* ignore */ }
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

  const loadBuildings = async () => {
    setBuildingsLoading(true);
    try {
      const res = await ahoApi.getBuildings();
      setBuildings(res.buildings || []);
    } catch { /* */ }
    finally { setBuildingsLoading(false); }
  };

  const handleCreateBuilding = async () => {
    if (!newBuildingName.trim()) return;
    try {
      await ahoApi.createBuilding({ name: newBuildingName.trim(), number: newBuildingNumber.trim() || undefined });
      toast({ title: "Здание добавлено" });
      setNewBuildingName("");
      setNewBuildingNumber("");
      loadBuildings();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleDeleteBuilding = async (id: number) => {
    try {
      await ahoApi.updateBuilding({ id, is_active: false });
      toast({ title: "Здание удалено" });
      loadBuildings();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const openBuilding = async (buildingId: number) => {
    setSelectedBuilding(buildingId);
    setRoomsLoading(true);
    try {
      const res = await ahoApi.getRooms(buildingId);
      setBuildingRooms(res.rooms || []);
    } catch { /* */ }
    finally { setRoomsLoading(false); }
  };

  const handleAddRoom = async () => {
    if (!selectedBuilding || !newRoomNumber.trim()) return;
    try {
      await ahoApi.createRoom({
        building_id: selectedBuilding,
        room_number: newRoomNumber.trim(),
        capacity: parseInt(newRoomCapacity) || 2,
      });
      setNewRoomNumber("");
      openBuilding(selectedBuilding);
      loadBuildings();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleBatchRooms = async () => {
    if (!selectedBuilding || !batchFrom || !batchTo) return;
    const from = parseInt(batchFrom);
    const to = parseInt(batchTo);
    if (isNaN(from) || isNaN(to) || from > to || to - from > 200) {
      toast({ title: "Некорректный диапазон", variant: "destructive" });
      return;
    }
    const rooms = [];
    for (let i = from; i <= to; i++) {
      rooms.push({ room_number: String(i), capacity: parseInt(batchCapacity) || 2 });
    }
    try {
      const res = await ahoApi.createRoomsBatch(selectedBuilding, rooms);
      toast({ title: res.message });
      setBatchFrom("");
      setBatchTo("");
      openBuilding(selectedBuilding);
      loadBuildings();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleDeleteRoom = async (roomId: number) => {
    if (!selectedBuilding) return;
    try {
      await ahoApi.updateRoom({ id: roomId, is_active: false });
      openBuilding(selectedBuilding);
      loadBuildings();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleSaveBuilding = async (id: number) => {
    if (!editBuildingName.trim()) return;
    try {
      await ahoApi.updateBuilding({ id, name: editBuildingName.trim(), number: editBuildingNumber.trim() || editBuildingName.trim() });
      toast({ title: "Здание обновлено" });
      setEditingBuilding(null);
      loadBuildings();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const openAssignFromRoom = async (room_number: string, building_name: string) => {
    setAssignFromRoom({ room_number, building_name });
    setUnhoustedLoading(true);
    try {
      const data = await ahoApi.getList({ status: "arrived" });
      setUnhoustedList((data.items || []).filter((a: ArrivalItem) => !a.room));
    } catch { /* */ }
    finally { setUnhoustedLoading(false); }
  };

  const handleAssignFromRoom = async (arrivalId: number) => {
    if (!assignFromRoom) return;
    try {
      await ahoApi.assignRoom(arrivalId, assignFromRoom.room_number, assignFromRoom.building_name);
      toast({ title: "Заселён в комнату " + assignFromRoom.room_number });
      const data = await ahoApi.getList({ status: "arrived" });
      setUnhoustedList((data.items || []).filter((a: ArrivalItem) => !a.room));
      if (selectedBuilding) openBuilding(selectedBuilding);
      loadBuildings();
      loadArrivals();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleMassCheckIn = async () => {
    const ids = arrivals.filter(a => a.arrival_status === "expected").map(a => a.id);
    if (!ids.length) { toast({ title: "Нет ожидающих для въезда" }); return; }
    try {
      const body: Record<string, unknown> = filterBatch !== "all" ? { batch_id: filterBatch } : { ids };
      const res = await ahoApi.massCheckIn(body);
      toast({ title: res.message });
      loadArrivals();
      loadStats();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleMassCheckOut = async () => {
    const ids = arrivals.filter(a => a.arrival_status === "arrived").map(a => a.id);
    if (!ids.length) { toast({ title: "Нет людей на территории" }); return; }
    try {
      const body: Record<string, unknown> = filterBatch !== "all" ? { batch_id: filterBatch } : { ids };
      const res = await ahoApi.massCheckOut(body);
      toast({ title: res.message });
      loadArrivals();
      loadStats();
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

            <Button variant="outline" size="sm" className="gap-2 text-mine-cyan border-mine-cyan/30 hover:bg-mine-cyan/10" onClick={downloadTemplate}>
              <Icon name="Download" size={14} />
              Скачать шаблон Excel
            </Button>

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
            <div className="flex-1" />
            {arrivals.some(a => a.arrival_status === "expected") && (
              <Button size="sm" className="gap-1.5 h-9 bg-mine-green text-white hover:bg-mine-green/90" onClick={handleMassCheckIn}>
                <Icon name="LogIn" size={14} />
                Въезд всех ожидающих ({arrivals.filter(a => a.arrival_status === "expected").length})
              </Button>
            )}
            {arrivals.some(a => a.arrival_status === "arrived") && (
              <Button size="sm" variant="outline" className="gap-1.5 h-9 text-mine-red border-mine-red/30 hover:bg-mine-red/10" onClick={handleMassCheckOut}>
                <Icon name="LogOut" size={14} />
                Выезд всех ({arrivals.filter(a => a.arrival_status === "arrived").length})
              </Button>
            )}
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
          <HousingStats />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Жилые здания</h3>
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setShowBuildingSettings(true)}>
              <Icon name="Settings" size={14} />
              Настройка зданий
            </Button>
          </div>

          {buildingsLoading ? (
            <div className="flex justify-center py-8">
              <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : buildings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Icon name="Building2" size={24} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">Жилые здания не настроены</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowBuildingSettings(true)}>
                <Icon name="Plus" size={14} />
                Добавить здание
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {buildings.map(b => {
                const occupancyPct = b.actual_capacity > 0 ? Math.round((b.occupied_people / b.actual_capacity) * 100) : 0;
                const occupancyColor = occupancyPct >= 90 ? "text-mine-red" : occupancyPct >= 60 ? "text-mine-amber" : "text-mine-green";
                return (
                  <button
                    key={b.id}
                    onClick={() => openBuilding(b.id)}
                    className="rounded-xl border border-border bg-card p-4 text-left hover:border-mine-cyan/30 hover:shadow-lg hover:shadow-mine-cyan/5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
                          <Icon name="Building2" size={18} className="text-mine-cyan" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground group-hover:text-mine-cyan transition-colors">{b.name}</p>
                          <p className="text-[10px] text-muted-foreground">{b.number}</p>
                        </div>
                      </div>
                      <Icon name="ChevronRight" size={16} className="text-muted-foreground/30 group-hover:text-mine-cyan/50 transition-colors mt-1" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{b.actual_rooms}</p>
                        <p className="text-[10px] text-muted-foreground">Комнат</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{b.actual_capacity}</p>
                        <p className="text-[10px] text-muted-foreground">Мест</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-lg font-bold ${occupancyColor}`}>{b.occupied_people}</p>
                        <p className="text-[10px] text-muted-foreground">Заселено</p>
                      </div>
                    </div>
                    {b.actual_capacity > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${occupancyPct >= 90 ? "bg-mine-red" : occupancyPct >= 60 ? "bg-mine-amber" : "bg-mine-green"}`}
                            style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 text-right">{occupancyPct}% занято</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Список расселения</h3>
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
          </div>
        </TabsContent>

        {/* === МЕДОСМОТР === */}
        <TabsContent value="medical" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
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
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => { loadItrStats(); }} disabled={loading}>
              <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </Button>
          </div>

          {itrStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setItrView("itr")}
                className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${itrView === "itr" ? "border-mine-amber bg-mine-amber/5" : "border-border bg-card hover:border-mine-amber/30"}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-mine-amber/10 flex items-center justify-center">
                    <Icon name="Briefcase" size={20} className="text-mine-amber" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">ИТР работники</h3>
                    <p className="text-xs text-muted-foreground">{itrStats.summary.itr_total} чел.</p>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-2xl font-bold text-mine-amber">
                      {itrStats.summary.itr_total > 0 ? Math.round((itrStats.summary.itr_passed / itrStats.summary.itr_total) * 100) : 0}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">прошли</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-mine-green/10">
                    <div className="text-lg font-bold text-mine-green">{itrStats.summary.itr_passed}</div>
                    <div className="text-[10px] text-muted-foreground">Пройден</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-mine-amber/10">
                    <div className="text-lg font-bold text-mine-amber">{itrStats.summary.itr_pending}</div>
                    <div className="text-[10px] text-muted-foreground">Ожидание</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-mine-red/10">
                    <div className="text-lg font-bold text-mine-red">{itrStats.summary.itr_failed}</div>
                    <div className="text-[10px] text-muted-foreground">Отстранён</div>
                  </div>
                </div>
                <div className="mt-3 w-full bg-secondary rounded-full h-2 overflow-hidden flex">
                  {itrStats.summary.itr_total > 0 && (
                    <>
                      <div className="bg-mine-green h-2" style={{ width: `${(itrStats.summary.itr_passed / itrStats.summary.itr_total) * 100}%` }} />
                      <div className="bg-mine-amber h-2" style={{ width: `${(itrStats.summary.itr_pending / itrStats.summary.itr_total) * 100}%` }} />
                      <div className="bg-mine-red h-2" style={{ width: `${(itrStats.summary.itr_failed / itrStats.summary.itr_total) * 100}%` }} />
                    </>
                  )}
                </div>
              </div>

              <div
                onClick={() => setItrView("worker")}
                className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${itrView === "worker" ? "border-mine-cyan bg-mine-cyan/5" : "border-border bg-card hover:border-mine-cyan/30"}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-mine-cyan/10 flex items-center justify-center">
                    <Icon name="HardHat" size={20} className="text-mine-cyan" fallback="Users" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Рабочие</h3>
                    <p className="text-xs text-muted-foreground">{itrStats.summary.worker_total} чел.</p>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-2xl font-bold text-mine-cyan">
                      {itrStats.summary.worker_total > 0 ? Math.round((itrStats.summary.worker_passed / itrStats.summary.worker_total) * 100) : 0}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">прошли</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-mine-green/10">
                    <div className="text-lg font-bold text-mine-green">{itrStats.summary.worker_passed}</div>
                    <div className="text-[10px] text-muted-foreground">Пройден</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-mine-amber/10">
                    <div className="text-lg font-bold text-mine-amber">{itrStats.summary.worker_pending}</div>
                    <div className="text-[10px] text-muted-foreground">Ожидание</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-mine-red/10">
                    <div className="text-lg font-bold text-mine-red">{itrStats.summary.worker_failed}</div>
                    <div className="text-[10px] text-muted-foreground">Отстранён</div>
                  </div>
                </div>
                <div className="mt-3 w-full bg-secondary rounded-full h-2 overflow-hidden flex">
                  {itrStats.summary.worker_total > 0 && (
                    <>
                      <div className="bg-mine-green h-2" style={{ width: `${(itrStats.summary.worker_passed / itrStats.summary.worker_total) * 100}%` }} />
                      <div className="bg-mine-amber h-2" style={{ width: `${(itrStats.summary.worker_pending / itrStats.summary.worker_total) * 100}%` }} />
                      <div className="bg-mine-red h-2" style={{ width: `${(itrStats.summary.worker_failed / itrStats.summary.worker_total) * 100}%` }} />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Icon name={itrView === "itr" ? "Briefcase" : "HardHat"} size={16} className={itrView === "itr" ? "text-mine-amber" : "text-mine-cyan"} fallback="Users" />
              <span className="text-sm font-semibold">
                {itrView === "itr" ? "ИТР работники" : "Рабочие"} — медосмотр
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                ({(itrView === "itr" ? itrStats?.itr_list : itrStats?.worker_list)?.length || 0} чел.)
              </span>
            </div>
            {(() => {
              const list = (itrView === "itr" ? itrStats?.itr_list : itrStats?.worker_list) || [];
              if (list.length === 0) return (
                <div className="p-12 text-center">
                  <Icon name="HeartPulse" size={32} className="text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                </div>
              );
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ФИО</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Код</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Должность</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Организация</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Медосмотр</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Давл.</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Пульс</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Темп.</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Алк.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item: Record<string, unknown>) => {
                        const ms = String(item.medical_status || "pending");
                        const med = MED_MAP[ms] || MED_MAP.pending;
                        return (
                          <tr key={String(item.id)} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="px-3 py-2 text-xs font-medium">{String(item.full_name)}</td>
                            <td className="px-3 py-2 text-xs font-mono text-mine-cyan">{String(item.personal_code)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{String(item.position || "—")}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{String(item.organization || "—")}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-semibold ${med.color}`}>{med.label}</span>
                            </td>
                            <td className="px-3 py-2 text-xs">{String(item.blood_pressure || "—")}</td>
                            <td className="px-3 py-2 text-xs">{String(item.pulse || "—")}</td>
                            <td className="px-3 py-2 text-xs">{String(item.temperature || "—")}</td>
                            <td className="px-3 py-2 text-xs">
                              {item.alcohol_level ? (
                                <span className={parseFloat(String(item.alcohol_level)) > 0 ? "text-mine-red font-semibold" : ""}>
                                  {String(item.alcohol_level)}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
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

      <Dialog open={showBuildingSettings} onOpenChange={setShowBuildingSettings}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Building2" size={18} className="text-mine-cyan" />
              Настройка жилых зданий
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newBuildingName}
                onChange={e => setNewBuildingName(e.target.value)}
                placeholder="Название здания"
                className="bg-secondary/50 flex-1"
              />
              <Input
                value={newBuildingNumber}
                onChange={e => setNewBuildingNumber(e.target.value)}
                placeholder="Номер"
                className="bg-secondary/50 w-24"
              />
              <Button onClick={handleCreateBuilding} disabled={!newBuildingName.trim()} className="gap-1 bg-mine-cyan text-white hover:bg-mine-cyan/90 shrink-0">
                <Icon name="Plus" size={14} />
                Добавить
              </Button>
            </div>

            {buildings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Зданий пока нет</p>
            ) : (
              <div className="space-y-2">
                {buildings.map(b => (
                  <div key={b.id} className="rounded-lg border border-border p-3">
                    {editingBuilding === b.id ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={editBuildingName}
                          onChange={e => setEditBuildingName(e.target.value)}
                          placeholder="Название"
                          className="bg-secondary/50 flex-1 h-8 text-sm"
                          autoFocus
                        />
                        <Input
                          value={editBuildingNumber}
                          onChange={e => setEditBuildingNumber(e.target.value)}
                          placeholder="Номер"
                          className="bg-secondary/50 w-24 h-8 text-sm"
                        />
                        <Button size="sm" className="h-8 gap-1 bg-mine-green text-white hover:bg-mine-green/90" onClick={() => handleSaveBuilding(b.id)}>
                          <Icon name="Check" size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingBuilding(null)}>
                          <Icon name="X" size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.number} · {b.actual_rooms} комнат · {b.actual_capacity} мест</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => { setEditingBuilding(b.id); setEditBuildingName(b.name); setEditBuildingNumber(b.number); }}>
                            <Icon name="Pencil" size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-mine-red hover:text-mine-red" onClick={() => handleDeleteBuilding(b.id)}>
                            <Icon name="Trash2" size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBuilding} onOpenChange={(open) => { if (!open) setSelectedBuilding(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="DoorOpen" size={18} className="text-mine-cyan" />
              {buildings.find(b => b.id === selectedBuilding)?.name || "Здание"} — Комнаты
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6 space-y-4">
            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Добавить комнату</p>
              <div className="flex gap-2">
                <Input
                  value={newRoomNumber}
                  onChange={e => setNewRoomNumber(e.target.value)}
                  placeholder="Номер комнаты"
                  className="bg-secondary/50 w-32"
                />
                <Input
                  value={newRoomCapacity}
                  onChange={e => setNewRoomCapacity(e.target.value)}
                  placeholder="Мест"
                  type="number"
                  className="bg-secondary/50 w-20"
                />
                <Button onClick={handleAddRoom} disabled={!newRoomNumber.trim()} size="sm" className="gap-1 bg-mine-green text-white hover:bg-mine-green/90">
                  <Icon name="Plus" size={14} />
                  Добавить
                </Button>
              </div>
              <div className="border-t border-border/50 pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Массовое добавление</p>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground">С</span>
                  <Input
                    value={batchFrom}
                    onChange={e => setBatchFrom(e.target.value)}
                    placeholder="1"
                    type="number"
                    className="bg-secondary/50 w-20"
                  />
                  <span className="text-xs text-muted-foreground">по</span>
                  <Input
                    value={batchTo}
                    onChange={e => setBatchTo(e.target.value)}
                    placeholder="20"
                    type="number"
                    className="bg-secondary/50 w-20"
                  />
                  <span className="text-xs text-muted-foreground">мест:</span>
                  <Input
                    value={batchCapacity}
                    onChange={e => setBatchCapacity(e.target.value)}
                    placeholder="2"
                    type="number"
                    className="bg-secondary/50 w-16"
                  />
                  <Button onClick={handleBatchRooms} disabled={!batchFrom || !batchTo} size="sm" className="gap-1 bg-mine-cyan text-white hover:bg-mine-cyan/90 shrink-0">
                    <Icon name="Layers" size={14} />
                    Создать
                  </Button>
                </div>
              </div>
            </div>

            {roomsLoading ? (
              <div className="flex justify-center py-8">
                <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : buildingRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Комнат пока нет</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {buildingRooms.map(r => {
                  const isFull = r.occupied >= r.capacity;
                  return (
                    <div key={r.id} className={`rounded-lg border p-2.5 relative group ${isFull ? "border-mine-red/20 bg-mine-red/5" : r.occupied > 0 ? "border-mine-amber/20 bg-mine-amber/5" : "border-border bg-card"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{r.room_number}</span>
                        <button onClick={() => handleDeleteRoom(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-mine-red/60 hover:text-mine-red">
                          <Icon name="X" size={12} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1">
                          <Icon name="Users" size={10} className="text-muted-foreground" />
                          <span className={`text-xs font-medium ${isFull ? "text-mine-red" : "text-muted-foreground"}`}>
                            {r.occupied}/{r.capacity}
                          </span>
                        </div>
                        {!isFull && (
                          <button
                            onClick={() => openAssignFromRoom(r.room_number, r.building_name)}
                            className="text-[10px] text-mine-cyan hover:underline"
                          >
                            Заселить
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignFromRoom} onOpenChange={(open) => { if (!open) setAssignFromRoom(null); }}>
        <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="UserPlus" size={18} className="text-mine-cyan" />
              Заселить в комнату {assignFromRoom?.room_number}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6">
            {unhoustedLoading ? (
              <div className="flex justify-center py-8">
                <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : unhoustedList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Все прибывшие уже заселены</p>
            ) : (
              <div className="space-y-1">
                {unhoustedList.map(a => (
                  <div key={a.id} className="rounded-lg border border-border p-2.5 flex items-center justify-between hover:bg-secondary/20">
                    <div>
                      <p className="text-sm font-medium">{a.full_name}</p>
                      <p className="text-xs text-muted-foreground">{a.personal_code} · {a.organization || "—"}</p>
                    </div>
                    <Button size="sm" className="h-7 text-[11px] gap-1 bg-mine-green text-white hover:bg-mine-green/90" onClick={() => handleAssignFromRoom(a.id)}>
                      <Icon name="UserPlus" size={12} />
                      Заселить
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
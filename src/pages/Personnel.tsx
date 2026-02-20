import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { useState, useEffect, useCallback, useRef } from "react";
import { personnelApi } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";

const statusLabels: Record<string, string> = {
  on_shift: "на смене",
  arrived: "прибыл",
  departed: "убыл",
  business_trip: "командировка",
};

const categoryLabels: Record<string, string> = {
  mine: "Рудничный",
  contractor: "Подрядчик",
  business_trip: "Командированный",
  guest: "Гость",
};

const statusColors: Record<string, string> = {
  "на смене": "bg-mine-green/20 text-mine-green border-mine-green/30",
  прибыл: "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  убыл: "bg-muted text-muted-foreground border-border",
  командировка: "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const categoryColors: Record<string, string> = {
  Рудничный: "bg-mine-amber/15 text-mine-amber border-mine-amber/25",
  Подрядчик: "bg-mine-cyan/15 text-mine-cyan border-mine-cyan/25",
  Командированный: "bg-mine-green/15 text-mine-green border-mine-green/25",
  Гость: "bg-secondary text-muted-foreground border-border",
};

const medicalLabels: Record<string, string> = {
  passed: "пройден",
  failed: "не пройден",
  pending: "ожидает",
  expiring: "истекает",
};

const medicalColors: Record<string, string> = {
  passed: "bg-mine-green/20 text-mine-green border-mine-green/30",
  failed: "bg-mine-red/20 text-mine-red border-mine-red/30",
  pending: "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
  expiring: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const orgTypeLabels: Record<string, string> = {
  rudnik: "Рудник",
  guest: "Гость",
  contractor: "Подрядная организация",
  gov: "Гос.органы",
};

const orgTypeColors: Record<string, string> = {
  rudnik: "bg-mine-amber/15 text-mine-amber border-mine-amber/25",
  guest: "bg-secondary text-muted-foreground border-border",
  contractor: "bg-mine-cyan/15 text-mine-cyan border-mine-cyan/25",
  gov: "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

interface PersonnelItem {
  id: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  category: string;
  room?: string;
  status: string;
  phone?: string;
  qr_code?: string;
  medical_status?: string;
  shift?: string;
  organization?: string;
  organization_type?: string;
}

interface HistoryEvent {
  id: number;
  type: string;
  type_label: string;
  description: string;
  created_at: string;
}

interface StatsData {
  mine?: number;
  contractor?: number;
  business_trip?: number;
  guest?: number;
  by_org_type?: Record<string, number>;
}

function buildQrPayload(p: PersonnelItem) {
  return JSON.stringify({
    code: p.personal_code,
    name: p.full_name,
    pos: p.position,
    dept: p.department,
    cat: p.category,
    med: p.medical_status || "pending",
    status: p.status,
    org: p.organization || "",
    orgType: p.organization_type || "",
  });
}

const Personnel = () => {
  const [search, setSearch] = useState("");
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [stats, setStats] = useState<StatsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState<{
    personal_code: string;
    qr_code: string;
    full_name: string;
  } | null>(null);

  const [selectedPerson, setSelectedPerson] = useState<PersonnelItem | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrPerson, setQrPerson] = useState<PersonnelItem | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [formName, setFormName] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formCategory, setFormCategory] = useState("mine");
  const [formPhone, setFormPhone] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formShift, setFormShift] = useState("");
  const [formOrg, setFormOrg] = useState("");
  const [formOrgType, setFormOrgType] = useState("");

  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editShift, setEditShift] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editMedical, setEditMedical] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editOrgType, setEditOrgType] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [listRes, statsRes] = await Promise.all([
        personnelApi.getAll(),
        personnelApi.getStats(),
      ]);
      setPersonnel(listRes.personnel || []);
      const byCat = statsRes.by_category || {};
      setStats({
        mine: byCat.mine || 0,
        contractor: byCat.contractor || 0,
        business_trip: byCat.business_trip || 0,
        guest: byCat.guest || 0,
        by_org_type: statsRes.by_org_type || {},
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!search.trim()) {
      personnelApi
        .getAll()
        .then((res) => setPersonnel(res.personnel || []))
        .catch(() => {});
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await personnelApi.search(search);
        setPersonnel(res.results || []);
      } catch {
        /* keep current */
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const resetForm = () => {
    setFormName("");
    setFormPosition("");
    setFormDept("");
    setFormCategory("mine");
    setFormPhone("");
    setFormRoom("");
    setFormShift("");
    setFormOrg("");
    setFormOrgType("");
    setAddError("");
    setAddSuccess(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAdd(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setAddLoading(true);
    setAddError("");
    try {
      const res = await personnelApi.add({
        full_name: formName.trim(),
        position: formPosition.trim(),
        department: formDept.trim(),
        category: formCategory,
        phone: formPhone.trim(),
        room: formRoom.trim(),
        shift: formShift,
        organization: formOrg.trim(),
        organization_type: formOrgType,
      });
      setAddSuccess({
        personal_code: res.personal_code,
        qr_code: res.qr_code,
        full_name: formName.trim(),
      });
      fetchData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Ошибка добавления");
    } finally {
      setAddLoading(false);
    }
  };

  const openCard = async (p: PersonnelItem) => {
    setSelectedPerson(p);
    setEditing(false);
    setEditError("");
    setShowCard(true);
    setHistoryLoading(true);
    try {
      const res = await personnelApi.getHistory(p.id);
      setHistory(res.events || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const startEdit = () => {
    if (!selectedPerson) return;
    setEditName(selectedPerson.full_name);
    setEditPosition(selectedPerson.position);
    setEditDept(selectedPerson.department);
    setEditCategory(selectedPerson.category);
    setEditPhone(selectedPerson.phone || "");
    setEditRoom(selectedPerson.room || "");
    setEditShift(selectedPerson.shift || "");
    setEditStatus(selectedPerson.status);
    setEditMedical(selectedPerson.medical_status || "pending");
    setEditOrg(selectedPerson.organization || "");
    setEditOrgType(selectedPerson.organization_type || "");
    setEditError("");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPerson) return;
    setEditLoading(true);
    setEditError("");
    try {
      await personnelApi.edit({
        id: selectedPerson.id,
        full_name: editName.trim(),
        position: editPosition.trim(),
        department: editDept.trim(),
        category: editCategory,
        phone: editPhone.trim(),
        room: editRoom.trim(),
        shift: editShift,
        status: editStatus,
        medical_status: editMedical,
        organization: editOrg.trim(),
        organization_type: editOrgType,
      });
      const updated = {
        ...selectedPerson,
        full_name: editName.trim(),
        position: editPosition.trim(),
        department: editDept.trim(),
        category: editCategory,
        phone: editPhone.trim(),
        room: editRoom.trim(),
        shift: editShift,
        status: editStatus,
        medical_status: editMedical,
        organization: editOrg.trim(),
        organization_type: editOrgType,
      };
      setSelectedPerson(updated);
      setEditing(false);
      fetchData();
      const hRes = await personnelApi.getHistory(selectedPerson.id);
      setHistory(hRes.events || []);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setEditLoading(false);
    }
  };

  const openQrModal = (p: PersonnelItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQrPerson(p);
    setShowQrModal(true);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;
    const svgEl = printRef.current.querySelector("svg");
    const svgData = svgEl ? svgEl.outerHTML : "";
    const person = qrPerson;
    if (!person) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Бейдж — ${person.full_name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
        .badge { width: 320px; border: 2px solid #222; border-radius: 12px; padding: 24px; text-align: center; }
        .badge-header { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 16px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
        .badge-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
        .badge-position { font-size: 12px; color: #666; margin-bottom: 16px; }
        .badge-qr { margin: 16px auto; }
        .badge-qr svg { width: 200px; height: 200px; }
        .badge-code { font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 4px; margin: 12px 0; }
        .badge-dept { font-size: 11px; color: #888; }
        .badge-info { font-size: 10px; color: #aaa; margin-top: 12px; border-top: 1px solid #eee; padding-top: 8px; }
        @media print { body { background: white; } }
      </style>
      </head>
      <body>
        <div class="badge">
          <div class="badge-header">Горный контроль — Рудник Бадран</div>
          <div class="badge-name">${person.full_name}</div>
          <div class="badge-position">${person.position || "—"}</div>
          <div class="badge-qr">${svgData}</div>
          <div class="badge-code">${person.personal_code}</div>
          <div class="badge-dept">${person.department || ""}${person.organization ? " — " + person.organization : ""}</div>
          <div class="badge-info">Сканируйте QR для проверки данных</div>
        </div>
        <script>setTimeout(function(){ window.print(); }, 300);<${"/"}>script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const eventIcon = (type: string) => {
    const map: Record<string, { icon: string; color: string }> = {
      scan_checkin: { icon: "ScanLine", color: "text-mine-green" },
      scan_denied: { icon: "ShieldAlert", color: "text-mine-red" },
      medical_pass: { icon: "HeartPulse", color: "text-mine-green" },
      medical_fail: { icon: "HeartPulse", color: "text-mine-red" },
      arrival: { icon: "LogIn", color: "text-mine-cyan" },
      departure: { icon: "LogOut", color: "text-muted-foreground" },
      status_change: { icon: "RefreshCw", color: "text-mine-amber" },
      edit: { icon: "Pencil", color: "text-mine-cyan" },
      lantern_issued: { icon: "Flashlight", color: "text-mine-amber" },
      lantern_returned: { icon: "Flashlight", color: "text-mine-green" },
    };
    return map[type] || { icon: "Clock", color: "text-muted-foreground" };
  };

  return (
    <AppLayout title="Персонал" subtitle="Учёт и контроль сотрудников рудника">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Поиск по ФИО, коду, подразделению..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleOpenAdd}
          >
            <Icon name="UserPlus" size={14} />
            Добавить
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-mine-amber/20 bg-mine-amber/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-amber">{stats.mine ?? 0}</p>
            <p className="text-xs text-muted-foreground">Рудничных</p>
          </div>
          <div className="rounded-lg border border-mine-cyan/20 bg-mine-cyan/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-cyan">{stats.contractor ?? 0}</p>
            <p className="text-xs text-muted-foreground">Подрядчиков</p>
          </div>
          <div className="rounded-lg border border-mine-green/20 bg-mine-green/5 p-3 text-center">
            <p className="text-2xl font-bold text-mine-green">{stats.business_trip ?? 0}</p>
            <p className="text-xs text-muted-foreground">Командированных</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.guest ?? 0}</p>
            <p className="text-xs text-muted-foreground">Гостей</p>
          </div>
        </div>

        {stats.by_org_type && Object.keys(stats.by_org_type).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.by_org_type).map(([key, count]) => (
              <div key={key} className={`rounded-lg border p-3 text-center ${orgTypeColors[key] || "border-border bg-secondary/30"}`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs opacity-80">{orgTypeLabels[key] || key}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-mine-red/10 border border-mine-red/20">
            <Icon name="AlertTriangle" size={16} className="text-mine-red" />
            <p className="text-sm text-mine-red">{error}</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Код", "QR", "ФИО", "Организация", "Должность", "Подразделение", "Категория", "Медосмотр", "Статус", ""].map((h) => (
                      <th
                        key={h || "actions"}
                        className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {personnel.map((p, i) => {
                    const statusText = statusLabels[p.status] || p.status;
                    const categoryText = categoryLabels[p.category] || p.category;
                    const medText = medicalLabels[p.medical_status || "pending"] || p.medical_status;
                    return (
                      <tr
                        key={p.id || i}
                        className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                        onClick={() => openCard(p)}
                      >
                        <td className="px-4 py-3">
                          <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                            {p.personal_code}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => openQrModal(p, e)}
                            className="w-8 h-8 rounded bg-white p-0.5 hover:ring-2 ring-mine-cyan/50 transition-all"
                            title="Открыть QR-код"
                          >
                            <QRCodeSVG
                              value={p.personal_code}
                              size={28}
                              bgColor="#ffffff"
                              fgColor="#000000"
                              level="L"
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {p.full_name}
                        </td>
                        <td className="px-4 py-3">
                          {p.organization ? (
                            <div>
                              <p className="text-sm text-foreground truncate max-w-[140px]">{p.organization}</p>
                              {p.organization_type && (
                                <Badge variant="outline" className={`text-[10px] mt-0.5 ${orgTypeColors[p.organization_type] || ""}`}>
                                  {orgTypeLabels[p.organization_type] || p.organization_type}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {p.position}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {p.department}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[11px] ${categoryColors[categoryText] || ""}`}>
                            {categoryText}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[11px] ${medicalColors[p.medical_status || "pending"] || ""}`}>
                            {medText}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[11px] ${statusColors[statusText] || ""}`}>
                            {statusText}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCard(p);
                            }}
                          >
                            <Icon name="ChevronRight" size={16} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {personnel.length === 0 && !loading && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* === Карточка сотрудника === */}
      <Dialog open={showCard} onOpenChange={setShowCard}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Icon name="User" size={20} className="text-primary" />
              {editing ? "Редактирование" : selectedPerson?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedPerson && !editing && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex gap-5">
                <button
                  onClick={() => openQrModal(selectedPerson)}
                  className="flex-shrink-0 bg-white rounded-xl p-3 hover:ring-2 ring-mine-cyan/50 transition-all cursor-pointer"
                  title="Увеличить QR"
                >
                  <QRCodeSVG
                    value={buildQrPayload(selectedPerson)}
                    size={120}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </button>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-lg font-bold text-foreground">{selectedPerson.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedPerson.position || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Код</p>
                      <code className="text-sm font-mono font-bold text-mine-cyan">{selectedPerson.personal_code}</code>
                    </div>
                    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Подразделение</p>
                      <p className="text-sm font-medium text-foreground">{selectedPerson.department || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Категория</p>
                      <Badge variant="outline" className={`text-[11px] ${categoryColors[categoryLabels[selectedPerson.category] || ""] || ""}`}>
                        {categoryLabels[selectedPerson.category] || selectedPerson.category}
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Медосмотр</p>
                      <Badge variant="outline" className={`text-[11px] ${medicalColors[selectedPerson.medical_status || "pending"] || ""}`}>
                        {medicalLabels[selectedPerson.medical_status || "pending"]}
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Статус</p>
                      <Badge variant="outline" className={`text-[11px] ${statusColors[statusLabels[selectedPerson.status] || ""] || ""}`}>
                        {statusLabels[selectedPerson.status] || selectedPerson.status}
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Комната / Смена</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedPerson.room || "—"} / {selectedPerson.shift || "—"}
                      </p>
                    </div>
                  </div>
                  {(selectedPerson.organization || selectedPerson.phone) && (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedPerson.organization && (
                        <div className="rounded-lg border border-border bg-background/50 px-3 py-2 col-span-2">
                          <p className="text-[10px] text-muted-foreground">Организация</p>
                          <p className="text-sm font-medium text-foreground">
                            {selectedPerson.organization}
                            {selectedPerson.organization_type && (
                              <Badge variant="outline" className={`text-[10px] ml-2 ${orgTypeColors[selectedPerson.organization_type] || ""}`}>
                                {orgTypeLabels[selectedPerson.organization_type] || selectedPerson.organization_type}
                              </Badge>
                            )}
                          </p>
                        </div>
                      )}
                      {selectedPerson.phone && (
                        <div className="rounded-lg border border-border bg-background/50 px-3 py-2 col-span-2">
                          <p className="text-[10px] text-muted-foreground">Телефон</p>
                          <p className="text-sm font-medium text-foreground">{selectedPerson.phone}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={startEdit}>
                  <Icon name="Pencil" size={14} />
                  Редактировать
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-mine-cyan/30 text-mine-cyan hover:bg-mine-cyan/10"
                  onClick={() => openQrModal(selectedPerson)}
                >
                  <Icon name="QrCode" size={14} />
                  QR / Печать
                </Button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="History" size={16} className="text-mine-amber" />
                  <h4 className="text-sm font-semibold text-foreground">История действий</h4>
                </div>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет записей</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {history.map((ev) => {
                      const ei = eventIcon(ev.type);
                      return (
                        <div key={ev.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/30 transition-colors">
                          <div className={`w-7 h-7 rounded flex items-center justify-center bg-secondary/50 flex-shrink-0`}>
                            <Icon name={ei.icon} size={14} className={ei.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate">{ev.description}</p>
                            <p className="text-[10px] text-muted-foreground">{ev.type_label}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDate(ev.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedPerson && editing && (
            <div className="space-y-4 animate-fade-in">
              {editError && (
                <div className="p-3 rounded-lg bg-mine-red/10 border border-mine-red/20 text-mine-red text-sm flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} />
                  {editError}
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ФИО</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Должность</label>
                  <Input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} className="bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Подразделение</label>
                  <Input value={editDept} onChange={(e) => setEditDept(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Категория</label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mine">Рудничный</SelectItem>
                      <SelectItem value="contractor">Подрядчик</SelectItem>
                      <SelectItem value="business_trip">Командированный</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Смена</label>
                  <Select value={editShift || "none"} onValueChange={(v) => setEditShift(v === "none" ? "" : v)}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="A">Смена А</SelectItem>
                      <SelectItem value="B">Смена Б</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Статус</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_shift">На смене</SelectItem>
                      <SelectItem value="arrived">Прибыл</SelectItem>
                      <SelectItem value="departed">Убыл</SelectItem>
                      <SelectItem value="business_trip">Командировка</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Медосмотр</label>
                  <Select value={editMedical} onValueChange={setEditMedical}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passed">Пройден</SelectItem>
                      <SelectItem value="failed">Не пройден</SelectItem>
                      <SelectItem value="pending">Ожидает</SelectItem>
                      <SelectItem value="expiring">Истекает</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Организация</label>
                <Input value={editOrg} onChange={(e) => setEditOrg(e.target.value)} className="bg-secondary/50" placeholder="ООО «Рудник Бадран»" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Тип организации</label>
                  <Select value={editOrgType || "none"} onValueChange={(v) => setEditOrgType(v === "none" ? "" : v)}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="rudnik">Рудник</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                      <SelectItem value="contractor">Подрядная организация</SelectItem>
                      <SelectItem value="gov">Гос.органы</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Комната</label>
                  <Input value={editRoom} onChange={(e) => setEditRoom(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={editLoading}>
                  Отмена
                </Button>
                <Button
                  className="flex-1 gap-2 bg-mine-green text-white hover:bg-mine-green/90"
                  onClick={handleSaveEdit}
                  disabled={editLoading || !editName.trim()}
                >
                  {editLoading ? (
                    <><Icon name="Loader2" size={14} className="animate-spin" />Сохранение...</>
                  ) : (
                    <><Icon name="Check" size={14} />Сохранить</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === QR увеличенный + печать === */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Icon name="QrCode" size={20} className="text-mine-cyan" />
              QR-код сотрудника
            </DialogTitle>
          </DialogHeader>
          {qrPerson && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center">
                <p className="text-base font-bold text-foreground">{qrPerson.full_name}</p>
                <p className="text-sm text-muted-foreground">{qrPerson.position}</p>
                <code className="text-lg font-mono font-bold text-mine-cyan">{qrPerson.personal_code}</code>
              </div>
              <div className="flex justify-center" ref={printRef}>
                <div className="bg-white rounded-xl p-5">
                  <QRCodeSVG
                    value={buildQrPayload(qrPerson)}
                    size={240}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-[10px] text-muted-foreground mb-1">В QR зашито:</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Код:</span>
                  <span className="text-foreground font-mono">{qrPerson.personal_code}</span>
                  <span className="text-muted-foreground">Медосмотр:</span>
                  <span className={qrPerson.medical_status === "passed" ? "text-mine-green" : "text-mine-red"}>
                    {medicalLabels[qrPerson.medical_status || "pending"]}
                  </span>
                  <span className="text-muted-foreground">Статус:</span>
                  <span className="text-foreground">{statusLabels[qrPerson.status] || qrPerson.status}</span>
                  {qrPerson.organization && (
                    <>
                      <span className="text-muted-foreground">Организация:</span>
                      <span className="text-foreground">{qrPerson.organization}</span>
                    </>
                  )}
                </div>
              </div>
              <Button className="w-full gap-2 bg-mine-cyan text-white hover:bg-mine-cyan/90" onClick={handlePrint}>
                <Icon name="Printer" size={16} />
                Распечатать бейдж
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === Добавление сотрудника === */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Icon name="UserPlus" size={20} className="text-primary" />
              {addSuccess ? "Сотрудник добавлен" : "Новый сотрудник"}
            </DialogTitle>
          </DialogHeader>

          {addSuccess ? (
            <div className="space-y-5 animate-fade-in">
              <div className="rounded-xl border border-mine-green/20 bg-mine-green/5 p-5 glow-green">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-mine-green/20 flex items-center justify-center">
                    <Icon name="CheckCircle2" size={20} className="text-mine-green" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{addSuccess.full_name}</p>
                    <p className="text-xs text-mine-green">Успешно зарегистрирован</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Личный код</p>
                    <code className="text-lg font-mono font-bold text-mine-cyan">{addSuccess.personal_code}</code>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">QR-код</p>
                    <code className="text-lg font-mono font-bold text-mine-amber">{addSuccess.qr_code}</code>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white rounded-lg p-4">
                  <QRCodeSVG value={addSuccess.personal_code} size={180} bgColor="#ffffff" fgColor="#000000" level="M" />
                </div>
                <p className="text-xs text-muted-foreground text-center">Распечатайте QR-код для сотрудника</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={resetForm}>
                  <Icon name="UserPlus" size={14} />
                  Ещё одного
                </Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={() => setShowAdd(false)}>
                  Готово
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdd} className="space-y-4">
              {addError && (
                <div className="p-3 rounded-lg bg-mine-red/10 border border-mine-red/20 text-mine-red text-sm flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} />
                  {addError}
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ФИО *</label>
                <Input placeholder="Иванов Иван Иванович" value={formName} onChange={(e) => setFormName(e.target.value)} className="bg-secondary/50" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Должность</label>
                  <Input placeholder="Горнорабочий" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Подразделение</label>
                  <Input placeholder="Участок №1" value={formDept} onChange={(e) => setFormDept(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Категория *</label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mine">Рудничный</SelectItem>
                      <SelectItem value="contractor">Подрядчик</SelectItem>
                      <SelectItem value="business_trip">Командированный</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Смена</label>
                  <Select value={formShift || "none"} onValueChange={(v) => setFormShift(v === "none" ? "" : v)}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="A">Смена А</SelectItem>
                      <SelectItem value="B">Смена Б</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Наименование предприятия</label>
                <Input placeholder="ООО «Рудник Бадран»" value={formOrg} onChange={(e) => setFormOrg(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Тип организации</label>
                  <Select value={formOrgType || "none"} onValueChange={(v) => setFormOrgType(v === "none" ? "" : v)}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="rudnik">Рудник</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                      <SelectItem value="contractor">Подрядная организация</SelectItem>
                      <SelectItem value="gov">Гос.органы</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
                  <Input placeholder="+7 900 111-22-33" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Комната</label>
                  <Input placeholder="301" value={formRoom} onChange={(e) => setFormRoom(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <div className="rounded-lg border border-mine-cyan/20 bg-mine-cyan/5 p-3 flex items-start gap-2">
                <Icon name="Info" size={14} className="text-mine-cyan mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">Личный код и QR-код будут присвоены автоматически после добавления</p>
              </div>
              <Button type="submit" className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={addLoading || !formName.trim()}>
                {addLoading ? (
                  <><Icon name="Loader2" size={14} className="animate-spin" />Добавление...</>
                ) : (
                  <><Icon name="UserPlus" size={14} />Добавить сотрудника</>
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Personnel;
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Icon from "@/components/ui/icon";
import { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { personnelApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ResizableDialogContent from "@/components/personnel/ResizableDialogContent";
import AutoGrowInput from "@/components/personnel/AutoGrowInput";
import PhotoField from "@/components/personnel/PhotoField";
import HousingHistory from "@/components/personnel/HousingHistory";
import ResidenceSelect, { ResidenceValue } from "@/components/personnel/ResidenceSelect";
import PassFields, { PassValue, EMPTY_PASS, inspectionLabels, passPeriodLabel, isPassExpired } from "@/components/personnel/PassFields";
import AdminMedicalMarkDialog, { type MarkPerson } from "@/components/medical/AdminMedicalMarkDialog";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BadgeLayout = "2x5" | "2x4" | "2x3" | "1x4" | "3x5";
const layoutOptions: { value: BadgeLayout; label: string; cols: number; perPage: number }[] = [
  { value: "2x5", label: "2 × 5 — 10 шт/лист", cols: 2, perPage: 10 },
  { value: "2x4", label: "2 × 4 — 8 шт/лист", cols: 2, perPage: 8 },
  { value: "2x3", label: "2 × 3 — 6 шт/лист", cols: 2, perPage: 6 },
  { value: "3x5", label: "3 × 5 — 15 шт/лист", cols: 3, perPage: 15 },
  { value: "1x4", label: "1 × 4 — 4 шт/лист (крупные)", cols: 1, perPage: 4 },
];
type BadgeSize = "small" | "medium" | "large";
const sizeOptions: { value: BadgeSize; label: string; qr: number; namePx: number; codePx: number }[] = [
  { value: "small", label: "Маленький", qr: 100, namePx: 11, codePx: 13 },
  { value: "medium", label: "Средний", qr: 140, namePx: 13, codePx: 16 },
  { value: "large", label: "Крупный", qr: 200, namePx: 16, codePx: 20 },
];

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
  photo_url?: string;
  personal_code: string;
  is_protected?: boolean;
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
  tab_number?: string;
  residence?: string;
  residence_building_id?: number | null;
  residence_room_id?: number | null;
  pass_number?: string;
  pass_permanent?: boolean;
  pass_valid_from?: string;
  pass_valid_to?: string;
  inspection_mode?: string;
}

function growSpan(text: string, base: 1 | 2 = 1) {
  const len = (text || "").length;
  if (len > 56 || (base === 2 && len > 40)) return "sm:col-span-3";
  if (len > 24 || base === 2) return "sm:col-span-2";
  return "";
}

const inlineInput = "h-8 px-2 -mx-2 w-[calc(100%+1rem)] bg-transparent border-transparent shadow-none text-sm font-medium text-foreground hover:bg-secondary/40 hover:border-border focus:bg-secondary/50 focus-visible:ring-1 focus-visible:ring-mine-cyan/50 focus-visible:ring-offset-0 disabled:opacity-100 disabled:cursor-default disabled:hover:bg-transparent";

function CardField({ label, icon, action, className = "", children }: { label: string; icon?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-border bg-background/50 px-3 py-1.5 min-h-[62px] ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          {icon && <Icon name={icon} size={11} />}
          {label}
        </p>
        {action}
      </div>
      <div className="text-sm font-medium text-foreground break-words">{children}</div>
    </div>
  );
}

const EMPTY_RESIDENCE: ResidenceValue = { residence_building_id: null, residence_room_id: null };

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

function buildQrPayload(p: { personal_code: string; qr_code?: string }) {
  return p.qr_code || p.personal_code;
}

const PROTECTED_CODE = "АД-001";

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
  const [confirmClose, setConfirmClose] = useState(false);
  const { user: authUser } = useAuth();
  const isAdminUser = authUser?.role === "admin" && localStorage.getItem("mc_demo") !== "true";
  const [markPerson, setMarkPerson] = useState<MarkPerson | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrPerson, setQrPerson] = useState<PersonnelItem | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [printLayout, setPrintLayout] = useState<BadgeLayout>(() => {
    const saved = localStorage.getItem("badge_layout");
    return (saved as BadgeLayout) || "2x5";
  });
  const [printSize, setPrintSize] = useState<BadgeSize>(() => {
    const saved = localStorage.getItem("badge_size");
    return (saved as BadgeSize) || "medium";
  });
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  const [formName, setFormName] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formCategory, setFormCategory] = useState("mine");
  const [formPhone, setFormPhone] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formResidence, setFormResidence] = useState<ResidenceValue>(EMPTY_RESIDENCE);
  const [formPass, setFormPass] = useState<PassValue>(EMPTY_PASS);
  const [formShift, setFormShift] = useState("");
  const [formOrg, setFormOrg] = useState("");
  const [formOrgType, setFormOrgType] = useState("");
  const [formTabNum, setFormTabNum] = useState("");
  const [formPhoto, setFormPhoto] = useState("");

  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [editResidence, setEditResidence] = useState<ResidenceValue>(EMPTY_RESIDENCE);
  const [editPass, setEditPass] = useState<PassValue>(EMPTY_PASS);
  const [editShift, setEditShift] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editMedical, setEditMedical] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editOrgType, setEditOrgType] = useState("");
  const [editTabNum, setEditTabNum] = useState("");

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
    setFormResidence(EMPTY_RESIDENCE);
    setFormPass(EMPTY_PASS);
    setFormShift("");
    setFormOrg("");
    setFormOrgType("");
    setFormTabNum("");
    setFormPhoto("");
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
        tabular_number: formTabNum.trim(),
        ...formResidence,
        ...formPass,
      });
      let photoFailed = false;
      if (formPhoto && res.id) {
        try {
          await personnelApi.uploadPhoto({ personnel_id: res.id, photo: formPhoto });
        } catch {
          photoFailed = true;
        }
      }
      if (photoFailed) setAddError("Сотрудник добавлен, но фото не сохранилось — добавьте его в карточке");
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
    fillEdit(p);
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

  const fillEdit = (person: PersonnelItem) => {
    const selectedPerson = person;
    setEditName(selectedPerson.full_name);
    setEditPosition(selectedPerson.position);
    setEditDept(selectedPerson.department);
    setEditCategory(selectedPerson.category);
    setEditPhone(selectedPerson.phone || "");
    setEditRoom(selectedPerson.room || "");
    setEditResidence({
      residence_building_id: selectedPerson.residence_building_id ?? null,
      residence_room_id: selectedPerson.residence_room_id ?? null,
    });
    setEditPass({
      pass_number: selectedPerson.pass_number || "",
      pass_permanent: !!selectedPerson.pass_permanent,
      pass_valid_from: selectedPerson.pass_valid_from || "",
      pass_valid_to: selectedPerson.pass_valid_to || "",
      inspection_mode: selectedPerson.inspection_mode || "general",
    });
    setEditShift(selectedPerson.shift || "");
    setEditStatus(selectedPerson.status);
    setEditMedical(selectedPerson.medical_status || "pending");
    setEditOrg(selectedPerson.organization || "");
    setEditOrgType(selectedPerson.organization_type || "");
    setEditTabNum(selectedPerson.tab_number || "");
    setEditError("");
    setSavedFlash(false);
  };

  const handleMedicalChange = (val: string) => {
    setEditMedical(val);
    if (val === "failed" || val === "pending") {
      setEditShift("");
    }
  };

  const handleSaveEdit = async (): Promise<boolean> => {
    if (!selectedPerson) return false;
    setEditLoading(true);
    setEditError("");
    const finalShift = (editMedical === "failed" || editMedical === "pending") ? "" : editShift;
    try {
      const editRes = await personnelApi.edit({
        id: selectedPerson.id,
        full_name: editName.trim(),
        position: editPosition.trim(),
        department: editDept.trim(),
        category: editCategory,
        phone: editPhone.trim(),
        room: editRoom.trim(),
        shift: finalShift,
        status: editStatus,
        medical_status: editMedical,
        organization: editOrg.trim(),
        organization_type: editOrgType,
        tab_number: editTabNum.trim(),
        ...editResidence,
        ...editPass,
      });
      const updated = {
        ...selectedPerson,
        full_name: editName.trim(),
        position: editPosition.trim(),
        department: editDept.trim(),
        category: editCategory,
        phone: editPhone.trim(),
        room: editRoom.trim(),
        shift: finalShift,
        status: editStatus,
        medical_status: editMedical,
        organization: editOrg.trim(),
        organization_type: editOrgType,
        tab_number: editTabNum.trim(),
      };
      const saved = { ...updated, ...editResidence, ...editPass, residence: editRes?.residence ?? updated.residence };
      setSelectedPerson(saved);
      fillEdit(saved);
      setSavedFlash(true);
      fetchData();
      personnelApi.getHistory(selectedPerson.id).then((hRes) => setHistory(hRes.events || [])).catch(() => {});
      return true;
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Ошибка сохранения");
      return false;
    } finally {
      setEditLoading(false);
    }
  };

  const shiftBlocked = editMedical === "failed" || editMedical === "pending";
  const cardLocked = !!selectedPerson && (selectedPerson.is_protected || selectedPerson.personal_code === PROTECTED_CODE) && !isAdminUser;
  const passInvalid = !editPass.pass_permanent && !!editPass.pass_valid_from && !!editPass.pass_valid_to && editPass.pass_valid_from > editPass.pass_valid_to;
  const isDirty = !!selectedPerson && (
    editName !== selectedPerson.full_name ||
    editPosition !== (selectedPerson.position || "") ||
    editDept !== (selectedPerson.department || "") ||
    editCategory !== selectedPerson.category ||
    editPhone !== (selectedPerson.phone || "") ||
    editRoom !== (selectedPerson.room || "") ||
    editShift !== (selectedPerson.shift || "") ||
    editStatus !== selectedPerson.status ||
    editMedical !== (selectedPerson.medical_status || "pending") ||
    editOrg !== (selectedPerson.organization || "") ||
    editOrgType !== (selectedPerson.organization_type || "") ||
    editTabNum !== (selectedPerson.tab_number || "") ||
    editResidence.residence_room_id !== (selectedPerson.residence_room_id ?? null) ||
    editResidence.residence_building_id !== (selectedPerson.residence_building_id ?? null) ||
    editPass.pass_number !== (selectedPerson.pass_number || "") ||
    editPass.pass_permanent !== !!selectedPerson.pass_permanent ||
    editPass.pass_valid_from !== (selectedPerson.pass_valid_from || "") ||
    editPass.pass_valid_to !== (selectedPerson.pass_valid_to || "") ||
    editPass.inspection_mode !== (selectedPerson.inspection_mode || "general")
  );

  const requestCloseCard = (open: boolean) => {
    if (open) return setShowCard(true);
    if (isDirty && !cardLocked) return setConfirmClose(true);
    setShowCard(false);
  };

  const saveAndClose = async () => {
    const ok = await handleSaveEdit();
    setConfirmClose(false);
    if (ok) setShowCard(false);
  };

  const discardAndClose = () => {
    if (selectedPerson) fillEdit(selectedPerson);
    setConfirmClose(false);
    setShowCard(false);
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
          <div class="badge-header">Горный контроль</div>
          <div class="badge-name">${person.full_name}</div>
          <div class="badge-position">${person.position || "—"}</div>
          <div class="badge-qr">${svgData}</div>
          <div class="badge-dept">${person.department || ""}${person.organization ? " — " + person.organization : ""}</div>
          <div class="badge-info">Сканируйте QR для проверки данных</div>
        </div>
        <script>setTimeout(function(){ window.print(); }, 300);<${"/"}>script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const toggleSelect = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === personnel.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(personnel.map((p) => p.id)));
    }
  };

  const handleBatchPrint = () => {
    const selected = personnel.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;

    const layout = layoutOptions.find((l) => l.value === printLayout) || layoutOptions[0];
    const size = sizeOptions.find((s) => s.value === printSize) || sizeOptions[1];

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const escapeHtml = (str: string) =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const renderQrSvg = (value: string, qrSize: number): string => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      flushSync(() => {
        root.render(<QRCodeSVG value={value} size={qrSize} level="L" />);
      });
      const svg = container.querySelector("svg");
      const markup = svg ? svg.outerHTML : "";
      root.unmount();
      document.body.removeChild(container);
      return markup;
    };

    const badgeHtml = (person: PersonnelItem) => {
      const qrValue = buildQrPayload(person);
      const svgMarkup = renderQrSvg(qrValue, size.qr);

      return `
        <div class="badge">
          <div class="badge-header">Горный контроль</div>
          <div class="badge-name">${escapeHtml(person.full_name)}</div>
          <div class="badge-position">${escapeHtml(person.position || "—")}</div>
          <div class="badge-qr">${svgMarkup}</div>
          <div class="badge-dept">${escapeHtml(person.department || "")}${person.organization ? " — " + escapeHtml(person.organization) : ""}</div>
          <div class="badge-info">Сканируйте QR для проверки данных</div>
        </div>
      `;
    };

    const badges = selected.map(badgeHtml).join("\n");
    const cols = layout.cols;
    const perPage = layout.perPage;
    const gapPx = cols === 1 ? 16 : cols === 3 ? 6 : 10;
    const padPx = cols === 1 ? "10px 30px" : cols === 3 ? "6px 8px" : "8px 16px";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-бейджи — ${selected.length} шт.</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; background: #fff; }
          .page-title { text-align: center; padding: 16px 0 8px; font-size: 14px; color: #888; }
          .grid {
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: ${gapPx}px;
            padding: ${padPx};
            max-width: 210mm;
            margin: 0 auto;
          }
          .badge {
            border: 1.5px solid #333;
            border-radius: 10px;
            padding: ${cols === 3 ? "8px 6px" : "12px 10px"};
            text-align: center;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .badge-header {
            font-size: ${cols === 3 ? "6px" : "8px"};
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #666;
            margin-bottom: ${cols === 3 ? "4px" : "8px"};
            border-bottom: 1px solid #ddd;
            padding-bottom: ${cols === 3 ? "3px" : "5px"};
          }
          .badge-name {
            font-size: ${size.namePx}px;
            font-weight: bold;
            margin-bottom: 2px;
            line-height: 1.2;
          }
          .badge-position {
            font-size: ${Math.max(size.namePx - 4, 8)}px;
            color: #666;
            margin-bottom: ${cols === 3 ? "4px" : "8px"};
          }
          .badge-qr {
            display: flex;
            justify-content: center;
            margin: ${cols === 3 ? "3px" : "6px"} auto;
          }
          .badge-qr svg {
            width: ${size.qr}px;
            height: ${size.qr}px;
          }
          .badge-code {
            font-size: ${size.codePx}px;
            font-weight: bold;
            font-family: monospace;
            letter-spacing: 3px;
            margin: ${cols === 3 ? "3px" : "6px"} 0;
          }
          .badge-dept {
            font-size: ${cols === 3 ? "7px" : "8px"};
            color: #888;
          }
          .badge-info {
            font-size: ${cols === 3 ? "6px" : "7px"};
            color: #aaa;
            margin-top: ${cols === 3 ? "3px" : "6px"};
            border-top: 1px solid #eee;
            padding-top: ${cols === 3 ? "3px" : "5px"};
          }
          @media print {
            body { background: white; }
            .page-title { display: none; }
            .no-print { display: none !important; }
            .grid { padding: 3mm 8mm; gap: ${Math.max(gapPx - 2, 4)}px; }
            .badge:nth-child(${perPage}n+1) { break-before: ${perPage > 0 ? "auto" : "page"}; }
            @page { size: A4 portrait; margin: 5mm; }
          }
        </style>
      </head>
      <body>
        <div class="page-title no-print">Бейджи: ${selected.length} шт. | Раскладка: ${layout.label} | Размер: ${size.label}</div>
        <div class="grid">${badges}</div>
        <script>setTimeout(function(){ window.print(); }, 300);</${"script"}>
      </body>
      </html>
    `);
    printWindow.document.close();
    setShowPrintSettings(false);
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
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Popover open={showPrintSettings} onOpenChange={setShowPrintSettings}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-2 bg-mine-cyan text-white hover:bg-mine-cyan/90"
                  >
                    <Icon name="Printer" size={14} />
                    Печать QR ({selectedIds.size})
                    <Icon name="ChevronDown" size={12} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <div className="space-y-4">
                    <p className="text-sm font-medium">Настройки печати</p>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Раскладка на листе A4</label>
                      <div className="grid gap-1.5">
                        {layoutOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setPrintLayout(opt.value); localStorage.setItem("badge_layout", opt.value); }}
                            className={`text-left text-sm px-3 py-1.5 rounded-md border transition-colors ${
                              printLayout === opt.value
                                ? "bg-mine-cyan/10 border-mine-cyan/40 text-mine-cyan"
                                : "border-border hover:bg-secondary/50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Размер бейджа</label>
                      <div className="flex gap-2">
                        {sizeOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setPrintSize(opt.value); localStorage.setItem("badge_size", opt.value); }}
                            className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                              printSize === opt.value
                                ? "bg-mine-cyan/10 border-mine-cyan/40 text-mine-cyan"
                                : "border-border hover:bg-secondary/50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-mine-cyan text-white hover:bg-mine-cyan/90"
                      onClick={handleBatchPrint}
                    >
                      <Icon name="Printer" size={14} />
                      Печатать {selectedIds.size} бейджей
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button
              size="sm"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleOpenAdd}
            >
              <Icon name="UserPlus" size={14} />
              Добавить
            </Button>
          </div>
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
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={personnel.length > 0 && selectedIds.size === personnel.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border accent-mine-cyan cursor-pointer"
                      />
                    </th>
                    {[...(isAdminUser ? ["Код"] : []), "QR", "ФИО", "Таб. №", "Организация", "Должность", "Подразделение", "Категория", "Медосмотр", "Статус", ""].map((h) => (
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
                        className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in ${selectedIds.has(p.id) ? "bg-mine-cyan/5" : ""}`}
                        style={{ animationDelay: `${i * 30}ms` }}
                        onClick={() => openCard(p)}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            disabled={p.is_protected || p.personal_code === PROTECTED_CODE}
                            className="w-4 h-4 rounded border-border accent-mine-cyan cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                        {isAdminUser && (
                          <td className="px-4 py-3">
                            <code className="text-xs text-red-500 font-mono bg-red-500/10 px-1.5 py-0.5 rounded">
                              {p.personal_code}
                            </code>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => openQrModal(p, e)}
                            className="w-8 h-8 rounded bg-white p-0.5 hover:ring-2 ring-mine-cyan/50 transition-all"
                            title="Открыть QR-код"
                          >
                            <QRCodeSVG
                              value={buildQrPayload(p)}
                              size={28}
                              bgColor="#ffffff"
                              fgColor="#000000"
                              level="L"
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          <div className="flex items-center gap-2.5">
                            {p.photo_url ? (
                              <img
                                src={p.photo_url}
                                alt=""
                                loading="lazy"
                                className="w-9 h-9 rounded-md object-cover border border-border shrink-0"
                              />
                            ) : (
                              <div
                                className="w-9 h-9 rounded-md bg-mine-red/10 border border-mine-red/30 flex items-center justify-center shrink-0"
                                title="Нет фото"
                              >
                                <span className="text-mine-red text-2xl font-black leading-none">?</span>
                              </div>
                            )}
                            <span>{p.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {p.tab_number || "—"}
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
                          {isAdminUser ? (
                            <button
                              type="button"
                              title="Отметить медосмотр"
                              onClick={(e) => { e.stopPropagation(); setMarkPerson(p); }}
                              className="rounded-full hover:ring-2 hover:ring-mine-green/30 transition-shadow"
                            >
                              <Badge variant="outline" className={`text-[11px] cursor-pointer gap-1 ${medicalColors[p.medical_status || "pending"] || ""}`}>
                                {medText}
                                <Icon name="Pencil" size={9} />
                              </Badge>
                            </button>
                          ) : (
                            <Badge variant="outline" className={`text-[11px] ${medicalColors[p.medical_status || "pending"] || ""}`}>
                              {medText}
                            </Badge>
                          )}
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
                      <td colSpan={isAdminUser ? 12 : 11} className="px-4 py-12 text-center text-sm text-muted-foreground">
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
      <AlertDialog open={confirmClose} onOpenChange={(o) => { if (!o && !editLoading) setConfirmClose(false); }}>
        <AlertDialogContent className="bg-card border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Сохранить изменения?</AlertDialogTitle>
            <AlertDialogDescription>
              В карточке «{selectedPerson?.full_name}» есть несохранённые изменения.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setConfirmClose(false)} disabled={editLoading}>
              Отмена
            </Button>
            <Button variant="outline" className="border-mine-red/30 text-mine-red hover:bg-mine-red/10 hover:text-mine-red" onClick={discardAndClose} disabled={editLoading}>
              Не сохранять
            </Button>
            <Button className="gap-2 bg-mine-green text-white hover:bg-mine-green/90" onClick={saveAndClose} disabled={editLoading || !editName.trim() || passInvalid}>
              {editLoading && <Icon name="Loader2" size={14} className="animate-spin" />}
              Сохранить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCard} onOpenChange={requestCloseCard}>
        <ResizableDialogContent storageKey="personnel-card-size" className="bg-card border-border sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Icon name="User" size={20} className="text-primary" />
              {selectedPerson?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedPerson && (
            <div className="space-y-5 animate-fade-in">
              {editError && (
                <div className="p-3 rounded-lg bg-mine-red/10 border border-mine-red/20 text-mine-red text-sm flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} />
                  {editError}
                </div>
              )}
              {cardLocked && (
                <div className="p-3 rounded-lg bg-secondary/40 border border-border text-muted-foreground text-xs flex items-center gap-2">
                  <Icon name="Lock" size={14} />
                  Данные администратора защищены от изменений
                </div>
              )}
              <fieldset disabled={cardLocked || editLoading} className="space-y-5 min-w-0">
              <div className="flex gap-5 flex-wrap sm:flex-nowrap">
                <div className="flex sm:flex-col gap-3 flex-shrink-0 self-start items-center">
                  <PhotoField
                    key={selectedPerson.id}
                    personnelId={selectedPerson.id}
                    photoUrl={selectedPerson.photo_url}
                    disabled={cardLocked}
                    size={120}
                    onChange={(url) => {
                      setSelectedPerson((prev) => (prev ? { ...prev, photo_url: url } : prev));
                      setPersonnel((list) => list.map((x) => (x.id === selectedPerson.id ? { ...x, photo_url: url } : x)));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => openQrModal(selectedPerson)}
                    className="bg-white rounded-xl p-2 hover:ring-2 ring-mine-cyan/50 transition-all cursor-pointer"
                    title="Увеличить QR"
                  >
                    <QRCodeSVG value={buildQrPayload(selectedPerson)} size={104} bgColor="#ffffff" fgColor="#000000" level="L" />
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <CardField label="ФИО" className="sm:col-span-2">
                      <AutoGrowInput value={editName} onChange={setEditName} className="text-base font-bold" />
                    </CardField>
                    <CardField label="Должность" className="sm:col-span-2">
                      <AutoGrowInput value={editPosition} onChange={setEditPosition} placeholder="—" />
                    </CardField>
                    {isAdminUser && (
                      <CardField label="Код">
                        <code className="text-sm font-mono font-bold text-red-500 leading-8">{selectedPerson.personal_code}</code>
                      </CardField>
                    )}
                    <CardField label="Табельный №" className={editTabNum.length > 18 ? "sm:col-span-2" : ""}>
                      <AutoGrowInput value={editTabNum} onChange={setEditTabNum} className="font-mono" placeholder="—" />
                    </CardField>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 grid-flow-row-dense">
                <CardField label="Статус">
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className={inlineInput}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_shift">На смене</SelectItem>
                      <SelectItem value="arrived">Прибыл</SelectItem>
                      <SelectItem value="departed">Убыл</SelectItem>
                      <SelectItem value="business_trip">Командировка</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
                <CardField
                  label="Медосмотр"
                  action={isAdminUser && (
                    <button
                      type="button"
                      onClick={() => setMarkPerson(selectedPerson)}
                      className="text-[10px] text-mine-green hover:underline inline-flex items-center gap-1"
                    >
                      <Icon name="HeartPulse" size={10} />
                      Отметить
                    </button>
                  )}
                >
                  <Select value={editMedical} onValueChange={handleMedicalChange}>
                    <SelectTrigger className={inlineInput}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passed">Пройден</SelectItem>
                      <SelectItem value="failed">Не пройден</SelectItem>
                      <SelectItem value="pending">Ожидает</SelectItem>
                      <SelectItem value="expiring">Истекает</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
                <CardField label="Смена">
                  <Select
                    value={shiftBlocked ? "none" : editShift || "none"}
                    onValueChange={(v) => setEditShift(v === "none" ? "" : v)}
                    disabled={shiftBlocked}
                  >
                    <SelectTrigger className={`${inlineInput} ${shiftBlocked ? "opacity-50" : ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="A">Смена А</SelectItem>
                      <SelectItem value="B">Смена Б</SelectItem>
                    </SelectContent>
                  </Select>
                  {shiftBlocked && <p className="text-[10px] text-mine-red">Медосмотр не пройден</p>}
                </CardField>
                <CardField label="Подразделение" className={growSpan(editDept)}>
                  <AutoGrowInput value={editDept} onChange={setEditDept} placeholder="—" />
                </CardField>
                <CardField label="Категория">
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger className={inlineInput}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mine">Рудничный</SelectItem>
                      <SelectItem value="contractor">Подрядчик</SelectItem>
                      <SelectItem value="business_trip">Командированный</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
                <CardField label="Телефон" className={growSpan(editPhone)}>
                  <AutoGrowInput value={editPhone} onChange={setEditPhone} placeholder="—" />
                </CardField>
                <CardField label="Организация" className={growSpan(editOrg, 2)}>
                  <AutoGrowInput value={editOrg} onChange={setEditOrg} placeholder="—" />
                </CardField>
                <CardField label="Тип организации">
                  <Select value={editOrgType || "none"} onValueChange={(v) => setEditOrgType(v === "none" ? "" : v)}>
                    <SelectTrigger className={inlineInput}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="rudnik">Рудник</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                      <SelectItem value="contractor">Подрядная организация</SelectItem>
                      <SelectItem value="gov">Гос.органы</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
                <CardField label="Место проживания" icon="Home" className="sm:col-span-2">
                  <ResidenceSelect value={editResidence} onChange={setEditResidence} compact />
                </CardField>
                <CardField label="Комната" className={growSpan(editRoom)}>
                  <AutoGrowInput value={editRoom} onChange={setEditRoom} placeholder="—" />
                </CardField>
                <CardField label="№ пропуска" icon="CreditCard" className={growSpan(editPass.pass_number)}>
                  <AutoGrowInput value={editPass.pass_number} onChange={(v) => setEditPass({ ...editPass, pass_number: v })} className="font-mono" placeholder="—" />
                </CardField>
                <CardField
                  label="Действие пропуска"
                  icon="CalendarRange"
                  action={
                    <label className="flex items-center gap-1 text-[10px] text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPass.pass_permanent}
                        onChange={(e) => setEditPass({ ...editPass, pass_permanent: e.target.checked })}
                        className="w-3 h-3 accent-mine-cyan cursor-pointer"
                      />
                      Постоянно
                    </label>
                  }
                >
                  {editPass.pass_permanent ? (
                    <p className="text-sm text-mine-green leading-8">Постоянно</p>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input type="date" value={editPass.pass_valid_from} onChange={(e) => setEditPass({ ...editPass, pass_valid_from: e.target.value })} className={`${inlineInput} px-1 text-xs`} title="Начало" />
                      <span className="text-muted-foreground text-xs">—</span>
                      <Input type="date" value={editPass.pass_valid_to} min={editPass.pass_valid_from || undefined} onChange={(e) => setEditPass({ ...editPass, pass_valid_to: e.target.value })} className={`${inlineInput} px-1 text-xs ${isPassExpired(editPass) ? "text-mine-red" : ""}`} title="Окончание" />
                    </div>
                  )}
                  {isPassExpired(editPass) && <p className="text-[10px] text-mine-red">Пропуск истёк</p>}
                </CardField>
                <CardField label="Досмотр" icon="ShieldCheck">
                  <Select value={editPass.inspection_mode} onValueChange={(v) => setEditPass({ ...editPass, inspection_mode: v })}>
                    <SelectTrigger className={`${inlineInput} ${editPass.inspection_mode === "none" ? "text-mine-amber" : ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">{inspectionLabels.general}</SelectItem>
                      <SelectItem value="none">{inspectionLabels.none}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
              </div>
              </fieldset>

              <div className="flex gap-2 sticky -bottom-6 bg-card py-3 -mb-6 z-10">
                {isDirty ? (
                  <>
                    <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => fillEdit(selectedPerson)} disabled={editLoading}>
                      <Icon name="Undo2" size={14} />
                      Отменить изменения
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 gap-2 bg-mine-green text-white hover:bg-mine-green/90"
                      onClick={handleSaveEdit}
                      disabled={editLoading || !editName.trim() || passInvalid}
                    >
                      {editLoading ? (
                        <><Icon name="Loader2" size={14} className="animate-spin" />Сохранение...</>
                      ) : (
                        <><Icon name="Check" size={14} />Сохранить</>
                      )}
                    </Button>
                  </>
                ) : (
                  <p className="flex-1 text-xs text-muted-foreground flex items-center gap-1.5">
                    {savedFlash ? (
                      <span className="text-mine-green flex items-center gap-1.5"><Icon name="CheckCircle2" size={14} />Изменения сохранены</span>
                    ) : (
                      <><Icon name="MousePointerClick" size={14} />Нажмите на любое поле, чтобы изменить его</>
                    )}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-mine-cyan/30 text-mine-cyan hover:bg-mine-cyan/10"
                  onClick={() => openQrModal(selectedPerson)}
                >
                  <Icon name="QrCode" size={14} />
                  QR / Печать
                </Button>
              </div>

              <HousingHistory personnelId={selectedPerson.id} refreshKey={selectedPerson.residence_room_id} />

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
        </ResizableDialogContent>
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
                {isAdminUser && <code className="text-lg font-mono font-bold text-red-500">{qrPerson.personal_code}</code>}
              </div>
              <div className="flex justify-center" ref={printRef}>
                <div className="bg-white rounded-xl p-5">
                  <QRCodeSVG
                    value={buildQrPayload(qrPerson)}
                    size={240}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="L"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="grid grid-cols-2 gap-1 text-xs">
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
        <ResizableDialogContent storageKey="personnel-add-size" defaultWidth={720} minWidth={480} className="bg-card border-border sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Icon name="UserPlus" size={20} className="text-primary" />
              {addSuccess ? "Сотрудник добавлен" : "Новый сотрудник"}
            </DialogTitle>
          </DialogHeader>

          {addSuccess ? (
            <div className="space-y-5 animate-fade-in">
              {addError && (
                <div className="p-3 rounded-lg bg-mine-amber/10 border border-mine-amber/20 text-mine-amber text-sm flex items-center gap-2">
                  <Icon name="AlertTriangle" size={14} />
                  {addError}
                </div>
              )}
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
                {isAdminUser && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Личный код</p>
                    <code className="text-lg font-mono font-bold text-red-500">{addSuccess.personal_code}</code>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white rounded-lg p-4">
                  <QRCodeSVG value={buildQrPayload(addSuccess)} size={180} bgColor="#ffffff" fgColor="#000000" level="M" />
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
              <div className="flex gap-4 flex-wrap sm:flex-nowrap">
              <PhotoField photoUrl={formPhoto} size={120} onPick={setFormPhoto} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 grid-flow-row-dense flex-1 min-w-0 content-start">
                <CardField label="ФИО *" className="sm:col-span-3">
                  <AutoGrowInput value={formName} onChange={setFormName} placeholder="Иванов Иван Иванович" className="text-base font-bold" />
                </CardField>
                <CardField label="Должность" className={growSpan(formPosition)}>
                  <AutoGrowInput value={formPosition} onChange={setFormPosition} placeholder="Горнорабочий" />
                </CardField>
                <CardField label="Подразделение" className={growSpan(formDept)}>
                  <AutoGrowInput value={formDept} onChange={setFormDept} placeholder="Участок №1" />
                </CardField>
                <CardField label="Табельный №" className={formTabNum.length > 18 ? "sm:col-span-2" : ""}>
                  <AutoGrowInput value={formTabNum} onChange={setFormTabNum} placeholder="001234" className="font-mono" />
                </CardField>
                <CardField label="Категория *">
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger className={inlineInput}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mine">Рудничный</SelectItem>
                      <SelectItem value="contractor">Подрядчик</SelectItem>
                      <SelectItem value="business_trip">Командированный</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
                <CardField label="Смена">
                  <Select value={formShift || "none"} onValueChange={(v) => setFormShift(v === "none" ? "" : v)}>
                    <SelectTrigger className={inlineInput}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="A">Смена А</SelectItem>
                      <SelectItem value="B">Смена Б</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
                <CardField label="Телефон" className={growSpan(formPhone)}>
                  <AutoGrowInput value={formPhone} onChange={setFormPhone} placeholder="+7 900 111-22-33" />
                </CardField>
                <CardField label="Организация" className={growSpan(formOrg, 2)}>
                  <AutoGrowInput value={formOrg} onChange={setFormOrg} placeholder="Название организации" />
                </CardField>
                <CardField label="Тип организации">
                  <Select value={formOrgType || "none"} onValueChange={(v) => setFormOrgType(v === "none" ? "" : v)}>
                    <SelectTrigger className={inlineInput}><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="rudnik">Рудник</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                      <SelectItem value="contractor">Подрядная организация</SelectItem>
                      <SelectItem value="gov">Гос.органы</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
                <CardField label="Место проживания" icon="Home" className="sm:col-span-3">
                  <ResidenceSelect value={formResidence} onChange={setFormResidence} compact />
                </CardField>
                <CardField label="Пропуск" icon="CreditCard" className="sm:col-span-3">
                  <div className="pt-1 pb-1">
                    <PassFields value={formPass} onChange={setFormPass} />
                  </div>
                </CardField>
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
        </ResizableDialogContent>
      </Dialog>
      {isAdminUser && (
        <AdminMedicalMarkDialog
          person={markPerson}
          onClose={() => setMarkPerson(null)}
          onMarked={async (id, status) => {
            setSelectedPerson((prev) => (prev && prev.id === id ? { ...prev, medical_status: status } : prev));
            if (selectedPerson?.id === id) setEditMedical(status);
            fetchData();
            try {
              const res = await personnelApi.getHistory(id);
              setHistory(res.events || []);
            } catch { /* ignore */ }
          }}
        />
      )}
    </AppLayout>
  );
};

export default Personnel;
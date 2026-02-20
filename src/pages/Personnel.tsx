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
import { useState, useEffect, useCallback } from "react";
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
  "прибыл": "bg-mine-cyan/20 text-mine-cyan border-mine-cyan/30",
  "убыл": "bg-muted text-muted-foreground border-border",
  "командировка": "bg-mine-amber/20 text-mine-amber border-mine-amber/30",
};

const categoryColors: Record<string, string> = {
  "Рудничный": "bg-mine-amber/15 text-mine-amber border-mine-amber/25",
  "Подрядчик": "bg-mine-cyan/15 text-mine-cyan border-mine-cyan/25",
  "Командированный": "bg-mine-green/15 text-mine-green border-mine-green/25",
  "Гость": "bg-secondary text-muted-foreground border-border",
};

interface PersonnelItem {
  id?: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  category: string;
  room?: string;
  status: string;
  phone?: string;
  qr_code?: string;
}

interface StatsData {
  mine?: number;
  contractor?: number;
  business_trip?: number;
  guest?: number;
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
  } | null>(null);

  const [formName, setFormName] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formCategory, setFormCategory] = useState("mine");
  const [formPhone, setFormPhone] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formShift, setFormShift] = useState("");

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
        // keep current
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
      });
      setAddSuccess({
        personal_code: res.personal_code,
        qr_code: res.qr_code,
      });
      fetchData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Ошибка добавления");
    } finally {
      setAddLoading(false);
    }
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
                    {["Код", "ФИО", "Должность", "Подразделение", "Категория", "Комната", "Статус"].map((h) => (
                      <th
                        key={h}
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
                    return (
                      <tr
                        key={p.personal_code || i}
                        className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <td className="px-4 py-3">
                          <code className="text-xs text-mine-cyan font-mono bg-mine-cyan/10 px-1.5 py-0.5 rounded">
                            {p.personal_code}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {p.full_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {p.position}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {p.department}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${categoryColors[categoryText] || ""}`}
                          >
                            {categoryText}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {p.room || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${statusColors[statusText] || ""}`}
                          >
                            {statusText}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {personnel.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
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
                    <p className="text-sm font-semibold text-foreground">{formName}</p>
                    <p className="text-xs text-mine-green">Успешно зарегистрирован</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Личный код</p>
                    <code className="text-lg font-mono font-bold text-mine-cyan">
                      {addSuccess.personal_code}
                    </code>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">QR-код</p>
                    <code className="text-lg font-mono font-bold text-mine-amber">
                      {addSuccess.qr_code}
                    </code>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="bg-white rounded-lg p-4">
                  <QRCodeSVG
                    value={addSuccess.qr_code}
                    size={180}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Распечатайте QR-код для сотрудника
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    resetForm();
                  }}
                >
                  <Icon name="UserPlus" size={14} />
                  Ещё одного
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={() => setShowAdd(false)}
                >
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
                <label className="text-xs text-muted-foreground mb-1 block">
                  ФИО *
                </label>
                <Input
                  placeholder="Иванов Иван Иванович"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="bg-secondary/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Должность
                  </label>
                  <Input
                    placeholder="Горнорабочий"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Подразделение
                  </label>
                  <Input
                    placeholder="Участок №1"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Категория *
                  </label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mine">Рудничный</SelectItem>
                      <SelectItem value="contractor">Подрядчик</SelectItem>
                      <SelectItem value="business_trip">Командированный</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Смена
                  </label>
                  <Select value={formShift} onValueChange={setFormShift}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Смена А</SelectItem>
                      <SelectItem value="B">Смена Б</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Телефон
                  </label>
                  <Input
                    placeholder="+7 900 111-22-33"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Комната
                  </label>
                  <Input
                    placeholder="301"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-mine-cyan/20 bg-mine-cyan/5 p-3 flex items-start gap-2">
                <Icon name="Info" size={14} className="text-mine-cyan mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Личный код и QR-код будут присвоены автоматически после добавления
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={addLoading || !formName.trim()}
              >
                {addLoading ? (
                  <>
                    <Icon name="Loader2" size={14} className="animate-spin" />
                    Добавление...
                  </>
                ) : (
                  <>
                    <Icon name="UserPlus" size={14} />
                    Добавить сотрудника
                  </>
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

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useControlPoints } from "@/hooks/use-control-points";

export interface RoleItem {
  key: string;
  label: string;
  pages: string[];
  users_count: number;
}

export const PAGE_LABELS: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Дашборд", icon: "LayoutDashboard" },
  personnel: { label: "Персонал", icon: "Users" },
  dispatcher: { label: "Диспетчерская", icon: "Radio" },
  medical: { label: "Медконтроль", icon: "HeartPulse" },
  lampa: { label: "Ламповая", icon: "Lightbulb" },
  scanner: { label: "Сканирование", icon: "ScanLine" },
  security: { label: "Охрана (СБ)", icon: "Shield" },
  checkpoint: { label: "КПП", icon: "DoorOpen" },
  aho: { label: "АХО", icon: "Building2" },
  ohs: { label: "ОТ и ПБ", icon: "HardHat" },
  reports: { label: "Отчёты", icon: "BarChart3" },
  profile: { label: "Личный кабинет", icon: "User" },
};

export function usePageLabels() {
  const { points, extra } = useControlPoints();
  const main = points.find((p) => p.is_main);
  const out: Record<string, { label: string; icon: string }> = {};
  for (const [k, v] of Object.entries(PAGE_LABELS)) {
    out[k] = k === "checkpoint" && main ? { label: main.name, icon: main.icon || v.icon } : v;
    if (k === "checkpoint") {
      for (const p of extra) out[p.page_key] = { label: p.name, icon: p.icon || "DoorOpen" };
    }
  }
  return out;
}

interface Props {
  roles: RoleItem[];
  loading: boolean;
  onChanged: () => void;
}

const RolesManager = ({ roles, loading, onChanged }: Props) => {
  const { toast } = useToast();
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const pageLabels = usePageLabels();
  const [isNew, setIsNew] = useState(false);
  const [label, setLabel] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const openNew = () => {
    setIsNew(true);
    setEditing({ key: "", label: "", pages: [], users_count: 0 });
    setLabel("");
    setPages(["dashboard", "profile"]);
  };

  const openEdit = (r: RoleItem) => {
    setIsNew(false);
    setEditing(r);
    setLabel(r.label);
    setPages(r.pages || []);
  };

  const toggle = (page: string) =>
    setPages((prev) => (prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]));

  const save = async () => {
    if (!label.trim()) {
      toast({ title: "Укажите название роли", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let message = "";
      try {
        const res = await authApi.saveRole({ key: isNew ? undefined : editing?.key, label: label.trim(), pages });
        message = res.message;
      } catch (e) {
        if (isNew || !editing?.key) throw e;
        const perms: Record<string, string[]> = Object.fromEntries(roles.map((r) => [r.key, r.pages]));
        perms[editing.key] = pages;
        const res = await authApi.savePermissions(perms);
        message = res.message;
      }
      toast({ title: message });
      setEditing(null);
      onChanged();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка сохранения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: RoleItem) => {
    if (!confirm(`Удалить роль «${r.label}»?`)) return;
    setDeleting(r.key);
    try {
      const res = await authApi.deleteRole(r.key);
      toast({ title: res.message });
      onChanged();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Ошибка удаления", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
      <div className="p-4 border-b border-primary/20 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="ShieldCheck" size={18} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Доступ по ролям</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Роли и разделы, которые они видят после входа
          </p>
        </div>
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={openNew}>
          <Icon name="Plus" size={12} />
          Роль
        </Button>
      </div>

      <div className="p-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-4">
            <Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          roles.map((r) => {
            const isAdmin = r.key === "admin";
            return (
              <div key={r.key} className="rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[11px] truncate">
                      {r.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {r.users_count} польз.
                    </span>
                  </div>
                  {!isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                        title="Редактировать"
                      >
                        <Icon name="Pencil" size={13} />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        disabled={deleting === r.key}
                        className="p-1.5 rounded-md hover:bg-mine-red/10 text-muted-foreground hover:text-mine-red"
                        title="Удалить"
                      >
                        <Icon name={deleting === r.key ? "Loader2" : "Trash2"} size={13} className={deleting === r.key ? "animate-spin" : ""} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {isAdmin ? (
                    <span className="text-[11px] text-muted-foreground">Все разделы</span>
                  ) : r.pages.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">Нет доступа к разделам</span>
                  ) : (
                    r.pages
                      .filter((p) => pageLabels[p])
                      .map((p) => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {pageLabels[p].label}
                        </span>
                      ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? "Новая роль" : "Редактирование роли"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Название роли</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Например: Мастер участка"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Доступные разделы после входа
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(pageLabels).map(([page, meta]) => {
                  const on = pages.includes(page);
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => toggle(page)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-xs border transition-all ${
                        on
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <Icon name={meta.icon} size={14} />
                      <span className="truncate">{meta.label}</span>
                      {on && <Icon name="Check" size={12} className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Отмена
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Сохраняю..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolesManager;
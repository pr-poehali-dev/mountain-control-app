import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { checkpointApi } from "@/lib/api";

interface OnSitePerson {
  personnel_id: number;
  full_name: string;
  department: string;
  position: string;
  organization: string;
  checkpoint_name: string;
  entered_at: string;
  tab_number?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseDate(v: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
}

function formatEntered(v: string): { time: string; date: string; ago: string } {
  const d = parseDate(v);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const date = sameDay
    ? "сегодня"
    : yesterday
    ? "вчера"
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  const mins = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const ago = days > 0 ? `${days} д ${hours} ч` : hours > 0 ? `${hours} ч ${mins % 60} мин` : `${mins} мин`;
  return { time, date, ago };
}

export default function OnSiteDialog({ open, onOpenChange }: Props) {
  const [items, setItems] = useState<OnSitePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setQuery("");
    checkpointApi
      .getOnSite()
      .then((res) => {
        if (cancelled) return;
        const list: OnSitePerson[] = res.items || [];
        list.sort((a, b) => parseDate(b.entered_at).getTime() - parseDate(a.entered_at).getTime());
        setItems(list);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Не удалось загрузить список"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.full_name, p.department, p.position, p.organization, p.tab_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Users" size={18} className="text-mine-amber" />
            На территории
            {!loading && <span className="text-muted-foreground font-normal">— {items.length}</span>}
          </DialogTitle>
          <DialogDescription>Люди, чей последний проход через КПП — вход</DialogDescription>
        </DialogHeader>

        {items.length > 5 && (
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по ФИО или подразделению"
              className="pl-9 bg-secondary/50"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-mine-red">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {items.length === 0 ? "Сейчас на территории никого нет" : "Никого не найдено"}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p) => {
                const t = formatEntered(p.entered_at);
                return (
                  <div key={p.personnel_id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-full bg-mine-amber/10 flex items-center justify-center shrink-0 text-xs font-semibold text-mine-amber">
                      {p.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.department && p.department !== "—" ? p.department : "Подразделение не указано"}
                        {p.position && p.position !== "—" ? ` · ${p.position}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono text-foreground">
                        {t.time} <span className="text-xs text-muted-foreground font-sans">{t.date}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.checkpoint_name} · {t.ago}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

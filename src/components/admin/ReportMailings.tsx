import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { reportsApi, REPORTS_CRON_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface CatalogItem { key: string; title: string; group: string }

interface Mailing {
  id?: number;
  name: string;
  enabled: boolean;
  emails: string[];
  reports: string[];
  reports_missing?: string[];
  frequency: "daily" | "weekly" | "monthly";
  weekday: number;
  month_day: number;
  hour: number;
  tz: string;
  period: string;
  last_status?: string;
  last_error?: string;
  last_sent_at?: string | null;
}

const TIMEZONES = [
  { value: "Asia/Chita", label: "Чита (UTC+9)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Asia/Novosibirsk", label: "Новосибирск (UTC+7)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
];

const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const EMPTY: Mailing = {
  name: "", enabled: true, emails: [], reports: [], frequency: "daily",
  weekday: 1, month_day: 1, hour: 8, tz: "Asia/Chita", period: "yesterday",
};

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function scheduleText(m: Mailing) {
  if (m.frequency === "weekly") return `каждый ${WEEKDAYS_SHORT[m.weekday - 1]} в ${hh(m.hour)}`;
  if (m.frequency === "monthly") return `${m.month_day}-го числа в ${hh(m.hour)}`;
  return `ежедневно в ${hh(m.hour)}`;
}

function defaultPeriod(freq: Mailing["frequency"]) {
  return freq === "weekly" ? "week" : freq === "monthly" ? "month" : "yesterday";
}

export default function ReportMailings() {
  const { toast } = useToast();
  const [items, setItems] = useState<Mailing[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [periods, setPeriods] = useState<Record<string, string>>({});
  const [smtpReady, setSmtpReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Mailing | null>(null);
  const [emailsText, setEmailsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [toRemove, setToRemove] = useState<Mailing | null>(null);
  const [cronLast, setCronLast] = useState<{ at: string } | null>(null);
  const [showCron, setShowCron] = useState(false);

  const titles = useMemo(() => Object.fromEntries(catalog.map((c) => [c.key, c.title])), [catalog]);
  const groups = useMemo(() => {
    const g: Record<string, CatalogItem[]> = {};
    catalog.forEach((c) => { (g[c.group] = g[c.group] || []).push(c); });
    return g;
  }, [catalog]);

  const load = () => {
    reportsApi.getMailings()
      .then((d) => {
        setItems(d.mailings || []);
        setCatalog(d.catalog || []);
        setPeriods(d.periods || {});
        setSmtpReady(!!d.smtp_ready);
        setCronLast(d.cron_last || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("control-points-changed", h);
    return () => window.removeEventListener("control-points-changed", h);
  }, []);

  const openForm = (m?: Mailing) => {
    const base = m ? { ...m, reports: m.reports.filter((k) => titles[k]) } : { ...EMPTY };
    setForm(base);
    setEmailsText(base.emails.join(", "));
  };

  const toggleReport = (key: string) =>
    setForm((f) => f && ({ ...f, reports: f.reports.includes(key) ? f.reports.filter((k) => k !== key) : [...f.reports, key] }));

  const save = async (patch?: Partial<Mailing>, silent = false) => {
    const src = patch ? { ...patch } : form;
    if (!src) return;
    const emails = patch ? src.emails : emailsText.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    setSaving(true);
    try {
      await reportsApi.saveMailing({ ...src, emails });
      if (!silent) toast({ title: src.id ? "Рассылка сохранена" : "Рассылка создана", description: scheduleText(src as Mailing) });
      if (!patch) setForm(null);
      load();
    } catch (e) {
      toast({ title: "Не удалось сохранить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async (m: Mailing) => {
    if (!m.id) return;
    setSendingId(m.id);
    try {
      const d = await reportsApi.sendMailing(m.id);
      toast({ title: "Письмо отправлено", description: d.message });
    } catch (e) {
      toast({ title: "Не удалось отправить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSendingId(null);
      load();
    }
  };

  const remove = async () => {
    if (!toRemove?.id) return;
    try {
      await reportsApi.removeMailing(toRemove.id);
      toast({ title: "Рассылка удалена" });
      setToRemove(null);
      load();
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Mails" size={18} className="text-mine-green" />
            <h3 className="text-sm font-semibold text-foreground">Рассылка отчётов</h3>
          </div>
          <p className="text-xs text-muted-foreground">Выбранные отчёты автоматически уходят на почту по расписанию</p>
        </div>
        <Button size="sm" className="h-8 gap-1 bg-mine-green text-white hover:bg-mine-green/90 shrink-0" onClick={() => openForm()} disabled={loading}>
          <Icon name="Plus" size={14} />
          Добавить
        </Button>
      </div>

      <div className="p-3 space-y-2">
        {!smtpReady && (
          <p className="text-xs text-mine-red rounded-md bg-mine-red/10 px-3 py-2">Почта для отправки не настроена — письма не уйдут</p>
        )}
        {(() => {
          const ageMin = cronLast ? (Date.now() - new Date(cronLast.at).getTime()) / 60000 : Infinity;
          const ok = ageMin < 90;
          return (
            <div className={`rounded-lg border px-3 py-2 ${ok ? "border-mine-green/30 bg-mine-green/5" : "border-mine-amber/30 bg-mine-amber/5"}`}>
              <button type="button" onClick={() => setShowCron((v) => !v)} className="w-full flex items-center gap-2 text-left">
                <Icon name={ok ? "AlarmClockCheck" : "AlarmClock"} size={14} className={ok ? "text-mine-green" : "text-mine-amber"} />
                <span className="text-xs flex-1 text-foreground">
                  {ok
                    ? `Автозапуск по часам работает · ${new Date(cronLast!.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
                    : "Автозапуск по часам не подключён — письма уходят, только когда кто-то открывает систему"}
                </span>
                <Icon name={showCron ? "ChevronUp" : "ChevronDown"} size={14} className="text-muted-foreground" />
              </button>
              {showCron && (
                <div className="mt-2 space-y-2 text-[11px] text-muted-foreground">
                  <p>Один раз добавьте эту ссылку в бесплатный сервис расписаний (например, cron-job.org) с запуском <b>каждые 15 минут</b>:</p>
                  <div className="flex gap-1">
                    <Input readOnly value={REPORTS_CRON_URL} className="h-7 text-[11px] font-mono bg-background" onFocus={(e) => e.target.select()} />
                    <Button
                      size="sm" variant="outline" className="h-7 px-2"
                      onClick={() => { navigator.clipboard.writeText(REPORTS_CRON_URL); toast({ title: "Ссылка скопирована" }); }}
                    >
                      <Icon name="Copy" size={12} />
                    </Button>
                  </div>
                  <p>Ссылка запускает и эти рассылки, и утреннюю сводку по пропускам. Повторных писем не будет — каждое уходит один раз в свой срок. Через 15 минут после подключения здесь появится зелёная отметка.</p>
                </div>
              )}
            </div>
          );
        })()}
        {loading ? (
          <div className="py-6 flex justify-center"><Icon name="Loader2" size={18} className="animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-6">
            <Icon name="MailPlus" size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Рассылок пока нет. Например: «Проходы КПП-1 и ОФ — начальнику охраны каждое утро».</p>
          </div>
        ) : items.map((m) => {
          const alive = m.reports.filter((k) => titles[k]);
          return (
            <div key={m.id} className={`rounded-lg border px-3 py-2.5 ${m.enabled ? "border-border bg-secondary/20" : "border-border/50 opacity-60"}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {scheduleText(m)} · {(periods[m.period] || "").toLowerCase()}
                  </p>
                </div>
                <Switch
                  checked={m.enabled}
                  onCheckedChange={(v) => save({ ...m, enabled: v, reports: alive }, true)}
                  disabled={saving}
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {alive.map((k) => (
                  <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-mine-green/10 text-mine-green">{titles[k]}</span>
                ))}
                {alive.length === 0 && <span className="text-[10px] text-mine-red">Нет доступных отчётов — выберите заново</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 truncate" title={m.emails.join(", ")}>
                <Icon name="AtSign" size={11} className="inline mr-1" />
                {m.emails.join(", ")}
              </p>
              {m.last_sent_at && (
                <p className={`text-[10px] mt-1 ${m.last_status === "error" ? "text-mine-red" : "text-muted-foreground"}`}>
                  {m.last_status === "error" ? "Ошибка отправки" : "Отправлено"}{" "}
                  {new Date(m.last_sent_at + (m.last_sent_at.endsWith("Z") || m.last_sent_at.includes("+") ? "" : "Z")).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {m.last_status === "error" && m.last_error ? `: ${m.last_error.slice(0, 80)}` : ""}
                </p>
              )}
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 flex-1" onClick={() => sendNow(m)} disabled={sendingId === m.id || alive.length === 0 || !smtpReady}>
                  <Icon name={sendingId === m.id ? "Loader2" : "Send"} size={12} className={sendingId === m.id ? "animate-spin" : ""} />
                  Отправить сейчас
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-8 p-0" onClick={() => openForm(m)} title="Изменить">
                  <Icon name="Pencil" size={12} />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-8 p-0 hover:text-mine-red" onClick={() => setToRemove(m)} title="Удалить">
                  <Icon name="Trash2" size={12} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Изменить рассылку" : "Новая рассылка отчётов"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Название (тема письма)</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Например: Сводка для начальника охраны" autoFocus />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Адреса почты (через запятую)</label>
                <Input value={emailsText} onChange={(e) => setEmailsText(e.target.value)} placeholder="ohrana@rudnik.ru, director@rudnik.ru" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Отчёты в письме ({form.reports.length})</label>
                <div className="space-y-2">
                  {Object.entries(groups).map(([group, list]) => (
                    <div key={group}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{group}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {list.map((c) => {
                          const on = form.reports.includes(c.key);
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => toggleReport(c.key)}
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs text-left transition-colors ${
                                on ? "border-mine-green/50 bg-mine-green/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/50"
                              }`}
                            >
                              <Icon name={on ? "CheckSquare" : "Square"} size={14} className={on ? "text-mine-green" : ""} />
                              <span className="truncate">{c.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Как часто</label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) => setForm({ ...form, frequency: v as Mailing["frequency"], period: defaultPeriod(v as Mailing["frequency"]) })}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Каждый день</SelectItem>
                      <SelectItem value="weekly">Раз в неделю</SelectItem>
                      <SelectItem value="monthly">Раз в месяц</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.frequency === "weekly" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">День недели</label>
                    <Select value={String(form.weekday)} onValueChange={(v) => setForm({ ...form, weekday: Number(v) })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.frequency === "monthly" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Число месяца</label>
                    <Select value={String(form.month_day)} onValueChange={(v) => setForm({ ...form, month_day: Number(v) })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{i + 1}{i === 30 ? " (или последнее)" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Время отправки</label>
                  <Select value={String(form.hour)} onValueChange={(v) => setForm({ ...form, hour: Number(v) })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{hh(h)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Часовой пояс</label>
                  <Select value={form.tz} onValueChange={(v) => setForm({ ...form, tz: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className={form.frequency === "daily" ? "" : "col-span-2"}>
                  <label className="text-xs text-muted-foreground mb-1 block">Период данных</label>
                  <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(periods).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-xs text-foreground">Рассылка включена</span>
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                В письме — итоги по каждому отчёту, полные таблицы приходят вложениями (CSV, открываются в Excel).
                «Жилой фонд» и «Сводный по персоналу» показывают состояние на момент отправки.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Отмена</Button>
            <Button
              onClick={() => save()}
              disabled={saving || !form?.name.trim() || !form?.reports.length || !emailsText.trim()}
              className="bg-mine-green text-white hover:bg-mine-green/90"
            >
              {saving ? "Сохраняю..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить рассылку «{toRemove?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Письма по ней перестанут приходить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-mine-red text-white hover:bg-mine-red/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

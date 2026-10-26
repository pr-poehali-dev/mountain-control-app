import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eventsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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

export default function PassAlertSettings() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [emails, setEmails] = useState("");
  const [hour, setHour] = useState(8);
  const [tz, setTz] = useState("Asia/Chita");
  const [lastSent, setLastSent] = useState("");
  const [smtpReady, setSmtpReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    eventsApi
      .getPassAlert()
      .then((d) => {
        const s = d.settings || {};
        setEnabled(!!s.enabled);
        setEmails((s.emails || []).join(", "));
        setHour(s.hour ?? 8);
        setTz(s.tz || "Asia/Chita");
        setLastSent(s.last_sent || "");
        setSmtpReady(!!d.smtp_ready);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const list = () => emails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const d = await eventsApi.savePassAlert({ enabled, emails: list(), hour, tz });
      setEnabled(!!d.settings.enabled);
      setEmails((d.settings.emails || []).join(", "));
      toast({ title: "Сохранено", description: d.settings.enabled ? `Сводка будет приходить каждый день в ${hour}:00` : "Рассылка выключена" });
    } catch (e) {
      toast({ title: "Ошибка", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      await eventsApi.savePassAlert({ enabled, emails: list(), hour, tz });
      const d = await eventsApi.sendPassAlertNow();
      toast({ title: "Письмо отправлено", description: d.message });
    } catch (e) {
      toast({ title: "Не удалось отправить", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="MailWarning" size={18} className="text-mine-amber" />
            <h3 className="text-sm font-semibold text-foreground">Рассылка по пропускам</h3>
          </div>
          <p className="text-xs text-muted-foreground">Каждое утро — список истекающих и истёкших пропусков</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
      </div>
      <div className="p-4 space-y-3">
        {!smtpReady && (
          <p className="text-xs text-mine-red rounded-md bg-mine-red/10 px-3 py-2">Почта для отправки не настроена — письма не уйдут</p>
        )}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Почта ответственных (через запятую)</label>
          <Input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="ohrana@rudnik.ru, kadry@rudnik.ru"
            className="bg-secondary/50 h-8 text-xs"
            disabled={loading}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Время отправки</label>
            <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
              <SelectTrigger className="bg-secondary/50 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Часовой пояс</label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger className="bg-secondary/50 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {lastSent && <p className="text-[11px] text-muted-foreground">Последняя отправка: {lastSent.split("-").reverse().join(".")}</p>}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90" onClick={save} disabled={saving || loading}>
            {saving ? <Icon name="Loader2" size={12} className="animate-spin" /> : "Сохранить"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={sendNow} disabled={sending || loading || list().length === 0}>
            <Icon name={sending ? "Loader2" : "Send"} size={12} className={sending ? "animate-spin" : ""} />
            Отправить сейчас
          </Button>
        </div>
      </div>
    </div>
  );
}

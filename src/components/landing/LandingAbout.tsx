import Icon from "@/components/ui/icon";
import Section from "./Section";
import { FEATURES, IMG } from "./data";

const LandingAbout = () => (
  <>
    <Section id="about" eyebrow="О системе" title="Всё о людях на руднике — в одном окне">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-5 text-muted-foreground text-base md:text-lg">
          <p>
            <span className="text-foreground font-semibold">«Горный контроль»</span> — специализированная цифровая платформа для
            комплексного учёта и контроля персонала на горнодобывающих предприятиях. Система объединяет данные о местонахождении
            сотрудников, их рабочем времени, проживании, прохождении медосмотров и производственных показателях в едином интерфейсе.
          </p>
          <p>
            Решение разработано с учётом требований промышленной безопасности и позволяет в режиме реального времени отслеживать
            ключевые процессы на руднике, снижая риски и повышая эффективность управления.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <Icon name="Target" size={20} className="text-primary" />
              <p className="mt-2 font-semibold text-foreground text-base">Назначение</p>
              <p className="text-sm">Автоматизация учёта персонала, контроль доступа в горные выработки, мониторинг рабочих зон и проживания.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Icon name="Factory" size={20} className="text-primary" />
              <p className="mt-2 font-semibold text-foreground text-base">Область применения</p>
              <p className="text-sm">Подземные и открытые горные работы, шахты, рудники, карьеры, обогатительные фабрики.</p>
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full" />
          <img src={IMG.site} alt="Схема рудника, связанного с системой" className="relative rounded-2xl border border-border shadow-2xl w-full" />
        </div>
      </div>
    </Section>

    <Section id="features" eyebrow="Ключевые возможности" title="Контроль на каждом участке" className="bg-secondary/30">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition-colors">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary transition-colors">
              <Icon name={f.icon} size={22} className="text-primary group-hover:text-primary-foreground transition-colors" />
            </div>
            <p className="mt-4 font-semibold text-foreground">{f.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </Section>
  </>
);

export default LandingAbout;

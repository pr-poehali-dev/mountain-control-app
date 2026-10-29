import Icon from "@/components/ui/icon";
import Section from "./Section";
import { EXTRA_POINTS, HOUSING, MEDICAL, VIDEO } from "./data";

const ListCard = ({ icon, title, lead, items }: { icon: string; title: string; lead: string; items: string[] }) => (
  <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
    <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
      <Icon name={icon} size={24} className="text-primary" />
    </div>
    <h3 className="mt-4 text-xl font-bold text-foreground">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{lead}</p>
    <ul className="mt-5 space-y-3">
      {items.map((it) => (
        <li key={it} className="flex gap-2.5 text-sm text-foreground/90">
          <Icon name="CircleCheck" size={18} className="text-mine-green shrink-0" />
          {it}
        </li>
      ))}
    </ul>
  </div>
);

const Tiles = ({ items }: { items: { icon: string; title: string; text: string }[] }) => (
  <div className="grid sm:grid-cols-2 gap-4">
    {items.map((t) => (
      <div key={t.title} className="rounded-2xl border border-border bg-card p-5">
        <Icon name={t.icon} size={22} className="text-primary" />
        <p className="mt-3 font-semibold text-foreground">{t.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.text}</p>
      </div>
    ))}
  </div>
);

const LandingDetails = () => (
  <>
    <Section eyebrow="Проживание и медицина" title="Кто где живёт и кто допущен к работе">
      <div className="grid lg:grid-cols-2 gap-5">
        <ListCard icon="BedDouble" title="Проживание и расселение" lead="Учёт мест проживания работников в общежитиях предприятия." items={HOUSING} />
        <ListCard icon="HeartPulse" title="Медицинские осмотры и допуски" lead="Прохождение медосмотров и допусков к работам привязано к работнику." items={MEDICAL} />
      </div>
    </Section>

    <Section eyebrow="Расширение" title="Дополнительные точки контроля и видеонаблюдение" className="bg-secondary/30">
      <div className="grid lg:grid-cols-2 gap-10">
        <div>
          <p className="text-muted-foreground mb-5">Система легко расширяется под специфику конкретного предприятия.</p>
          <Tiles items={EXTRA_POINTS} />
        </div>
        <div>
          <p className="text-muted-foreground mb-5">Поддерживается интеграция с камерами видеонаблюдения для дополнительного контроля.</p>
          <Tiles items={VIDEO} />
        </div>
      </div>
    </Section>
  </>
);

export default LandingDetails;

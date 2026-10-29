import Icon from "@/components/ui/icon";
import Section from "./Section";
import { CATEGORIES, IMG, QR_INFO, START_STEPS } from "./data";

const LandingStart = () => (
  <>
    <Section eyebrow="С чего начинается контроль" title="Регистрация и личный QR-код" lead="Контроль начинается с регистрации работника в системе и присвоения ему личного QR-кода.">
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-start">
        <img src={IMG.checkpoint} alt="Регистрация работника на КПП" className="rounded-2xl border border-border shadow-xl w-full aspect-square object-cover" />
        <ol className="space-y-4">
          {START_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
              <span className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">{i + 1}</span>
              <div>
                <p className="font-semibold text-foreground">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>

    <Section eyebrow="QR-код — единый ключ" title="Одно сканирование — вся информация" lead="При сканировании личного QR-кода работника система мгновенно показывает всё необходимое." className="bg-secondary/30">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {QR_INFO.map((q) => (
          <div key={q.title} className="rounded-2xl border border-border bg-card p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-mine-cyan/15 flex items-center justify-center">
              <Icon name={q.icon} size={22} className="text-mine-cyan" />
            </div>
            <p className="mt-3 font-semibold text-foreground">{q.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{q.text}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section eyebrow="Все категории персонала" title="Свои, подрядчики, гости — в одной системе">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((c) => (
          <div key={c.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
            <Icon name={c.icon} size={24} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">{c.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  </>
);

export default LandingStart;

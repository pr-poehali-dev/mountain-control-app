import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import Section from "./Section";
import { ADVANTAGES, CUSTOM, EQUIPMENT } from "./data";

const LandingBusiness = () => (
  <>
    <Section id="equipment" eyebrow="Оборудование" title="Минимальный комплект — без дорогой СКУД" lead="Для работы системы нужен обычный офисный набор.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {EQUIPMENT.map((e, i) => (
          <div
            key={e.title}
            className={`flex gap-4 rounded-2xl border p-5 ${i === EQUIPMENT.length - 1 ? "border-primary bg-primary/10" : "border-border bg-card"}`}
          >
            <Icon name={e.icon} size={26} className="text-primary shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{e.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{e.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>

    <Section eyebrow="Под заказчика" title="Гибкая настройка под ваш процесс" className="bg-secondary/30">
      <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
        <div className="space-y-3">
          {CUSTOM.map((c) => (
            <div key={c.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <Icon name="Settings2" size={20} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-primary to-mine-amber p-8 text-primary-foreground flex flex-col justify-center">
          <Icon name="PiggyBank" size={36} />
          <h3 className="mt-4 text-2xl md:text-3xl font-bold">Экономия бюджета</h3>
          <p className="mt-3 text-primary-foreground/85">«Горный контроль» — достойная альтернатива дорогостоящим СКУД-системам.</p>
          <div className="mt-6 space-y-4">
            <div>
              <p className="font-semibold">Без дорогой СКУД</p>
              <p className="text-sm text-primary-foreground/80">Не нужно покупать СКУД-систему или аналоги — все необходимые функции уже в системе.</p>
            </div>
            <div>
              <p className="font-semibold">Экономия в разы</p>
              <p className="text-sm text-primary-foreground/80">Минимальные требования к оборудованию и доступная стоимость владения.</p>
            </div>
          </div>
        </div>
      </div>
    </Section>

    <Section id="advantages" eyebrow="Преимущества" title="Что получает предприятие">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ADVANTAGES.map((a) => (
          <div key={a.title} className="rounded-2xl border border-border bg-card p-6">
            <div className="w-12 h-12 rounded-xl bg-mine-green/15 flex items-center justify-center">
              <Icon name={a.icon} size={24} className="text-mine-green" />
            </div>
            <p className="mt-4 font-semibold text-foreground">{a.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{a.text}</p>
          </div>
        ))}
      </div>
    </Section>

    <section className="pb-20">
      <div className="container max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-card p-8 md:p-14 text-center">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Готовы к внедрению?</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Оцените возможности «Горного контроля» на вашем предприятии. Откройте демо-версию и посмотрите систему в работе — без регистрации.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="gap-2 h-12 px-8 text-base">
                <Link to="/demo">
                  <Icon name="Play" size={18} />
                  Попробовать демо
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 h-12 px-8 text-base text-foreground">
                <Link to="/login?tab=register">
                  <Icon name="UserPlus" size={18} />
                  Зарегистрироваться
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Начните цифровую трансформацию вашего рудника уже сегодня.</p>
          </div>
        </div>
      </div>
    </section>
  </>
);

export default LandingBusiness;

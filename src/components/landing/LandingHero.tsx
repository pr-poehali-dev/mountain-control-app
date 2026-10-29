import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { HERO_POINTS, IMG } from "./data";

const LandingHero = () => (
  <section id="top" className="relative min-h-[92vh] flex items-end md:items-center overflow-hidden">
    <img src={IMG.hero} alt="Шахтёр у входа в рудник с QR-кодом" className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

    <div className="container max-w-6xl relative pt-28 pb-16 md:py-32">
      <div className="max-w-2xl animate-fade-in">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <Icon name="Pickaxe" size={14} />
          Горнодобывающая отрасль
        </p>
        <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] text-foreground">
          Горный контроль
        </h1>
        <p className="mt-4 text-xl md:text-2xl text-foreground/90 font-medium">Система учёта и контроля персонала на руднике</p>
        <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl">
          Цифровое решение для повышения безопасности, прозрачности и эффективности горных работ.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="gap-2 text-base h-12 px-7 shadow-lg shadow-primary/30">
            <Link to="/demo">
              <Icon name="Play" size={18} />
              Попробовать демо
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 text-base h-12 px-7 bg-background/40 text-foreground">
            <Link to="/login?tab=register">
              <Icon name="UserPlus" size={18} />
              Регистрация и вход
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-3">
          {HERO_POINTS.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-card/60 backdrop-blur p-4">
              <Icon name={p.icon} size={20} className="text-primary" />
              <p className="mt-2 font-semibold text-foreground">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default LandingHero;

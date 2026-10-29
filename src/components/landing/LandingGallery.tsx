import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Section from "./Section";
import { SCREENS } from "./data";
import { useTheme } from "@/components/theme/ThemeToggle";

const LandingGallery = () => {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const { theme } = useTheme();
  const screen = SCREENS[active];
  const src = theme === "light" ? screen.light : screen.src;
  const go = (d: number) => setActive((active + d + SCREENS.length) % SCREENS.length);

  return (
    <Section
      id="screens"
      eyebrow="Интерфейс"
      title="Посмотрите, как выглядит система"
      lead="Реальные экраны «Горного контроля». Выберите раздел — а потом откройте демо и попробуйте сами."
    >
      <div className="flex flex-wrap gap-2 mb-6">
        {SCREENS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setActive(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
              i === active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <Icon name={s.icon} size={16} />
            {s.title}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute -inset-6 bg-primary/10 blur-3xl rounded-[40px] pointer-events-none" />
        <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-secondary/50">
            <span className="w-3 h-3 rounded-full bg-mine-red/70" />
            <span className="w-3 h-3 rounded-full bg-mine-amber/70" />
            <span className="w-3 h-3 rounded-full bg-mine-green/70" />
            <span className="ml-3 text-xs text-muted-foreground truncate">Горный контроль — {screen.title}</span>
          </div>
          <button className="group relative block w-full" onClick={() => setZoom(true)} aria-label="Увеличить">
            <img key={screen.key + theme} src={src} alt={`Раздел «${screen.title}»`} className="w-full aspect-[1440/710] object-cover object-top animate-fade-in" />
            <span className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/30 transition-colors">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm text-foreground">
                <Icon name="ZoomIn" size={16} />
                Увеличить
              </span>
            </span>
          </button>
          <button onClick={() => go(-1)} className="absolute left-3 top-1/2 w-10 h-10 rounded-full bg-background/80 border border-border flex items-center justify-center text-foreground hover:bg-background" aria-label="Назад">
            <Icon name="ChevronLeft" size={20} />
          </button>
          <button onClick={() => go(1)} className="absolute right-3 top-1/2 w-10 h-10 rounded-full bg-background/80 border border-border flex items-center justify-center text-foreground hover:bg-background" aria-label="Вперёд">
            <Icon name="ChevronRight" size={20} />
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-lg font-semibold text-foreground">{screen.title}</p>
          <p className="mt-1 text-muted-foreground">{screen.text}</p>
        </div>
        <Button asChild size="lg" className="gap-2 shrink-0">
          <Link to="/demo">
            <Icon name="Play" size={18} />
            Открыть в демо
          </Link>
        </Button>
      </div>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[96vw] w-[1440px] p-0 overflow-hidden">
          <DialogTitle className="sr-only">{screen.title}</DialogTitle>
          <img src={src} alt={`Раздел «${screen.title}»`} className="w-full h-auto" />
        </DialogContent>
      </Dialog>
    </Section>
  );
};

export default LandingGallery;

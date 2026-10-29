import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { NAV } from "./data";

const LandingHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-colors ${
        scrolled || open ? "bg-background/90 backdrop-blur border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="container max-w-6xl h-16 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Icon name="Mountain" size={20} className="text-primary-foreground" />
          </span>
          <span className="font-bold text-foreground">Горный контроль</span>
        </a>

        <nav className="hidden lg:flex items-center gap-6">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden sm:flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-foreground">
            <Link to="/login">Войти</Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/demo">
              <Icon name="Play" size={14} />
              Демо
            </Link>
          </Button>
        </div>

        <button className="sm:hidden p-2 text-foreground" onClick={() => setOpen(!open)} aria-label="Меню">
          <Icon name={open ? "X" : "Menu"} size={22} />
        </button>
      </div>

      {open && (
        <div className="sm:hidden border-t border-border bg-background px-4 py-4 space-y-3">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block text-sm text-muted-foreground">
              {n.label}
            </a>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/login">Войти</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/demo">Попробовать демо</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingHeader;

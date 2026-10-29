import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import LandingAbout from "@/components/landing/LandingAbout";
import LandingStart from "@/components/landing/LandingStart";
import LandingModules from "@/components/landing/LandingModules";
import LandingDetails from "@/components/landing/LandingDetails";
import LandingBusiness from "@/components/landing/LandingBusiness";

const Landing = () => (
  <div className="min-h-screen bg-background text-foreground scroll-smooth">
    <LandingHeader />
    <main>
      <LandingHero />
      <LandingAbout />
      <LandingStart />
      <LandingModules />
      <LandingDetails />
      <LandingBusiness />
    </main>
    <footer className="border-t border-border py-8">
      <div className="container max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Icon name="Mountain" size={18} className="text-primary" />
          <span>© {new Date().getFullYear()} Горный контроль</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/demo" className="hover:text-foreground">Демо</Link>
          <Link to="/login" className="hover:text-foreground">Вход</Link>
          <Link to="/login?tab=register" className="hover:text-foreground">Регистрация</Link>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  </div>
);

export default Landing;

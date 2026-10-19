import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <ThemeToggle floating />
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Упс! Страница не найдена</p>
        <a href="/" className="text-primary hover:opacity-80 underline">
          Вернуться на главную
        </a>
      </div>
    </div>
  );
};

export default NotFound;

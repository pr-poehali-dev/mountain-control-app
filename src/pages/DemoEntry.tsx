import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { demoApi, setToken, setStoredUser } from "@/lib/api";
import { useDemo } from "@/contexts/DemoContext";
import Icon from "@/components/ui/icon";

const DemoEntry = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { enterDemo } = useDemo();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Демо-ссылка не указана");
      return;
    }

    const enter = async () => {
      try {
        const data = await demoApi.enter(token);
        setToken(data.token);
        setStoredUser(data.user);
        localStorage.setItem("mc_pages", JSON.stringify(data.allowed_pages));
        enterDemo(token, data.demo_name || "");
        window.location.href = "/";
      } catch (err: unknown) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Ошибка входа по демо-ссылке");
      }
    };

    enter();
  }, [token]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-mine-red/20 flex items-center justify-center mx-auto">
            <Icon name="AlertCircle" size={32} className="text-mine-red" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Демо-ссылка недоступна</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-primary hover:underline"
          >
            Перейти на страницу входа
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-mine-amber/20 flex items-center justify-center mx-auto">
          <Icon name="Eye" size={32} className="text-mine-amber" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Подготовка демо-доступа...</h1>
        <div className="w-10 h-10 border-2 border-mine-amber border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
};

export default DemoEntry;
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import QrScanner from "@/components/scanner/QrScanner";

const Login = () => {
  const { login, loginByCode, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPosition, setRegPosition] = useState("");
  const [regDept, setRegDept] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await doCodeLogin(code.trim());
  };

  const doCodeLogin = async (loginCode: string) => {
    setError("");
    setLoading(true);
    try {
      await loginByCode(loginCode);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Код не найден");
    } finally {
      setLoading(false);
    }
  };

  const handleQrScan = useCallback(
    (scannedCode: string) => {
      if (loading) return;
      setCode(scannedCode);
      setScanning(false);
      doCodeLogin(scannedCode);
    },
    [loading]
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        email: regEmail,
        password: regPassword,
        full_name: regName,
        position: regPosition,
        department: regDept,
      });
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <Icon name="Mountain" size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Горный контроль</h1>
          <p className="text-sm text-muted-foreground">
            Система учёта и контроля персонала на руднике
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="login">Email</TabsTrigger>
              <TabsTrigger value="code">По коду</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-mine-red/10 border border-mine-red/20 text-mine-red text-sm flex items-center gap-2">
                <Icon name="AlertCircle" size={16} />
                {error}
              </div>
            )}

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="email@rudnik.ru"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Пароль
                  </label>
                  <Input
                    type="password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? "Входим..." : "Войти"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="code">
              <div className="space-y-4">
                {scanning ? (
                  <div className="rounded-lg overflow-hidden">
                    <QrScanner
                      onScan={handleQrScan}
                      active={scanning}
                      onToggle={setScanning}
                    />
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={() => setScanning(true)}
                      variant="outline"
                      className="w-full gap-2 h-20 border-dashed border-mine-cyan/30 hover:bg-mine-cyan/5 hover:border-mine-cyan/50 flex-col"
                    >
                      <Icon name="Camera" size={24} className="text-mine-cyan" />
                      <span className="text-sm text-mine-cyan">
                        Сканировать QR камерой
                      </span>
                    </Button>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">или введите код</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  </>
                )}

                <form onSubmit={handleCodeLogin} className="space-y-3">
                  <Input
                    placeholder="Например: ADM-001"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="bg-secondary/50 font-mono text-lg text-center tracking-widest h-14"
                    required
                  />
                  <Button
                    type="submit"
                    className="w-full bg-mine-cyan text-white hover:bg-mine-cyan/90"
                    disabled={loading || !code.trim()}
                  >
                    <Icon name="ScanLine" size={16} className="mr-2" />
                    {loading ? "Проверяем..." : "Войти по коду"}
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    ФИО
                  </label>
                  <Input
                    placeholder="Иванов Иван Иванович"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="email@rudnik.ru"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Пароль
                  </label>
                  <Input
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Должность
                    </label>
                    <Input
                      placeholder="Должность"
                      value={regPosition}
                      onChange={(e) => setRegPosition(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Подразделение
                    </label>
                    <Input
                      placeholder="Подразделение"
                      value={regDept}
                      onChange={(e) => setRegDept(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-mine-green text-white hover:bg-mine-green/90"
                  disabled={loading}
                >
                  {loading ? "Регистрация..." : "Зарегистрироваться"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Горный контроль v1.0 — Система управления рудником
        </p>
      </div>
    </div>
  );
};

export default Login;

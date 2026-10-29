import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { FACE_ONBOARDING_KEY } from "@/components/face/FaceOnboardingDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authApi } from "@/lib/api";
import { preloadFaceApi } from "@/lib/face";
import ThemeToggle from "@/components/theme/ThemeToggle";

const QrScanner = lazy(() => import("@/components/scanner/QrScanner"));
const FaceLogin = lazy(() => import("@/components/face/FaceLogin"));

const Spinner = () => (
  <div className="flex items-center justify-center py-10">
    <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
  </div>
);

const Login = () => {
  const { loginByEmailCode, loginByCode, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "register" ? "register" : "login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [info, setInfo] = useState("");
  const [notRegistered, setNotRegistered] = useState(false);
  const [code, setCode] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPosition, setRegPosition] = useState("");
  const [regDept, setRegDept] = useState("");
  const [regOrg, setRegOrg] = useState("");
  const [regOrgType, setRegOrgType] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      import("@/components/face/FaceLogin");
      preloadFaceApi();
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  const sendEmailCode = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await authApi.emailSendCode(email.trim());
      setCodeSent(true);
      setEmailCode("");
      setInfo(res.message || "Код отправлен на почту");
    } catch (err: unknown) {
      const e = err as Error & { data?: { not_registered?: boolean } };
      if (e.data?.not_registered) {
        setNotRegistered(true);
      } else {
        setError(e.message || "Не удалось отправить код");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSent) {
      await sendEmailCode();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loginByEmailCode(email.trim(), emailCode);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    setCodeSent(false);
    setEmailCode("");
    setInfo("");
    setError("");
  };

  const goRegister = () => {
    setNotRegistered(false);
    setRegEmail(email.trim());
    setError("");
    setInfo("");
    setTab("register");
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
    sessionStorage.setItem(FACE_ONBOARDING_KEY, "1");
    try {
      await register({
        email: regEmail,
        password: regPassword,
        full_name: regName,
        position: regPosition,
        department: regDept,
        organization: regOrg,
        organization_type: regOrgType,
      });
      navigate("/");
    } catch (err: unknown) {
      sessionStorage.removeItem(FACE_ONBOARDING_KEY);
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <ThemeToggle floating />
      <Link to="/about" className="fixed top-4 left-4 z-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Icon name="ArrowLeft" size={16} />
        О системе
      </Link>
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
          <Tabs value={tab} onValueChange={(v) => { setTab(v); setError(""); }}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="login">Email</TabsTrigger>
              <TabsTrigger value="face">Лицо</TabsTrigger>
              <TabsTrigger value="code">По коду</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-mine-red/10 border border-mine-red/20 text-mine-red text-sm flex items-center gap-2">
                <Icon name="AlertCircle" size={16} />
                {error}
              </div>
            )}

            <TabsContent value="face">
              {tab === "face" && <Suspense fallback={<Spinner />}><FaceLogin /></Suspense>}
            </TabsContent>

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
                    disabled={codeSent}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                {codeSent && (
                  <div className="space-y-2">
                    {info && (
                      <div className="p-3 rounded-lg bg-mine-green/10 border border-mine-green/20 text-mine-green text-sm flex items-center gap-2">
                        <Icon name="MailCheck" size={16} />
                        {info}
                      </div>
                    )}
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Код из письма
                    </label>
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="bg-secondary/50 font-mono text-2xl text-center tracking-[0.5em] h-14"
                      autoFocus
                      required
                    />
                    <div className="flex items-center justify-between text-xs">
                      <button type="button" onClick={changeEmail} className="text-muted-foreground hover:text-foreground">
                        Изменить email
                      </button>
                      <button type="button" onClick={sendEmailCode} disabled={loading} className="text-primary hover:underline disabled:opacity-50">
                        Отправить код ещё раз
                      </button>
                    </div>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading
                    ? codeSent ? "Входим..." : "Отправляем код..."
                    : codeSent ? "Войти" : "Получить код на почту"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="code">
              <div className="space-y-4">
                {scanning ? (
                  <div className="rounded-lg overflow-hidden">
                    <Suspense fallback={<Spinner />}>
                      <QrScanner
                        onScan={handleQrScan}
                        active={scanning}
                        onToggle={setScanning}
                      />
                    </Suspense>
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
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Наименование предприятия
                  </label>
                  <Input
                    placeholder="Название организации"
                    value={regOrg}
                    onChange={(e) => setRegOrg(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Тип организации
                  </label>
                  <Select value={regOrgType} onValueChange={setRegOrgType}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rudnik">Рудник</SelectItem>
                      <SelectItem value="guest">Гость</SelectItem>
                      <SelectItem value="contractor">Подрядная организация</SelectItem>
                      <SelectItem value="gov">Гос.органы</SelectItem>
                    </SelectContent>
                  </Select>
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

        <div className="text-center space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">или</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            className="w-full gap-2 border-mine-amber/30 text-mine-amber hover:bg-mine-amber/10 hover:border-mine-amber/50"
            onClick={() => navigate("/demo")}
          >
            <Icon name="Eye" size={16} />
            Попробовать демо-версию
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Горный контроль v1.0 — Система управления рудником
        </p>
      </div>
      <AlertDialog open={notRegistered} onOpenChange={setNotRegistered}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon name="UserX" size={20} className="text-mine-amber" />
              Email не зарегистрирован
            </AlertDialogTitle>
            <AlertDialogDescription>
              Адрес <span className="font-medium text-foreground">{email.trim()}</span> не найден в системе. Пройдите регистрацию, чтобы получить доступ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={goRegister}>Зарегистрироваться</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Login;
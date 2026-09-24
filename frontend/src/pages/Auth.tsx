import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth, PROVINCES, UserRole, ROLE_LABEL } from "@/contexts/AuthContext";
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";
import { erroDePasswordFraca } from "@/lib/validarPassword";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, registerUser, signInWithGoogle } = useAuth();

  // Para onde voltar depois de autenticar (ex.: uma página que exigiu login
  // primeiro, ver Scanner.tsx). Só caminhos relativos, nunca um URL externo.
  const rawNext = searchParams.get("next") ?? "";
  const nextPath = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";

  // AUTH-02: registar já não inicia sessão -- depois de criar a conta,
  // muda para o separador de login (em vez de navegar como se estivesse
  // autenticado) e avisa para confirmar o email primeiro.
  // `?modo=registo` abre directamente em "Criar conta" (ex.: CTA do teste
  // de 7 dias em /exercicios, para quem ainda não tem conta).
  const [activeTab, setActiveTab] = useState<"login" | "register">(
    searchParams.get("modo") === "registo" ? "register" : "login",
  );

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // Register state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [province, setProvince] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [gender, setGender] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  // Google (login ou registo, o mesmo botão -- /auth/google resolve as duas
  // coisas do lado da API: liga a uma conta existente ou cria uma nova).
  const [googleLoading, setGoogleLoading] = useState(false);

  const irParaProximo = () => navigate(localizar(nextPath));

  const handleGoogleCredential = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const resultado = await signInWithGoogle(idToken);
      if (!resultado.ok) {
        toast.error(resultado.error || t("Auth.naoFoiPossivelEntrar"));
        return;
      }
      toast.success(t("Auth.sessaoIniciada"));
      irParaProximo();
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error(t("Auth.preenchaEmailEPalavra"));
      return;
    }
    setLoginLoading(true);
    try {
      const resultado = await signIn(loginEmail.trim(), loginPassword);
      if (!resultado.ok) {
        // AUTH-02, bloqueio total: a API devolve esta mensagem exacta em
        // 403 quando a password está certa mas o email não. Dá logo a
        // acção óbvia (reenviar o link) em vez de deixar a pessoa presa.
        if (resultado.error?.includes(t("Auth.confirmeOSeuEmail"))) {
          toast.error(resultado.error, {
            action: {
              label: t("Auth.reenviarLink"),
              onClick: () => void handleReenviarConfirmacao(loginEmail.trim()),
            },
          });
          return;
        }
        toast.error(resultado.error || t("Auth.emailOuPalavraPasse"));
        return;
      }
      toast.success(t("Auth.sessaoIniciada"));
      irParaProximo();
    } finally {
      setLoginLoading(false);
    }
  };

  const handleReenviarConfirmacao = async (email: string) => {
    try {
      // Resposta sempre igual, exista ou não a conta, esteja ou não já
      // confirmada -- mesmo princípio de handleForgotPassword.
      await authApi.reenviarConfirmacao(email);
      toast.success(t("Auth.seExistirUmaConta"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("Auth.naoFoiPossivelReenviar")));
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      toast.error(t("Auth.escrevaOSeuEmail"));
      return;
    }
    setForgotPasswordLoading(true);
    try {
      // A resposta é sempre a mesma exista ou não conta com este email — a
      // API nunca revela isso (ver auth/recuperar-password). Um "sucesso"
      // aqui só significa "o pedido foi aceite", nunca "o email existe".
      await authApi.recuperarPassword(loginEmail.trim());
      toast.success(t("Auth.seExistirUmaConta2"));
    } catch (err) {
      // Aqui sim pode ser um erro real (API em baixo, Resend a falhar) —
      // nunca mostrar a mensagem de sucesso acima a partir de um catch.
      toast.error(mensagemDeErroApi(err, t("Auth.naoFoiPossivelPedir")));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword || !province || !gender || !role) {
      toast.error(t("Auth.porFavorPreenchaTodos"));
      return;
    }
    // Confirmação é só neste formulário, nunca vai ao servidor — a API só
    // vê `password` (ver AuthContext.registerUser). Verificação da força
    // da password é uma cópia da regra do servidor (validarPassword.ts):
    // dá feedback imediato, mas quem decide de facto é sempre a API.
    if (password !== confirmPassword) {
      toast.error(t("Auth.asPalavrasPasseNao"));
      return;
    }
    const erroPassword = erroDePasswordFraca(password);
    if (erroPassword) {
      toast.error(erroPassword);
      return;
    }
    setRegisterLoading(true);
    try {
      const resultado = await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
        province,
        gender,
        role: role as UserRole,
      });
      if (!resultado.ok) {
        toast.error(resultado.error || t("Auth.naoFoiPossivelCriar"));
        return;
      }
      // AUTH-02: a conta existe mas fica por confirmar -- nunca navegar
      // como se já estivesse autenticado. Mostra o próximo passo (confirmar
      // o email) e leva para o login, já com o email preenchido.
      toast.success(t("Auth.contaCriadaEnviamosUm", { valor: email.trim() }), {
        duration: 8000,
      });
      const emailRegistado = email.trim();
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setProvince("");
      setGender("");
      setRole("");
      setLoginEmail(emailRegistado);
      setActiveTab("login");
    } finally {
      setRegisterLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container max-w-md pt-28 pb-16 flex items-center">
        <Card className="w-full shadow-lg border-border/60">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl md:text-3xl font-bold">{t("Auth.bemVindoA")}</CardTitle>
            <CardDescription>{t("Auth.entreOuCrieA")}</CardDescription>
          </CardHeader>
          <CardContent>
            {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <div className="mb-6 space-y-4">
                <GoogleSignInButton onCredential={handleGoogleCredential} />
                {googleLoading && (
                  <p className="text-center text-sm text-muted-foreground">{t("Auth.aEntrar")}</p>
                )}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("Auth.ou")}</span>
                  </div>
                </div>
              </div>
            )}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">{t("Auth.entrar")}</TabsTrigger>
                <TabsTrigger value="register">{t("Auth.criarConta")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t("Auth.email")}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="voce@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t("Auth.palavraPasse")}</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotPasswordLoading}
                      className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors block ml-auto disabled:opacity-60"
                    >
                      {forgotPasswordLoading ? t("Auth.aEnviar") : t("Auth.esqueceuAPalavraPasse")}
                    </button>
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={loginLoading}>
                    {loginLoading ? t("Auth.aEntrar") : (
                      <>
                        {t("Auth.entrar")}{" "}<ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">{t("Auth.nomeCompleto")}</Label>
                    <Input
                      id="reg-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("Auth.oSeuNome")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">{t("Auth.email")}</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">{t("Auth.palavraPasse")}</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("Auth.peloMenos8Caracteres")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm-password">{t("Auth.confirmarPalavraPasse")}</Label>
                    <Input
                      id="reg-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Auth.provincia")}</Label>
                    <Select value={province} onValueChange={setProvince}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("Auth.seleccioneASuaProvincia")} />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Auth.genero")}</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("Auth.seleccioneOSeuGenero")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">{t("Auth.masculino")}</SelectItem>
                        <SelectItem value="feminino">{t("Auth.feminino")}</SelectItem>
                        <SelectItem value="nao_dizer">{t("Auth.prefiroNaoDizer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Auth.perfilDeUtente")}</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("Auth.seleccioneOSeuPerfil")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comum">{ROLE_LABEL.comum}</SelectItem>
                        <SelectItem value="estrabico">{ROLE_LABEL.estrabico}</SelectItem>
                        <SelectItem value="profissional">{ROLE_LABEL.profissional}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={registerLoading}>
                    {registerLoading ? t("Auth.aCriarConta") : (
                      <>
                        {t("Auth.criarConta")}{" "}<ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;

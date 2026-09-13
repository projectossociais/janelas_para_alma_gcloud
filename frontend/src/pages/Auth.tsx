import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GoogleSignInButton from "@/components/GoogleSignInButton";
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
import { authApi, mensagemDeErroApi } from "@/lib/apiClient";
import { useAuth, PROVINCES, UserRole, ROLE_LABEL } from "@/contexts/AuthContext";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogle, registerUser } = useAuth();

  // Para onde voltar depois de autenticar (ex.: uma página que exigiu login
  // primeiro, ver Scanner.tsx). Só caminhos relativos, nunca um URL externo.
  const rawNext = searchParams.get("next") ?? "";
  const nextPath = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Recuperação de password — substitui o formulário de login por um só
  // campo de email enquanto activo (ver handleForgotPassword).
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Register state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [province, setProvince] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [gender, setGender] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  const irParaProximo = () => navigate(nextPath);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Preencha email e palavra-passe.");
      return;
    }
    setLoginLoading(true);
    try {
      const resultado = await signIn(loginEmail.trim(), loginPassword);
      if (!resultado.ok) {
        toast.error(resultado.error || "Email ou palavra-passe incorretos.");
        return;
      }
      toast.success("Sessão iniciada.");
      irParaProximo();
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setGoogleLoading(true);
    try {
      const resultado = await signInWithGoogle(credential);
      if (!resultado.ok) {
        toast.error(resultado.error || "Não foi possível entrar com a Google.");
        return;
      }
      toast.success("Sessão iniciada.");
      irParaProximo();
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Indique o seu email.");
      return;
    }
    setForgotLoading(true);
    try {
      await authApi.solicitarRecuperacaoPassword(forgotEmail.trim());
      // Mensagem sempre igual, exista ou não o email -- a API nunca revela
      // isso (ver docs/BACKLOG.md, "Identidade externa e email").
      toast.success("Se esse email tiver conta, vai receber um link para repor a password.");
      setForgotMode(false);
      setForgotEmail("");
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível enviar o pedido. Tente novamente."));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !province || !gender || !role) {
      toast.error("Por favor, preencha todos os campos.");
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
        toast.error(resultado.error || "Não foi possível criar a conta.");
        return;
      }
      toast.success(`Bem-vindo(a), ${name.trim().split(" ")[0]}!`);
      irParaProximo();
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
            <CardTitle className="text-2xl md:text-3xl font-bold">Bem-vindo(a)</CardTitle>
            <CardDescription>Entre ou crie a sua conta para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                {forgotMode ? (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setForgotMode(false)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3" /> Voltar ao login
                    </button>
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="voce@email.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enviamos-lhe um link para repor a palavra-passe, se essa conta existir.
                      </p>
                    </div>
                    <Button type="submit" size="lg" className="w-full" disabled={forgotLoading}>
                      {forgotLoading ? "A enviar…" : "Enviar link de recuperação"}
                    </Button>
                  </form>
                ) : (
                  <>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="voce@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Palavra-passe</Label>
                        <Input
                          id="login-password"
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setForgotMode(true)}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors block ml-auto"
                        >
                          Esqueceu a palavra-passe?
                        </button>
                      </div>
                      <Button type="submit" size="lg" className="w-full" disabled={loginLoading}>
                        {loginLoading ? "A entrar…" : (
                          <>
                            Entrar <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </form>
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">ou</span>
                      </div>
                    </div>
                    <GoogleSignInButton onCredential={(c) => void handleGoogleCredential(c)} />
                    {googleLoading && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">A entrar…</p>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Nome Completo</Label>
                    <Input
                      id="reg-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="O seu nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Palavra-passe</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Província</Label>
                    <Select value={province} onValueChange={setProvince}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a sua província" />
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
                    <Label>Género</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o seu género" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="nao_dizer">Prefiro não dizer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil de Utente</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o seu perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comum">{ROLE_LABEL.comum}</SelectItem>
                        <SelectItem value="estrabico">{ROLE_LABEL.estrabico}</SelectItem>
                        <SelectItem value="profissional">{ROLE_LABEL.profissional}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={registerLoading}>
                    {registerLoading ? "A criar conta…" : (
                      <>
                        Criar Conta <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou</span>
                  </div>
                </div>
                <GoogleSignInButton onCredential={(c) => void handleGoogleCredential(c)} />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Completa o resto do perfil depois, em Editar Perfil.
                </p>
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

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
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, registerUser } = useAuth();

  // Where to return after auth (e.g. the MCP OAuth consent page). Same-origin relative paths only.
  const rawNext = searchParams.get("next") ?? "";
  const nextPath = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";
  const afterAuthUrl = `${window.location.origin}${nextPath}`;

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [province, setProvince] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [gender, setGender] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Preencha email e palavra-passe.");
      return;
    }
    // Try Supabase auth (needed for admin / cloud features).
    const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    // Local fallback (legacy accounts).
    const local = signIn(loginEmail.trim(), loginPassword);

    if (sbErr && !local.ok) {
      toast.error("Email ou palavra-passe incorretos.");
      return;
    }

    toast.success("Sessão iniciada.");
    if (nextPath !== "/") {
      window.location.href = afterAuthUrl;
      return;
    }
    navigate("/");
  };


  const handleForgotPassword = async () => {
    const email = loginEmail.trim();
    if (!email) {
      toast.error("Introduza o seu email primeiro.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar-password`,
    });

    if (error) {
      toast.error(error.message || "Não foi possível enviar o email de recuperação.");
      return;
    }
    toast.success("Enviámos um link de recuperação para o seu email.");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !province || !gender || !role) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }
    const res = registerUser({
      name: name.trim(),
      email: email.trim(),
      password,
      province,
      gender,
      role: role as UserRole,
    });
    if (!res.ok) {
      toast.error(res.error || "Não foi possível criar a conta.");
      return;
    }
    // Optimistic UI: show success immediately, then sync to Lovable Cloud in the background.
    toast.success(`Bem-vindo(a), ${name.split(" ")[0]}!`);
    if (nextPath !== "/") {
      window.location.href = afterAuthUrl;
    } else {
      navigate("/");
    }

    // Background: persist to backend (profiles table auto-populated via trigger).
    void (async () => {
      try {
        const redirectUrl = afterAuthUrl;
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name: name.trim(),
              province,
              gender,
              role,
            },
          },
        });
        if (error && !/already/i.test(error.message)) {
          console.warn("[signup] backend sync warning:", error.message);
        }
      } catch (err) {
        console.warn("[signup] backend sync failed", err);
      }
    })();
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
                      onClick={handleForgotPassword}
                      className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors block ml-auto"
                    >
                      Esqueceu a palavra-passe?
                    </button>
                  </div>
                  <Button type="submit" size="lg" className="w-full">
                    Entrar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
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
                  <Button type="submit" size="lg" className="w-full">
                    Criar Conta <ArrowRight className="w-4 h-4 ml-2" />
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

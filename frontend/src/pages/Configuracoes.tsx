import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { perfilApi, contaApi, mensagemDeErroApi } from "@/lib/apiClient";
import { useProfile } from "@/contexts/ProfileContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Bell, Lock, ShieldAlert, KeyRound, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Configuracoes = () => {
  const navigate = useNavigate();
  const { isLoggedIn, logout } = useAuth();
  const { profile, setProfile } = useProfile();

  const [notif, setNotif] = useState({
    notificacoes_projetos: true,
    notificacoes_lembretes: true,
    notificacoes_comunidade: true,
  });
  const [publicProfile, setPublicProfile] = useState(true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Hidrata só uma vez a partir de `profile`. Sem isto, cada `setProfile`
  // (incluindo o que o próprio `handleToggle` de UM switch dispara) reset a
  // cópia local dos TRÊS switches -- se o utilizador alternar um segundo
  // switch enquanto o primeiro pedido ainda está em curso, a resposta do
  // primeiro reverte visualmente o estado optimista do segundo.
  const hidratadoRef = useRef(false);

  useEffect(() => {
    if (profile && !hidratadoRef.current) {
      hidratadoRef.current = true;
      setNotif({
        notificacoes_projetos: profile.notificacoes_projetos,
        notificacoes_lembretes: profile.notificacoes_lembretes,
        notificacoes_comunidade: profile.notificacoes_comunidade,
      });
    }
  }, [profile]);

  const handleToggle = async (key: keyof typeof notif) => {
    if (!profile) {
      toast.error("Inicie sessão para guardar as suas preferências.");
      return;
    }

    const novoValor = !notif[key];
    setNotif((p) => ({ ...p, [key]: novoValor })); // optimista

    try {
      const data = await perfilApi.atualizar({ [key]: novoValor });
      setProfile({ ...profile, ...data, nome_completo: data.nome_completo ?? "" });
      toast.success("Preferência guardada", { duration: 1800 });
    } catch {
      setNotif((p) => ({ ...p, [key]: !novoValor })); // reverte
      toast.error("Não foi possível guardar. Tente novamente.");
    }
  };

  const handlePublicToggle = () => {
    setPublicProfile((v) => !v);
    toast.success("Preferências guardadas");
  };

  const handlePasswordSubmit = async () => {
    if (!currentPw || !newPw || newPw !== confirmPw) {
      toast.error("Verifique os campos da palavra-passe.");
      return;
    }
    if (newPw.length < 8) {
      toast.error("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }

    setPasswordLoading(true);
    try {
      // A API verifica a palavra-passe atual antes de a mudar — nunca
      // avança para sucesso sem essa confirmação (ver ContaService).
      await contaApi.mudarPassword(currentPw, newPw);

      setPasswordOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast.success("Palavra-passe atualizada com sucesso.");
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível atualizar a palavra-passe. Tente novamente."));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    // Impede o AlertDialog de fechar sozinho — só fecha depois de confirmarmos
    // que o pedido foi agendado com sucesso. Ver W-02: nunca avançar para
    // sucesso sem verificar o resultado real da chamada.
    e.preventDefault();
    if (!profile?.id) {
      toast.error("Não foi possível confirmar a sua conta. Tente novamente mais tarde.");
      return;
    }

    setDeleteLoading(true);
    try {
      // Não apaga já — a API agenda para daqui a 30 dias e termina a
      // sessão. Voltar a entrar antes dessa data cancela o pedido
      // automaticamente (ver AuthContext.tsx).
      await contaApi.eliminar();

      setDeleteOpen(false);
      logout();
      toast.success(
        "Conta agendada para eliminação dentro de 30 dias. Iniciar sessão de novo antes dessa data cancela o pedido."
      );
      navigate("/");
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível agendar a eliminação. Tente novamente."));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container max-w-3xl">
          <BackButton />
          <header className="mb-8 mt-4">
            <h1 className="text-3xl md:text-4xl font-bold text-primary">Configurações da Conta</h1>
            <p className="text-muted-foreground mt-2">
              Gira as suas preferências, notificações e dados pessoais.
            </p>
          </header>

          {!isLoggedIn && (
            <Card className="mb-6 border-teal/40 bg-teal/5">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-foreground">
                  Inicie sessão para guardar as suas preferências permanentemente.
                </p>
                <Button size="sm" onClick={() => navigate("/auth")}>Entrar</Button>
              </CardContent>
            </Card>
          )}

          {/* Notificações */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Bell className="w-5 h-5 text-teal" /> Preferências de Notificação
              </CardTitle>
              <CardDescription>Escolha os emails que deseja receber de nós.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="n-updates" className="font-medium">Atualizações de Projetos e Doações</Label>
                  <p className="text-xs text-muted-foreground mt-1">Receba emails sobre o nosso impacto.</p>
                </div>
                <Switch
                  id="n-updates"
                  checked={notif.notificacoes_projetos}
                  onCheckedChange={() => handleToggle("notificacoes_projetos")}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="n-ex" className="font-medium">Lembretes de Exercícios Visuais</Label>
                  <p className="text-xs text-muted-foreground mt-1">Lembretes semanais para praticar.</p>
                </div>
                <Switch
                  id="n-ex"
                  checked={notif.notificacoes_lembretes}
                  onCheckedChange={() => handleToggle("notificacoes_lembretes")}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="n-com" className="font-medium">Novas Histórias da Comunidade</Label>
                  <p className="text-xs text-muted-foreground mt-1">Alertas para novas publicações da comunidade.</p>
                </div>
                <Switch
                  id="n-com"
                  checked={notif.notificacoes_comunidade}
                  onCheckedChange={() => handleToggle("notificacoes_comunidade")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacidade e Segurança */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Lock className="w-5 h-5 text-teal" /> Privacidade e Segurança
              </CardTitle>
              <CardDescription>Controle o acesso à sua conta e ao seu perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Palavra-passe</p>
                  <p className="text-xs text-muted-foreground mt-1">Altere a sua palavra-passe regularmente.</p>
                </div>
                <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                  <KeyRound className="w-4 h-4 mr-2" /> Mudar Palavra-passe
                </Button>
              </div>
              <div className="flex items-start justify-between gap-4 pt-2 border-t border-border/50">
                <div className="pt-4">
                  <Label htmlFor="pub" className="font-medium">Perfil Público</Label>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Permitir que a equipa médica e outros utilizadores vejam o meu progresso básico.
                  </p>
                </div>
                <div className="pt-4">
                  <Switch id="pub" checked={publicProfile} onCheckedChange={handlePublicToggle} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-5 h-5" /> Zona de Perigo
              </CardTitle>
              <CardDescription>Ações irreversíveis relacionadas com a sua conta.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Eliminar Conta</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Apaga permanentemente o seu perfil, histórico e preferências.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Eliminar Conta
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      {/* Password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mudar Palavra-passe</DialogTitle>
            <DialogDescription>
              Introduza a sua palavra-passe atual e escolha uma nova.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cur">Palavra-passe atual</Label>
              <Input id="cur" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new">Nova palavra-passe</Label>
              <Input id="new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="conf">Confirmar nova palavra-passe</Label>
              <Input id="conf" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)} disabled={passwordLoading}>
              Cancelar
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={passwordLoading}>
              {passwordLoading ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              A sua conta ficará agendada para eliminação definitiva dentro de{" "}
              <strong>30 dias</strong> — o perfil, o histórico de exercícios, e a ligação
              de pedidos de doação ou Premium à sua identidade. Se voltar a iniciar
              sessão antes dessa data, o pedido é cancelado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "A agendar…" : "Agendar eliminação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Configuracoes;

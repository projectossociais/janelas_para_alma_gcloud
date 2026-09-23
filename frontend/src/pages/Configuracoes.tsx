import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { perfilApi, contaApi, mensagemDeErroApi } from "@/lib/apiClient";
import { erroDePasswordFraca } from "@/lib/validarPassword";
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
import { Trans, useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

const Configuracoes = () => {
  const { t } = useTranslation();
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
      toast.error(t("Configuracoes.inicieSessaoParaGuardar2"));
      return;
    }

    const novoValor = !notif[key];
    setNotif((p) => ({ ...p, [key]: novoValor })); // optimista

    try {
      const data = await perfilApi.atualizar({ [key]: novoValor });
      setProfile({ ...profile, ...data, nome_completo: data.nome_completo ?? "" });
      toast.success(t("Configuracoes.preferenciaGuardada"), { duration: 1800 });
    } catch {
      setNotif((p) => ({ ...p, [key]: !novoValor })); // reverte
      toast.error(t("Configuracoes.naoFoiPossivelGuardar"));
    }
  };

  const handlePublicToggle = () => {
    setPublicProfile((v) => !v);
    toast.success(t("Configuracoes.preferenciasGuardadas"));
  };

  const handlePasswordSubmit = async () => {
    if (!currentPw || !newPw || newPw !== confirmPw) {
      toast.error(t("Configuracoes.verifiqueOsCamposDa"));
      return;
    }
    const erroPassword = erroDePasswordFraca(newPw);
    if (erroPassword) {
      toast.error(erroPassword);
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
      toast.success(t("Configuracoes.palavraPasseActualizadaCom"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("Configuracoes.naoFoiPossivelActualizar")));
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
      toast.error(t("Configuracoes.naoFoiPossivelConfirmar"));
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
        t("Configuracoes.contaAgendadaParaEliminacao")
      );
      navigate(localizar("/"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("Configuracoes.naoFoiPossivelAgendar")));
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
            <h1 className="text-3xl md:text-4xl font-bold text-primary">{t("Configuracoes.configuracoesDaConta")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("Configuracoes.giraAsSuasPreferencias")}
            </p>
          </header>

          {!isLoggedIn && (
            <Card className="mb-6 border-teal/40 bg-teal/5">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-foreground">
                  {t("Configuracoes.inicieSessaoParaGuardar")}
                </p>
                <Button size="sm" onClick={() => navigate(localizar("/auth"))}>{t("Configuracoes.entrar")}</Button>
              </CardContent>
            </Card>
          )}

          {/* Notificações */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Bell className="w-5 h-5 text-teal" />{" "}{t("Configuracoes.preferenciasDeNotificacao")}
              </CardTitle>
              <CardDescription>{t("Configuracoes.escolhaOsEmailsQue")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="n-updates" className="font-medium">{t("Configuracoes.actualizacoesDeProjectosE")}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{t("Configuracoes.recebaEmailsSobreO")}</p>
                </div>
                <Switch
                  id="n-updates"
                  checked={notif.notificacoes_projetos}
                  onCheckedChange={() => handleToggle("notificacoes_projetos")}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="n-ex" className="font-medium">{t("Configuracoes.lembretesDeExerciciosVisuais")}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{t("Configuracoes.lembretesSemanaisParaPraticar")}</p>
                </div>
                <Switch
                  id="n-ex"
                  checked={notif.notificacoes_lembretes}
                  onCheckedChange={() => handleToggle("notificacoes_lembretes")}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="n-com" className="font-medium">{t("Configuracoes.novasHistoriasDaComunidade")}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{t("Configuracoes.alertasParaNovasPublicacoes")}</p>
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
                <Lock className="w-5 h-5 text-teal" />{" "}{t("Configuracoes.privacidadeESeguranca")}
              </CardTitle>
              <CardDescription>{t("Configuracoes.controleOAcessoA")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{t("Configuracoes.palavraPasse")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("Configuracoes.altereASuaPalavra")}</p>
                </div>
                <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                  <KeyRound className="w-4 h-4 mr-2" />{" "}{t("Configuracoes.mudarPalavraPasse")}
                </Button>
              </div>
              <div className="flex items-start justify-between gap-4 pt-2 border-t border-border/50">
                <div className="pt-4">
                  <Label htmlFor="pub" className="font-medium">{t("Configuracoes.perfilPublico")}</Label>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    {t("Configuracoes.permitirQueAEquipa")}
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
                <ShieldAlert className="w-5 h-5" />{" "}{t("Configuracoes.zonaDePerigo")}
              </CardTitle>
              <CardDescription>{t("Configuracoes.accoesIrreversiveisRelacionadasCom")}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{t("Configuracoes.eliminarConta")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("Configuracoes.apagaPermanentementeOSeu")}
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" />{" "}{t("Configuracoes.eliminarConta")}
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
            <DialogTitle>{t("Configuracoes.mudarPalavraPasse")}</DialogTitle>
            <DialogDescription>
              {t("Configuracoes.introduzaASuaPalavra")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cur">{t("Configuracoes.palavraPasseActual")}</Label>
              <Input id="cur" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new">{t("Configuracoes.novaPalavraPasse")}</Label>
              <Input id="new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="conf">{t("Configuracoes.confirmarNovaPalavraPasse")}</Label>
              <Input id="conf" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)} disabled={passwordLoading}>
              {t("Configuracoes.cancelar")}
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={passwordLoading}>
              {passwordLoading ? t("Configuracoes.aGuardar") : t("Configuracoes.guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Configuracoes.temACerteza")}</AlertDialogTitle>
            <AlertDialogDescription>
              <Trans i18nKey="Configuracoes.aSuaContaFicara" components={{ strong: <strong /> }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>{t("Configuracoes.cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? t("Configuracoes.aAgendar") : t("Configuracoes.agendarEliminacao")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Configuracoes;

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, KeyRound, Lock, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import { MolduraApp } from "@/components/app/MolduraApp";
import ConsentimentoSaudeDefinicoes from "@/components/ConsentimentoSaudeDefinicoes";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { CampoPassword } from "@/design/componentes/CampoPassword";
import { Dialogo, DialogoConteudo, DialogoFechar } from "@/design/componentes/Dialogo";
import { OpcaoConfirmar } from "@/design/componentes/OpcaoConfirmar";
import { localizar } from "@/i18n/rotas";
import { perfilApi, contaApi, mensagemDeErroApi } from "@/lib/apiClient";
import { erroDePasswordFraca } from "@/lib/validarPassword";

type ChaveNotificacao = "notificacoes_projetos" | "notificacoes_lembretes" | "notificacoes_comunidade";

const Seccao = ({ id, icone, titulo, descricao, children }: { id: string; icone: ReactNode; titulo: string; descricao?: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="rounded-cartao border border-linha bg-superficie p-5">
    <h2 id={id} className="flex items-center gap-2 text-titulo-p text-tinta">
      <span aria-hidden className="text-accao [&_svg]:size-5">
        {icone}
      </span>
      {titulo}
    </h2>
    {descricao && <p className="mt-1 text-corpo text-tinta-suave">{descricao}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

/**
 * Definições da conta (arquétipo App). Notificações gravadas uma a uma, a
 * palavra-passe, o consentimento para dados de saúde e a eliminação da conta.
 *
 * Até 2026-10-09 havia um interruptor "Perfil público" (ligado por omissão,
 * "a equipa médica e outros utilizadores vêem o meu progresso") que não
 * gravava nada nem existia na API: mostrava "Preferências guardadas" e mais
 * nada. Saiu -- o progresso só se partilha pelo link do médico, que a pessoa
 * cria e revoga no relatório.
 */
const Configuracoes = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading, logout } = useAuth();
  const { profile, setProfile } = useProfile();

  const [notif, setNotif] = useState<Record<ChaveNotificacao, boolean>>({
    notificacoes_projetos: true,
    notificacoes_lembretes: true,
    notificacoes_comunidade: true,
  });
  const [erroNotif, setErroNotif] = useState<string | null>(null);

  // Hidrata só uma vez a partir de `profile` (CLAUDE.md §6): sem isto, a
  // resposta de um pedido revertia o estado optimista de outra opção mudada
  // entretanto.
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

  // As definições são da conta: sem sessão, entrar primeiro e voltar aqui.
  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate(localizar(`/auth?next=${encodeURIComponent("/configuracoes")}`));
  }, [authLoading, isLoggedIn, navigate]);

  const mudarNotificacao = async (chave: ChaveNotificacao, novoValor: boolean) => {
    if (!profile) return;
    setErroNotif(null);
    setNotif((p) => ({ ...p, [chave]: novoValor })); // optimista
    try {
      const data = await perfilApi.atualizar({ [chave]: novoValor });
      setProfile({ ...profile, ...data, nome_completo: data.nome_completo ?? "" });
      toast.success(t("Configuracoes.preferenciaGuardada"), { duration: 1800 });
    } catch {
      setNotif((p) => ({ ...p, [chave]: !novoValor })); // reverte: nunca fica marcado o que não se gravou
      setErroNotif(t("Configuracoes.naoFoiPossivelGuardar"));
    }
  };

  // --- Palavra-passe ---
  const [passwordAberto, setPasswordAberto] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [tentouPw, setTentouPw] = useState(false);
  const [erroPw, setErroPw] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const errosPw = {
    actual: !currentPw ? t("Configuracoes.escrevaAPalavraPasseActual") : undefined,
    nova: !newPw ? t("Configuracoes.escrevaANovaPalavraPasse") : (erroDePasswordFraca(newPw) ?? undefined),
    confirmar: newPw !== confirmPw ? t("Configuracoes.asNovasNaoCoincidem") : undefined,
  };

  const fecharPassword = () => {
    if (passwordLoading) return;
    setPasswordAberto(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setTentouPw(false);
    setErroPw(null);
  };

  const mudarPassword = async (e: FormEvent) => {
    e.preventDefault();
    setTentouPw(true);
    setErroPw(null);
    if (Object.values(errosPw).some(Boolean)) return;
    setPasswordLoading(true);
    try {
      // A API verifica a palavra-passe actual antes de a mudar (ContaService).
      await contaApi.mudarPassword(currentPw, newPw);
      setPasswordLoading(false);
      fecharPassword();
      toast.success(t("Configuracoes.palavraPasseActualizadaCom"));
    } catch (err) {
      setErroPw(mensagemDeErroApi(err, t("Configuracoes.naoFoiPossivelActualizar")));
      setPasswordLoading(false);
    }
  };

  // --- Eliminar conta ---
  const [eliminarAberto, setEliminarAberto] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [erroEliminar, setErroEliminar] = useState<string | null>(null);

  const agendarEliminacao = async () => {
    setDeleteLoading(true);
    setErroEliminar(null);
    try {
      // Não apaga já: a API agenda para daqui a 30 dias e termina a sessão.
      // Voltar a entrar antes dessa data cancela o pedido (AuthContext.tsx).
      await contaApi.eliminar();
      setEliminarAberto(false);
      logout();
      toast.success(t("Configuracoes.contaAgendadaParaEliminacao"));
      navigate(localizar("/"));
    } catch (err) {
      setErroEliminar(mensagemDeErroApi(err, t("Configuracoes.naoFoiPossivelAgendar")));
    } finally {
      setDeleteLoading(false);
    }
  };

  const textosPassword = { mostrar: t("Auth.mostrar"), esconder: t("Auth.esconder") };
  const NOTIFICACOES: { chave: ChaveNotificacao; rotulo: string; descricao: string }[] = [
    { chave: "notificacoes_lembretes", rotulo: t("Configuracoes.lembretesDeExerciciosVisuais"), descricao: t("Configuracoes.lembretesSemanaisParaPraticar") },
    { chave: "notificacoes_projetos", rotulo: t("Configuracoes.actualizacoesDeProjectosE"), descricao: t("Configuracoes.recebaEmailsSobreO") },
    { chave: "notificacoes_comunidade", rotulo: t("Configuracoes.novasHistoriasDaComunidade"), descricao: t("Configuracoes.alertasParaNovasPublicacoes") },
  ];

  return (
    <MolduraApp titulo={t("Configuracoes.configuracoesDaConta")} subtitulo={t("Configuracoes.giraAsSuasPreferencias")}>
      <div className="max-w-3xl space-y-6">
        <Seccao id="definicoes-notificacoes" icone={<Bell />} titulo={t("Configuracoes.preferenciasDeNotificacao")} descricao={t("Configuracoes.escolhaOsEmailsQue")}>
          <div className="space-y-3">
            {NOTIFICACOES.map((n) => (
              <OpcaoConfirmar
                key={n.chave}
                rotulo={n.rotulo}
                descricao={n.descricao}
                marcada={notif[n.chave]}
                aoMudar={(v) => void mudarNotificacao(n.chave, v)}
              />
            ))}
          </div>
          {erroNotif && (
            <Aviso variante="erro" anunciar className="mt-4">
              {erroNotif}
            </Aviso>
          )}
        </Seccao>

        <Seccao id="definicoes-seguranca" icone={<Lock />} titulo={t("Configuracoes.palavraPasse")} descricao={t("Configuracoes.altereASuaPalavra")}>
          <Dialogo open={passwordAberto} onOpenChange={(v) => (v ? setPasswordAberto(true) : fecharPassword())}>
            <Botao variante="secundario" onClick={() => setPasswordAberto(true)}>
              <KeyRound aria-hidden /> {t("Configuracoes.mudarPalavraPasse")}
            </Botao>
            <DialogoConteudo
              titulo={t("Configuracoes.mudarPalavraPasse")}
              descricao={t("Configuracoes.introduzaASuaPalavra")}
              rotuloFechar={t("Configuracoes.fechar")}
            >
              <form onSubmit={(e) => void mudarPassword(e)} noValidate className="flex flex-col gap-5">
                <CampoPassword
                  rotulo={t("Configuracoes.palavraPasseActual")}
                  autoComplete="current-password"
                  textos={textosPassword}
                  value={currentPw}
                  erro={tentouPw ? errosPw.actual : undefined}
                  onChange={(e) => setCurrentPw(e.target.value)}
                />
                <CampoPassword
                  rotulo={t("Configuracoes.novaPalavraPasse")}
                  ajuda={t("Auth.peloMenos8Caracteres")}
                  autoComplete="new-password"
                  textos={textosPassword}
                  value={newPw}
                  erro={tentouPw ? errosPw.nova : undefined}
                  onChange={(e) => setNewPw(e.target.value)}
                />
                <CampoPassword
                  rotulo={t("Configuracoes.confirmarNovaPalavraPasse")}
                  autoComplete="new-password"
                  textos={textosPassword}
                  value={confirmPw}
                  erro={tentouPw ? errosPw.confirmar : undefined}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
                {erroPw && (
                  <Aviso variante="erro" anunciar>
                    {erroPw}
                  </Aviso>
                )}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <DialogoFechar asChild>
                    <Botao variante="secundario" disabled={passwordLoading}>
                      {t("Configuracoes.cancelar")}
                    </Botao>
                  </DialogoFechar>
                  <Botao type="submit" aCarregar={passwordLoading}>
                    {t("Configuracoes.guardar")}
                  </Botao>
                </div>
              </form>
            </DialogoConteudo>
          </Dialogo>
        </Seccao>

        {isLoggedIn && <ConsentimentoSaudeDefinicoes />}

        <section aria-labelledby="definicoes-eliminar" className="rounded-cartao border border-erro/40 bg-superficie p-5">
          <h2 id="definicoes-eliminar" className="flex items-center gap-2 text-titulo-p text-tinta">
            <ShieldAlert className="size-5 text-erro" aria-hidden /> {t("Configuracoes.eliminarConta")}
          </h2>
          <p className="mt-1 text-corpo text-tinta-suave">{t("Configuracoes.apagaPermanentementeOSeu")}</p>
          <Dialogo
            open={eliminarAberto}
            onOpenChange={(v) => {
              if (deleteLoading) return;
              setEliminarAberto(v);
              setErroEliminar(null);
            }}
          >
            <Botao variante="perigo" className="mt-4" onClick={() => setEliminarAberto(true)}>
              <Trash2 aria-hidden /> {t("Configuracoes.eliminarConta")}
            </Botao>
            <DialogoConteudo
              titulo={t("Configuracoes.temACerteza")}
              descricao={<Trans i18nKey="Configuracoes.aSuaContaFicara" components={{ strong: <strong /> }} />}
              rotuloFechar={t("Configuracoes.fechar")}
              rodape={
                <>
                  <DialogoFechar asChild>
                    <Botao variante="secundario" disabled={deleteLoading}>
                      {t("Configuracoes.cancelar")}
                    </Botao>
                  </DialogoFechar>
                  <Botao variante="perigo" aCarregar={deleteLoading} onClick={() => void agendarEliminacao()}>
                    {t("Configuracoes.agendarEliminacao")}
                  </Botao>
                </>
              }
            >
              {erroEliminar && (
                <Aviso variante="erro" anunciar>
                  {erroEliminar}
                </Aviso>
              )}
            </DialogoConteudo>
          </Dialogo>
        </section>
      </div>
    </MolduraApp>
  );
};

export default Configuracoes;

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gem, Loader2, Lock, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  jogoApi,
  mensagemDeErroApi,
  type AjudaMercado,
  type MercadoJogo,
  type RespostaOpcaoJogo,
  type VendedorMercado,
} from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/design/cn";
import { formatarTempoRestante, msRestantes, nivelDeCerteza } from "@/pages/jogo/mercadoConfig";

// Cor da barra de certeza, por nível (o nível também se lê em texto ao lado).
const COR_CERTEZA = {
  baixa: "bg-erro",
  media: "bg-aviso",
  alta: "bg-accao",
  muitoAlta: "bg-sucesso",
} as const;

interface MercadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perguntaId: string;
  /** Opções já escondidas no ecrã (ex.: pelo 50:50). */
  opcoesExcluidas: RespostaOpcaoJogo[];
  onAjudaComprada: (ajuda: AjudaMercado) => void;
}

/**
 * Consultório (no código ainda "Mercado") -- ajuda paga por diamantes, aberta
 * durante a partida. Cada profissional de saúde ocular dá uma opinião sobre
 * a resposta; quanto mais experiente, mais fiável, e a certeza muda com o
 * pergunta (categoria, patamar da partida e a própria pergunta -- calculado
 * na API). De propósito, o cartão não explica porquê: o jogador infere a
 * especialidade pela profissão e pela percentagem. Depois de uma consulta,
 * o profissional fica ocupado 4h para este jogador (cronómetro no cartão). Tudo o que importa -- custo, precisão, bloqueio, saldo -- é
 * decidido e guardado pela API; aqui só se mostra.
 */
const MercadoModal = ({ open, onOpenChange, perguntaId, opcoesExcluidas, onAjudaComprada }: MercadoModalProps) => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { perfil, definirPerfil } = useCarteiraJogo();
  const [mercado, setMercado] = useState<MercadoJogo | null>(null);
  // Hora do servidor - hora do dispositivo, medida ao carregar o Mercado.
  const [desvioMs, setDesvioMs] = useState(0);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState(false);
  const [aComprar, setAComprar] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [ajuda, setAjuda] = useState<AjudaMercado | null>(null);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(false);
    try {
      const resposta = await jogoApi.obterMercado();
      setDesvioMs(new Date(resposta.agora).getTime() - Date.now());
      setMercado(resposta);
    } catch (err) {
      console.error("Falha ao carregar o Mercado:", err);
      setErro(true);
    } finally {
      setACarregar(false);
    }
  }, []);

  const utilizadorId = profile?.id ?? null;
  useEffect(() => {
    if (open) setAjuda(null);
  }, [open]);
  useEffect(() => {
    if (open && utilizadorId) void carregar();
  }, [open, utilizadorId, carregar]);

  // Cronómetro -- só corre com o modal aberto e algum vendedor bloqueado.
  const algumBloqueado = !!mercado?.vendedores.some((v) => v.disponivel_em);
  useEffect(() => {
    if (!open || !algumBloqueado) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, algumBloqueado]);

  const comprar = async (vendedor: VendedorMercado) => {
    setAComprar(vendedor.id);
    try {
      const resposta = await jogoApi.comprarAjudaMercado(vendedor.id, perguntaId, opcoesExcluidas);
      definirPerfil(resposta.perfil);
      setMercado((atual) =>
        atual && {
          ...atual,
          vendedores: atual.vendedores.map((v) =>
            v.id === vendedor.id ? { ...v, disponivel_em: resposta.disponivel_em } : v
          ),
        }
      );
      setAjuda(resposta);
      onAjudaComprada(resposta);
    } catch (err) {
      // Nunca mostrar a "sugestão" a partir daqui -- sem resposta da API não
      // houve compra (CLAUDE.md secção 6).
      const status = (err as { status?: unknown } | null)?.status;
      if (status === 402) {
        toast.error(t("Mercado.diamantesInsuficientes"));
      } else if (status === 409) {
        toast.error(t("Mercado.vendedorBloqueado"));
        void carregar();
      } else {
        toast.error(mensagemDeErroApi(err, t("Mercado.naoFoiPossivelComprar")));
      }
    } finally {
      setAComprar(null);
    }
  };

  const saldo = perfil?.diamantes ?? 0;

  return (
    <Dialogo open={open} onOpenChange={(aberto) => !aComprar && onOpenChange(aberto)}>
      <DialogoConteudo
        titulo={t("Mercado.titulo")}
        descricao={t("Mercado.descricao")}
        rotuloFechar={t("Mercado.fechar")}
      >
        {mercado?.categoria && (
          <p className="mb-4 text-legenda font-medium text-accao">
            {t("Mercado.temaDaPergunta", {
              categoria: t(`PerfilJogador.categorias.${mercado.categoria}`, { defaultValue: mercado.categoria }),
            })}
          </p>
        )}

        {!profile && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-corpo text-tinta-suave">{t("Mercado.inicieSessao")}</p>
            <Botao asChild>
              <Link to={localizar("/auth")}>{t("Mercado.entrar")}</Link>
            </Botao>
          </div>
        )}

        {profile && ajuda && (
          <div className="space-y-3 rounded-controlo border-l-4 border-accao bg-accao-suave p-4" role="status">
            <p className="flex items-start gap-2 text-corpo text-tinta">
              <MessageCircle className="mt-1 size-5 shrink-0 text-accao" aria-hidden />
              <span>
                <span className="font-medium">{t(`Mercado.vendedores.${ajuda.vendedor_id}.nome`)}: </span>
                {t(`Mercado.vendedores.${ajuda.vendedor_id}.resposta`, { opcao: ajuda.resposta_sugerida })}
              </span>
            </p>
            <p className="text-legenda text-tinta-suave">{t("Mercado.avisoSugestao")}</p>
            <Botao larguraTotal onClick={() => onOpenChange(false)}>
              {t("Mercado.voltarAPergunta")}
            </Botao>
          </div>
        )}

        {profile && !ajuda && (
          <>
            <div className="mb-3 flex items-center justify-between text-corpo">
              <span className="text-tinta-suave">{t("Mercado.oSeuSaldo")}</span>
              <span className="inline-flex items-center gap-1 font-medium tabular-nums text-tinta">
                <Gem className="size-4 text-accao" aria-hidden />
                {saldo}
              </span>
            </div>

            {aCarregar && !mercado && (
              <p role="status" className="flex items-center justify-center gap-2 py-10 text-corpo text-tinta-suave">
                <Loader2 className="size-5 animate-spin text-accao" aria-hidden />
                {t("Mercado.aCarregar")}
              </p>
            )}

            {erro && !aCarregar && (
              <Aviso
                variante="erro"
                anunciar
                accao={
                  <Botao variante="secundario" onClick={() => void carregar()}>
                    <RefreshCw aria-hidden />
                    {t("Mercado.tentarNovamente")}
                  </Botao>
                }
              >
                {t("Mercado.naoFoiPossivelCarregar")}
              </Aviso>
            )}

            {mercado && (
              <ul className="space-y-3">
                {mercado.vendedores.map((vendedor) => {
                  const restante = msRestantes(vendedor.disponivel_em, agora, desvioMs);
                  const bloqueado = restante > 0;
                  const semSaldo = saldo < vendedor.custo_diamantes;
                  const nivel = nivelDeCerteza(vendedor.precisao);
                  const nome = t(`Mercado.vendedores.${vendedor.id}.nome`, { defaultValue: vendedor.id });
                  return (
                    <li
                      key={vendedor.id}
                      data-testid={`vendedor-${vendedor.id}`}
                      className={cn(
                        "flex gap-3 rounded-cartao border border-linha p-4",
                        bloqueado ? "bg-superficie-alt" : "bg-superficie",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-12 shrink-0 items-center justify-center rounded-pilula font-medium",
                          bloqueado ? "bg-linha text-tinta-suave" : "bg-accao-suave text-accao",
                        )}
                        aria-hidden
                      >
                        {nome
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn("text-corpo font-medium", bloqueado ? "text-tinta-suave" : "text-tinta")}>
                              {nome}
                            </p>
                            <p className="text-legenda text-tinta-suave">
                              {t(`Mercado.vendedores.${vendedor.id}.profissao`, { defaultValue: "" })}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 font-medium tabular-nums text-tinta">
                            <Gem className="size-4 text-accao" aria-hidden />
                            {vendedor.custo_diamantes}
                          </span>
                        </div>

                        {!bloqueado && (
                          <p className="text-legenda italic text-tinta-suave">
                            “{t(`Mercado.vendedores.${vendedor.id}.bordao`, { defaultValue: "" })}”
                          </p>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-legenda">
                            <span className="text-tinta-suave">{t("Mercado.certeza")}</span>
                            <span className="font-medium text-tinta">
                              {t(`Mercado.nivel.${nivel}`)} · {Math.round(vendedor.precisao * 100)}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-pilula bg-linha" aria-hidden>
                            <div
                              className={cn("h-full rounded-pilula", COR_CERTEZA[nivel])}
                              style={{ width: `${vendedor.precisao * 100}%` }}
                            />
                          </div>
                        </div>

                        {bloqueado ? (
                          <p
                            className="inline-flex items-center gap-1.5 text-legenda font-medium text-tinta-suave"
                            role="timer"
                            aria-label={t("Mercado.disponivelDaquiA", { tempo: formatarTempoRestante(restante) })}
                          >
                            <Lock className="size-4" aria-hidden />
                            <span className="tabular-nums">{formatarTempoRestante(restante)}</span>
                          </p>
                        ) : (
                          <Botao
                            variante="secundario"
                            larguraTotal
                            disabled={semSaldo || (aComprar !== null && aComprar !== vendedor.id)}
                            aCarregar={aComprar === vendedor.id}
                            onClick={() => void comprar(vendedor)}
                            aria-label={t("Mercado.comprarA", { nome, custo: vendedor.custo_diamantes })}
                          >
                            {semSaldo ? t("Mercado.saldoInsuficiente") : t("Mercado.comprar")}
                          </Botao>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Sem link directo para a Loja: sair daqui abandonava a partida em curso. */}
            <p className="mt-4 text-center text-legenda text-tinta-suave">{t("Mercado.precisaDeMaisDiamantes")}</p>
          </>
        )}
      </DialogoConteudo>
    </Dialogo>
  );
};

export default MercadoModal;

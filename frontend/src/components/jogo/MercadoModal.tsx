import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gem, Loader2, Lock, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { formatarTempoRestante, msRestantes, nivelDeCerteza } from "@/pages/jogo/mercadoConfig";

// Só apresentação -- cor e iniciais do "avatar" de cada profissional.
const COR_VENDEDOR: Record<string, string> = {
  "estudante-medicina": "bg-orange-500/15 text-orange-600",
  "enfermeira-oftalmica": "bg-pink-500/15 text-pink-600",
  optometrista: "bg-teal/15 text-teal",
  oftalmologista: "bg-gold/20 text-gold",
};

const COR_CERTEZA = {
  baixa: "bg-destructive",
  media: "bg-orange-500",
  alta: "bg-teal",
  muitoAlta: "bg-green",
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
    <Dialog open={open} onOpenChange={(aberto) => !aComprar && onOpenChange(aberto)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("Mercado.titulo")}</DialogTitle>
          <DialogDescription>{t("Mercado.descricao")}</DialogDescription>
          {mercado?.categoria && (
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">
              {t("Mercado.temaDaPergunta", {
                categoria: t(`PerfilJogador.categorias.${mercado.categoria}`, { defaultValue: mercado.categoria }),
              })}
            </p>
          )}
        </DialogHeader>

        {!profile && (
          <div className="space-y-3 text-center py-4">
            <p className="text-sm text-muted-foreground">{t("Mercado.inicieSessao")}</p>
            <Button asChild className="bg-teal text-teal-foreground hover:bg-teal/90">
              <Link to={localizar("/auth")}>{t("Mercado.entrar")}</Link>
            </Button>
          </div>
        )}

        {profile && ajuda && (
          <div className="rounded-xl bg-teal/10 border border-teal/40 p-4 space-y-3" role="status">
            <p className="flex items-start gap-2 text-foreground">
              <MessageCircle className="w-5 h-5 text-teal shrink-0 mt-0.5" />
              <span>
                <span className="font-bold">{t(`Mercado.vendedores.${ajuda.vendedor_id}.nome`)}: </span>
                {t(`Mercado.vendedores.${ajuda.vendedor_id}.resposta`, { opcao: ajuda.resposta_sugerida })}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{t("Mercado.avisoSugestao")}</p>
            <Button onClick={() => onOpenChange(false)} className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
              {t("Mercado.voltarAPergunta")}
            </Button>
          </div>
        )}

        {profile && !ajuda && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("Mercado.oSeuSaldo")}</span>
              <span className="inline-flex items-center gap-1 font-bold text-teal">
                <Gem className="w-4 h-4" />
                {saldo}
              </span>
            </div>

            {aCarregar && !mercado && (
              <div className="flex justify-center py-10">
                <Loader2 className="w-7 h-7 animate-spin text-teal" />
              </div>
            )}

            {erro && !aCarregar && (
              <div className="text-center space-y-3 py-4">
                <p className="text-sm text-muted-foreground">{t("Mercado.naoFoiPossivelCarregar")}</p>
                <Button variant="outline" onClick={() => void carregar()}>
                  <RefreshCw className="w-4 h-4" />
                  {t("Mercado.tentarNovamente")}
                </Button>
              </div>
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
                        "rounded-xl border p-4 flex gap-3",
                        bloqueado ? "bg-muted/60 border-border" : "bg-card border-border/60"
                      )}
                    >
                      <div
                        className={cn(
                          "w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold",
                          bloqueado ? "bg-muted text-muted-foreground" : COR_VENDEDOR[vendedor.id] ?? "bg-muted"
                        )}
                        aria-hidden
                      >
                        {nome
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn("font-bold", bloqueado ? "text-muted-foreground" : "text-foreground")}>
                              {nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(`Mercado.vendedores.${vendedor.id}.profissao`, { defaultValue: "" })}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 font-bold text-teal shrink-0">
                            <Gem className="w-4 h-4" />
                            {vendedor.custo_diamantes}
                          </span>
                        </div>

                        {!bloqueado && (
                          <p className="text-sm italic text-foreground/80">
                            “{t(`Mercado.vendedores.${vendedor.id}.bordao`, { defaultValue: "" })}”
                          </p>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("Mercado.certeza")}</span>
                            <span className="font-semibold text-foreground">
                              {t(`Mercado.nivel.${nivel}`)} · {Math.round(vendedor.precisao * 100)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", COR_CERTEZA[nivel])}
                              style={{ width: `${vendedor.precisao * 100}%` }}
                            />
                          </div>
                        </div>

                        {bloqueado ? (
                          <p
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
                            role="timer"
                            aria-label={t("Mercado.disponivelDaquiA", { tempo: formatarTempoRestante(restante) })}
                          >
                            <Lock className="w-4 h-4" />
                            <span className="tabular-nums">{formatarTempoRestante(restante)}</span>
                          </p>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                            disabled={semSaldo || aComprar !== null}
                            onClick={() => void comprar(vendedor)}
                            aria-label={t("Mercado.comprarA", { nome, custo: vendedor.custo_diamantes })}
                          >
                            {aComprar === vendedor.id && <Loader2 className="w-4 h-4 animate-spin" />}
                            {semSaldo ? t("Mercado.saldoInsuficiente") : t("Mercado.comprar")}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Sem link directo para a Loja: sair daqui abandonava a partida em curso. */}
            <p className="text-center text-xs text-muted-foreground">{t("Mercado.precisaDeMaisDiamantes")}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MercadoModal;

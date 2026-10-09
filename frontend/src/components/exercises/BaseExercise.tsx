import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info, Lock, LogOut, Play, ShieldCheck, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { useConsentimentoSaude } from "@/contexts/ConsentimentoSaudeContext";
import {
  useAcaoDesbloqueio,
  type GrupoExercicio,
  type TipoDesbloqueio,
} from "@/components/exercises/useAcaoDesbloqueio";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/lib/utils";

// Chaves escritas por extenso (não montadas com `${tipo}`) para continuarem
// a aparecer numa pesquisa pelo nome da chave.
const TEXTOS_BLOQUEIO: Record<TipoDesbloqueio, { titulo: string; texto: string; botao: string }> = {
  criar_conta: {
    titulo: "BaseExercise.tituloCriarConta",
    texto: "BaseExercise.textoCriarConta",
    botao: "BaseExercise.botaoCriarConta",
  },
  iniciar_trial: {
    titulo: "BaseExercise.tituloIniciarTrial",
    texto: "BaseExercise.textoIniciarTrial",
    botao: "BaseExercise.botaoIniciarTrial",
  },
  premium: {
    titulo: "BaseExercise.tituloPremium",
    texto: "BaseExercise.textoPremium",
    botao: "BaseExercise.botaoPremium",
  },
};

export type TipoExercicio = "teste" | "treino";

/** Aviso obrigatório em todos os ecrãs de um teste ou treino. */
export const AvisoExercicio = ({ tipo, className }: { tipo: TipoExercicio; className?: string }) => {
  const { t } = useTranslation();
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-navy/15 bg-navy/[0.03] px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy dark:text-foreground" aria-hidden />
      <span>{tipo === "teste" ? t("Visao.avisoTeste") : t("Visao.avisoTreino")}</span>
    </p>
  );
};

/** Indicador de passos do assistente ("Passo 2 de 5" + barra). */
export const IndicadorPassos = ({ passos, actual }: { passos: readonly string[]; actual: number }) => {
  const { t } = useTranslation();
  if (!passos.length) return null;
  return (
    <div className="px-5 pt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground" aria-live="polite">
        {t("Visao.passoDe", { actual: actual + 1, total: passos.length })} · {passos[actual]}
      </p>
      <ol className="flex gap-1.5" aria-hidden>
        {passos.map((p, i) => (
          <li
            key={`${p}-${i}`}
            className={cn("h-1.5 flex-1 rounded-full", i <= actual ? "bg-teal" : "bg-muted")}
          />
        ))}
      </ol>
    </div>
  );
};

interface BaseExerciseProps {
  title: string;
  description: string;
  /** Id do exercício tal como a API o conhece (ex.: `"figure8"`). */
  exercicioId: string;
  /** Grupo do exercício: incluído no teste de 7 dias, ou só Premium. */
  grupo: GrupoExercicio;
  tipo: TipoExercicio;
  /** Nomes dos passos do assistente (vazio = sem indicador). */
  passos?: readonly string[];
  passoActual?: number;
  children: ReactNode;
}

/**
 * Casca dos exercícios de visão: cabeçalho com "Sair", indicador de passos,
 * aviso de triagem/treino em todos os ecrãs e bloqueio de conteúdo pago
 * (Premium ou teste de 7 dias, estado vindo da API).
 *
 * Desde 2026-09-28 **sem câmara**: os exercícios são testes e treinos com
 * resposta do utilizador. Cada exercício gere o seu próprio fluxo; aqui só
 * fica o que é comum. Enquanto o acesso não está confirmado pela API, o
 * conteúdo nem é montado (nunca desbloquear por omissão).
 *
 * Os resultados são dados de saúde: sem consentimento (Lei 22/11, art. 14.º)
 * o exercício também não é montado, para ninguém fazer um teste que a API
 * depois se recusaria a gravar.
 */
const BaseExercise = ({
  title,
  description,
  exercicioId,
  grupo,
  tipo,
  passos = [],
  passoActual = 0,
  children,
}: BaseExerciseProps) => {
  const { t } = useTranslation();
  const { temAcesso, loading: acessoLoading } = useAcessoExercicios();
  const { tipoPara, executar, aIniciarTrial } = useAcaoDesbloqueio();

  const { consentido, carregando: consentimentoLoading, garantir } = useConsentimentoSaude();

  const locked = acessoLoading || !temAcesso(exercicioId);
  const tipoDesbloqueio = acessoLoading ? null : tipoPara(exercicioId, grupo);
  const pedeConsentimento = !locked && !consentimentoLoading && !consentido;
  const bloqueado = locked || consentimentoLoading || !consentido;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="shrink-0 gap-2">
          <Link to={localizar("/exercicios")} aria-label={t("BaseExercise.sairDoExercicio")}>
            <LogOut className="h-4 w-4" />
            {t("BaseExercise.sair")}
          </Link>
        </Button>
      </div>

      {!bloqueado && <IndicadorPassos passos={passos} actual={passoActual} />}

      <div className="px-5 pt-4">
        <AvisoExercicio tipo={tipo} />
      </div>

      <div className="relative">
        {bloqueado ? (
          <div className="h-[360px]" aria-hidden />
        ) : (
          <div className="p-5">{children}</div>
        )}

        {pedeConsentimento && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-elevated">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy/10 text-navy">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-foreground">{t("ConsentimentoSaude.antesDeComecar")}</h2>
              <p className="mb-4 text-sm text-muted-foreground">{t("ConsentimentoSaude.antesDeComecarTexto")}</p>
              <Button
                onClick={() => void garantir()}
                className="w-full gap-2 bg-navy text-navy-foreground hover:bg-navy/90"
              >
                <ShieldCheck className="h-4 w-4" />
                {t("ConsentimentoSaude.lerEAceitar")}
              </Button>
            </div>
          </div>
        )}

        {locked && tipoDesbloqueio && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-elevated">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy/10 text-navy">
                <Lock className="h-5 w-5" />
              </div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">
                {tipoDesbloqueio === "premium"
                  ? t("BaseExercise.conteudoPremium")
                  : t("BaseExercise.incluidoNoTeste")}
              </p>
              <h2 className="mb-2 text-lg font-bold text-foreground">
                {t(TEXTOS_BLOQUEIO[tipoDesbloqueio].titulo)}
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">{t(TEXTOS_BLOQUEIO[tipoDesbloqueio].texto)}</p>
              <Button
                onClick={() => void executar(tipoDesbloqueio)}
                disabled={aIniciarTrial}
                className="w-full gap-2 bg-navy text-navy-foreground hover:bg-navy/90"
              >
                {tipoDesbloqueio === "criar_conta" && <UserPlus className="h-4 w-4" />}
                {tipoDesbloqueio === "iniciar_trial" && <Play className="h-4 w-4" />}
                {tipoDesbloqueio === "premium" && <Lock className="h-4 w-4" />}
                {t(TEXTOS_BLOQUEIO[tipoDesbloqueio].botao)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseExercise;

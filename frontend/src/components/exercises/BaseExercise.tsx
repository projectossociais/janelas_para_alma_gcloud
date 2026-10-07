import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Play, ShieldCheck, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { useConsentimentoSaude } from "@/contexts/ConsentimentoSaudeContext";
import {
  useAcaoDesbloqueio,
  type GrupoExercicio,
  type TipoDesbloqueio,
} from "@/components/exercises/useAcaoDesbloqueio";
import { Botao } from "@/design/componentes/Botao";
import { cn } from "@/design/cn";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { localizar } from "@/i18n/rotas";

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

const ICONE_BLOQUEIO: Record<TipoDesbloqueio, ReactNode> = {
  criar_conta: <UserPlus aria-hidden />,
  iniciar_trial: <Play aria-hidden />,
  premium: <Lock aria-hidden />,
};

export type TipoExercicio = "teste" | "treino";

/**
 * Aviso obrigatório em todos os ecrãs de um teste ou treino (nunca diagnóstico).
 * Uma linha discreta e não uma caixa: repete-se em cada passo e não pode empurrar
 * o exercício para fora do ecrã do telemóvel.
 */
export const AvisoExercicio = ({ tipo, className }: { tipo: TipoExercicio; className?: string }) => {
  const { t } = useTranslation();
  return (
    <p className={cn("flex items-start gap-2 text-legenda text-tinta-suave", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accao" aria-hidden />
      <span>{tipo === "teste" ? t("Visao.avisoTeste") : t("Visao.avisoTreino")}</span>
    </p>
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
  /** Nomes dos passos do assistente (vazio = um só passo). */
  passos?: readonly string[];
  passoActual?: number;
  children: ReactNode;
}

/**
 * Casca dos exercícios de visão, no arquétipo Tarefa (docs/LAYOUTS.md §2.3): sem
 * navegação do site, o passo em que se está e "Sair" (com confirmação a meio, para
 * ninguém perder uma sessão por engano). Lá dentro: título, aviso de triagem/treino
 * em todos os ecrãs, e o bloqueio do conteúdo pago (Premium ou teste de 7 dias,
 * estado vindo da API).
 *
 * Desde 2026-09-28 **sem câmara**: os exercícios são testes e treinos com resposta
 * do utilizador. Cada exercício gere o seu próprio fluxo; aqui só fica o que é comum.
 * Enquanto o acesso não está confirmado pela API, o conteúdo nem é montado (nunca
 * desbloquear por omissão). Os resultados são dados de saúde: sem consentimento
 * (Lei 22/11, art. 14.º) o exercício também não é montado.
 *
 * A coluna é a mais larga das tarefas (`texto`): o cartão de calibração e os
 * estereogramas precisam de espaço. O palco do estímulo continua branco em
 * qualquer tema (CLAUDE.md §6).
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
  const navigate = useNavigate();
  const { temAcesso, loading: acessoLoading } = useAcessoExercicios();
  const { tipoPara, executar } = useAcaoDesbloqueio();
  const { consentido, carregando: consentimentoLoading, garantir } = useConsentimentoSaude();

  const locked = acessoLoading || !temAcesso(exercicioId);
  const tipoDesbloqueio = acessoLoading ? null : tipoPara(exercicioId, grupo);
  const pedeConsentimento = !locked && !consentimentoLoading && !consentido;
  const bloqueado = locked || consentimentoLoading || !consentido;

  const total = Math.max(1, passos.length);
  const actual = bloqueado ? 1 : Math.min(passoActual, total - 1) + 1;
  const nomePasso = !bloqueado && passos.length ? passos[actual - 1] : null;
  const rotuloPasso = nomePasso
    ? `${t("Visao.passoDe", { actual, total })} · ${nomePasso}`
    : t("Visao.passoDe", { actual, total });

  const sair = () => navigate(localizar("/exercicios"));

  return (
    <LayoutTarefa
      tema="claro"
      largura="texto"
      passo={{ actual, total, rotulo: rotuloPasso }}
      sair={{ rotulo: t("BaseExercise.sair"), aoSair: sair }}
      confirmarSaida={
        !bloqueado && passoActual > 0
          ? {
              titulo: t("BaseExercise.confirmarSaidaTitulo"),
              descricao: t("BaseExercise.confirmarSaidaTexto"),
              ficar: t("BaseExercise.ficar"),
              sair: t("BaseExercise.sair"),
              fechar: t("BaseExercise.fechar"),
            }
          : undefined
      }
      textoSaltar={t("BaseExercise.saltar")}
    >
      {/* O título da página é o nome do exercício; cada passo traz o seu próprio título.
          A descrição só no primeiro ecrã: a partir daí, o espaço é do exercício. */}
      <h1 className="text-legenda font-medium text-tinta-suave">{title}</h1>
      {(bloqueado || passoActual === 0) && <p className="mt-1 text-corpo text-tinta">{description}</p>}
      <AvisoExercicio tipo={tipo} className="mt-3" />

      <div className="mt-8">
        {!bloqueado && children}

        {pedeConsentimento && (
          <section aria-labelledby="exercicio-consentimento">
            <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-accao-suave text-accao [&_svg]:size-6">
              <ShieldCheck />
            </span>
            <h2 id="exercicio-consentimento" className="mt-5 text-titulo-m text-tinta">
              {t("ConsentimentoSaude.antesDeComecar")}
            </h2>
            <p className="mt-3 text-corpo text-tinta-suave">{t("ConsentimentoSaude.antesDeComecarTexto")}</p>
            <Botao tamanho="g" larguraTotal className="mt-8" onClick={() => void garantir()}>
              <ShieldCheck aria-hidden />
              {t("ConsentimentoSaude.lerEAceitar")}
            </Botao>
          </section>
        )}

        {locked && tipoDesbloqueio && (
          <section aria-labelledby="exercicio-bloqueio">
            <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-accao-suave text-accao [&_svg]:size-6">
              <Lock />
            </span>
            <p className="mt-5 text-legenda font-medium text-tinta-suave">
              {tipoDesbloqueio === "premium" ? t("BaseExercise.conteudoPremium") : t("BaseExercise.incluidoNoTeste")}
            </p>
            <h2 id="exercicio-bloqueio" className="mt-1 text-titulo-m text-tinta">
              {t(TEXTOS_BLOQUEIO[tipoDesbloqueio].titulo)}
            </h2>
            <p className="mt-3 text-corpo text-tinta-suave">{t(TEXTOS_BLOQUEIO[tipoDesbloqueio].texto)}</p>
            <Botao tamanho="g" larguraTotal className="mt-8" onClick={() => executar(tipoDesbloqueio)}>
              {ICONE_BLOQUEIO[tipoDesbloqueio]}
              {t(TEXTOS_BLOQUEIO[tipoDesbloqueio].botao)}
            </Botao>
          </section>
        )}

        {locked && !tipoDesbloqueio && (
          <p role="status" className="text-corpo text-tinta-suave">
            {t("BaseExercise.aPreparar")}
          </p>
        )}
      </div>
    </LayoutTarefa>
  );
};

export default BaseExercise;

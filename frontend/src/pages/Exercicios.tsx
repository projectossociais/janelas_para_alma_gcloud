import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Contrast,
  Eye,
  Glasses,
  Instagram,
  Layers,
  LineChart,
  Lock,
  Minimize2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sun,
  Target,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import FeedbackWidget from "@/components/FeedbackWidget";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useHistoricoVisao } from "@/components/visao/hooks";
import { nomeDoOlho } from "@/components/visao/rotulos";
import {
  useAcaoDesbloqueio,
  type GrupoExercicio,
  type TipoDesbloqueio,
} from "@/components/exercises/useAcaoDesbloqueio";
import { Botao } from "@/design/componentes/Botao";
import { Cartao, CartaoLigacao, CartaoTexto, CartaoTitulo } from "@/design/componentes/Cartao";
import { cn } from "@/design/cn";
import { Contentor } from "@/design/layouts/Contentor";
import { localizar } from "@/i18n/rotas";
import { evolucaoDestacada } from "@/lib/visao/tendencia";
import { ID_ACUIDADE, ID_ANEIS } from "@/lib/visao/ids";

/**
 * A lista dos 8 testes e treinos (arquétipo Site, docs/LAYOUTS.md §2.1): quem
 * ainda não tem conta também a vê. No topo, o estado do acesso com **uma** acção
 * (criar conta, começar o teste de 7 dias, ver o Premium); por baixo, os dois
 * grupos. O acesso vem sempre da API: aqui só se espelha (nunca desbloquear por
 * omissão).
 */

interface Exercicio {
  /** Id tal como a API o conhece (`sessoes_exercicio.exercicio_id`). */
  id: string;
  /** Teste de triagem ou treino de apoio. */
  tipo: "teste" | "treino";
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  rota: string;
}

// Os ids são os históricos. Desde 2026-09-29 o Treino de Anéis está no trial no
// lugar da Convergência (docs/ANALISE_EXERCICIOS.md).
const EXERCICIOS_TRIAL: readonly Exercicio[] = [
  { id: "figure8", tipo: "teste", titulo: "Visao.acuidadeTitulo", descricao: "Visao.acuidadeCartao", icone: Eye, rota: "/exercicios/acuidade" },
  { id: "ambliopia", tipo: "treino", titulo: "Visao.aneisTitulo", descricao: "Visao.aneisCartao", icone: Glasses, rota: "/exercicios/aneis" },
  { id: "cerebro", tipo: "teste", titulo: "Visao.contrasteTitulo", descricao: "Visao.contrasteCartao", icone: Contrast, rota: "/exercicios/contraste" },
  { id: "relax", tipo: "teste", titulo: "Visao.astigmatismoTitulo", descricao: "Visao.astigmatismoCartao", icone: Sun, rota: "/exercicios/astigmatismo" },
];

const EXERCICIOS_PREMIUM: readonly Exercicio[] = [
  { id: "estereopsia", tipo: "teste", titulo: "Visao.estereoTitulo", descricao: "Visao.estereoCartao", icone: Layers, rota: "/exercicios/estereopsia" },
  {
    id: "sacadas-convergencia",
    tipo: "treino",
    titulo: "Visao.contrasteBlocosTitulo",
    descricao: "Visao.contrasteBlocosCartao",
    icone: Target,
    rota: "/exercicios/contraste-em-blocos",
  },
  {
    id: "flexibilidade-acomodativa",
    tipo: "treino",
    titulo: "Visao.pertoLongeTitulo",
    descricao: "Visao.pertoLongeCartao",
    icone: RefreshCw,
    rota: "/exercicios/perto-e-longe",
  },
  { id: "convergence", tipo: "treino", titulo: "Visao.convergenciaTitulo", descricao: "Visao.convergenciaCartao", icone: Minimize2, rota: "/exercicios/convergencia" },
];

const BOTAO_CARTAO: Record<TipoDesbloqueio, { chave: string; icone: LucideIcon }> = {
  criar_conta: { chave: "Exercicios.cartaoCriarConta", icone: UserPlus },
  iniciar_trial: { chave: "Exercicios.cartaoIniciarTrial", icone: Play },
  premium: { chave: "Exercicios.cartaoPremium", icone: Lock },
};

/** A partir destes dias restantes, o estado do trial mostra a evolução medida. */
const DIAS_FINAIS_TRIAL = 3;

/**
 * Fim do trial (Fase B, docs/ANALISE_EXERCICIOS.md): o melhor argumento para
 * continuar é a evolução medida da própria pessoa. Uma piora nunca se usa para
 * vender -- só para recomendar a consulta.
 */
const EvolucaoFimTrial = () => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { sessoes } = useHistoricoVisao();
  const olhoFraco =
    profile?.olho_mais_fraco === "direito" || profile?.olho_mais_fraco === "esquerdo" ? profile.olho_mais_fraco : null;
  const e = sessoes ? evolucaoDestacada(sessoes, [ID_ANEIS, ID_ACUIDADE], olhoFraco) : null;
  if (!e) return null;
  const olho = nomeDoOlho(e.olho).toLocaleLowerCase();
  const { dias, passos } = e.tendencia;
  if (e.tendencia.tipo === "piorou")
    return <p className="mt-3 text-corpo font-medium text-tinta">{t("Exercicios.evolucaoPiorou", { olho, dias })}</p>;
  return (
    <p className="mt-3 text-corpo text-tinta">
      <span className="font-medium">
        {passos === 1 ? t("Exercicios.evolucaoMelhorouUma", { olho, dias }) : t("Exercicios.evolucaoMelhorou", { olho, dias, n: passos })}
      </span>{" "}
      {t("Exercicios.evolucaoContinuar")}
    </p>
  );
};

/** O estado do acesso, no topo: o que a pessoa tem e **uma** acção. */
const EstadoAcesso = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { acesso, loading } = useAcessoExercicios();
  const { executar } = useAcaoDesbloqueio();
  const verPremium = () => navigate(localizar("/registo-premium"));

  if (loading) {
    return (
      <p role="status" className="text-corpo text-tinta-suave">
        {t("Exercicios.aCarregar")}
      </p>
    );
  }

  let icone: ReactNode;
  let titulo: string;
  let texto: ReactNode;
  let accao: ReactNode = null;
  let evolucao = false;

  switch (acesso.estado) {
    case "premium":
      icone = <CheckCircle2 />;
      titulo = t("Exercicios.estadoPremium");
      texto = t("Exercicios.bannerPremiumTexto");
      break;
    case "trial_ativo": {
      const dias = acesso.trial_dias_restantes ?? 0;
      icone = <Clock />;
      titulo = t("Exercicios.estadoTrialAtivo");
      texto = dias === 1 ? t("Exercicios.bannerTrialAtivoUmDia") : t("Exercicios.bannerTrialAtivoDias", { dias });
      evolucao = dias <= DIAS_FINAIS_TRIAL;
      accao = (
        <Botao variante="secundario" onClick={verPremium}>
          {t("Exercicios.verPlanosPremium")} <ArrowRight aria-hidden />
        </Botao>
      );
      break;
    }
    case "sem_sessao":
      icone = <UserPlus />;
      titulo = t("Exercicios.bannerSemSessaoTitulo");
      texto = t("Exercicios.bannerSemSessaoTexto");
      accao = (
        <Botao onClick={() => executar("criar_conta")}>
          <UserPlus aria-hidden /> {t("Exercicios.bannerSemSessaoBotao")}
        </Botao>
      );
      break;
    case "trial_disponivel":
      icone = <Play />;
      titulo = t("Exercicios.estadoTrialDisponivel");
      texto = t("Exercicios.bannerTrialDisponivelTexto");
      accao = (
        <Botao onClick={() => executar("iniciar_trial")}>
          <Play aria-hidden /> {t("Exercicios.bannerTrialDisponivelBotao")}
        </Botao>
      );
      break;
    default:
      icone = <Lock />;
      titulo = t("Exercicios.estadoTrialTerminado");
      texto = t("Exercicios.bannerTrialTerminadoTexto");
      evolucao = true;
      accao = (
        <Botao onClick={verPremium}>
          <Lock aria-hidden /> {t("Exercicios.verPlanosPremium")}
        </Botao>
      );
  }

  return (
    <Cartao className="flex flex-col gap-5 border-0 bg-accao-suave sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-4">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-pilula bg-superficie text-accao [&_svg]:size-5">
          {icone}
        </span>
        <div>
          <p className="text-corpo font-medium text-tinta">{titulo}</p>
          <p className="mt-1 text-corpo text-tinta-suave">{texto}</p>
          {evolucao && <EvolucaoFimTrial />}
        </div>
      </div>
      {accao && <div className="shrink-0">{accao}</div>}
    </Cartao>
  );
};

const CartaoExercicio = ({ ex, grupo }: { ex: Exercicio; grupo: GrupoExercicio }) => {
  const { t } = useTranslation();
  const { loading } = useAcessoExercicios();
  const { tipoPara, executar } = useAcaoDesbloqueio();
  const Icone = ex.icone;
  const tipo = loading ? null : tipoPara(ex.id, grupo);
  const desbloqueado = !loading && tipo === null;
  // Visitante sem sessão: sem botão por cartão -- a única acção é a do estado no
  // topo ("Criar conta e começar teste de 7 dias"), para não se repetir 8 vezes.
  const semBotao = tipo === "criar_conta";
  const botao = tipo ? BOTAO_CARTAO[tipo] : null;
  const BotaoIcone = botao?.icone;
  const rota = localizar(ex.rota);

  return (
    <Cartao interactivo={desbloqueado} className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="flex size-11 items-center justify-center rounded-pilula bg-accao-suave text-accao [&_svg]:size-5">
          <Icone />
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-pilula px-2.5 py-1 text-legenda font-medium [&_svg]:size-3.5",
            desbloqueado ? "bg-sucesso-suave text-sucesso" : "bg-superficie-alt text-tinta-suave",
          )}
        >
          {desbloqueado ? <CheckCircle2 aria-hidden /> : <Lock aria-hidden />}
          {desbloqueado ? t("Exercicios.estadoDesbloqueado") : t("Exercicios.estadoBloqueado")}
        </span>
      </div>
      <p className="mt-4 text-legenda font-medium uppercase tracking-wide text-tinta-suave">
        {ex.tipo === "teste" ? t("Visao.etiquetaTeste") : t("Visao.etiquetaTreino")}
      </p>
      <CartaoTitulo como="h3" className="mt-1">
        {desbloqueado ? (
          <CartaoLigacao asChild>
            <Link to={rota}>{t(ex.titulo)}</Link>
          </CartaoLigacao>
        ) : (
          t(ex.titulo)
        )}
      </CartaoTitulo>
      <CartaoTexto className="flex-1">{t(ex.descricao)}</CartaoTexto>
      {desbloqueado ? (
        // O cartão inteiro já leva ao exercício; isto é só a pista visual.
        <span aria-hidden className="mt-5 inline-flex items-center gap-2 text-corpo font-medium text-accao [&_svg]:size-5">
          <Play /> {t("Exercicios.iniciarExercicio")}
        </span>
      ) : semBotao ? null : (
        <Botao
          variante="secundario"
          larguraTotal
          className="mt-5"
          disabled={loading || !tipo}
          onClick={() => tipo && executar(tipo)}
        >
          {BotaoIcone && <BotaoIcone aria-hidden />}
          {botao ? t(botao.chave) : t("Exercicios.estadoBloqueado")}
        </Botao>
      )}
    </Cartao>
  );
};

const Grupo = ({
  id,
  titulo,
  texto,
  exercicios,
  grupo,
  accao,
}: {
  id: string;
  titulo: string;
  texto: string;
  exercicios: readonly Exercicio[];
  grupo: GrupoExercicio;
  accao?: ReactNode;
}) => (
  <section aria-labelledby={id} className="mt-14">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className="text-titulo-m text-tinta">
          {titulo}
        </h2>
        <p className="mt-2 text-corpo text-tinta-suave">{texto}</p>
      </div>
      {accao}
    </div>
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {exercicios.map((ex) => (
        <li key={ex.id}>
          <CartaoExercicio ex={ex} grupo={grupo} />
        </li>
      ))}
    </ul>
  </section>
);

const Exercicios = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { acesso } = useAcessoExercicios();

  return (
    <>
      <Contentor className="py-12 lg:py-16">
        <header className="max-w-2xl">
          <h1 className="text-titulo-g text-tinta">{t("Exercicios.exerciciosVisuaisPraticos")}</h1>
          <p className="mt-4 text-corpo-g text-tinta-suave">{t("Visao.listaIntro")}</p>
          <p className="mt-4 flex items-start gap-2 text-legenda text-tinta-suave">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accao" aria-hidden />
            {t("Visao.listaAviso")}
          </p>
          {acesso.estado !== "sem_sessao" && (
            <Botao asChild variante="fantasma" className="-ml-3 mt-4 sm:-ml-5">
              <Link to={localizar("/exercicios/progresso")}>
                <LineChart aria-hidden /> {t("Visao.verProgresso")}
              </Link>
            </Botao>
          )}
        </header>

        <div className="mt-10">
          <EstadoAcesso />
        </div>

        <Grupo
          id="grupo-trial"
          titulo={t("Exercicios.grupoTrial")}
          texto={t("Exercicios.grupoTrialDescricao")}
          exercicios={EXERCICIOS_TRIAL}
          grupo="trial"
        />
        <Grupo
          id="grupo-premium"
          titulo={t("Exercicios.grupoPremium")}
          texto={t("Exercicios.grupoPremiumDescricao")}
          exercicios={EXERCICIOS_PREMIUM}
          grupo="premium"
          accao={
            acesso.estado !== "premium" && (
              <Botao variante="secundario" onClick={() => navigate(localizar("/registo-premium"))}>
                <Lock aria-hidden /> {t("Exercicios.verPlanosPremium")}
              </Botao>
            )
          }
        />
      </Contentor>

      <section aria-labelledby="exercicios-instagram" className="tema-escuro bg-superficie py-12 text-tinta">
        <Contentor>
          <h2 id="exercicios-instagram" className="text-titulo-m text-tinta">
            {t("Exercicios.maisDicasNoInstagram")}
          </h2>
          <p className="mt-2 max-w-lg text-corpo text-tinta-suave">{t("Exercicios.acompanheANossaComunidade")}</p>
          <Botao asChild variante="secundario" className="mt-6">
            <a href="https://www.instagram.com/janelas_para_alma/" target="_blank" rel="noopener noreferrer">
              <Instagram aria-hidden /> {t("Exercicios.verNoInstagram")}
            </a>
          </Botao>
        </Contentor>
      </section>
      <FeedbackWidget />
    </>
  );
};

export default Exercicios;

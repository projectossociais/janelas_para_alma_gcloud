import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarCheck, Check, CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { formatarData } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { mensagemDeErroApi } from "@/lib/apiClient";

/**
 * O teste de 7 dias, no arquétipo Tarefa (docs/LAYOUTS.md §2.3). Antes era um
 * botão dentro de um painel bloqueado que o iniciava de imediato; mas é uma
 * acção que **só se pode fazer uma vez por conta** e que começa a contar já.
 * Merece uma página que diga o que inclui, o que acontece ao fim e o que custa
 * continuar, e que só começa quando a pessoa o confirma.
 *
 * O estado vem sempre da API (`/exercicios/acesso`): o frontend nunca decide o
 * acesso, só o mostra. Quem inicia o teste é a API, uma única vez (409 depois).
 */

const TOTAL = 2;

/** Os 4 exercícios do teste: o id da API, a rota e o título da página. */
const EXERCICIOS_DO_TESTE = [
  { id: "figure8", rota: "/exercicios/acuidade", titulo: "seo.exercicioAcuidadeTitulo" },
  { id: "ambliopia", rota: "/exercicios/aneis", titulo: "seo.exercicioAneisTitulo" },
  { id: "cerebro", rota: "/exercicios/contraste", titulo: "seo.exercicioContrasteTitulo" },
  { id: "relax", rota: "/exercicios/astigmatismo", titulo: "seo.exercicioAstigmatismoTitulo" },
] as const;

const TesteSeteDias = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { acesso, loading, iniciarTrial } = useAcessoExercicios();
  const [aIniciar, setAIniciar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const sair = () => navigate(localizar("/exercicios"));
  const comum = {
    tema: "claro" as const,
    sair: { rotulo: t("TesteSeteDias.sair"), aoSair: sair },
    textoSaltar: t("TesteSeteDias.saltar"),
  };
  const passo = (actual: number, rotulo?: string) => ({
    actual,
    total: TOTAL,
    rotulo: rotulo ?? t("TesteSeteDias.passo", { actual, total: TOTAL }),
  });

  const comecar = async () => {
    setErro(null);
    setAIniciar(true);
    try {
      await iniciarTrial();
    } catch (err) {
      // Nunca mostrar "iniciado" a partir de um catch (ex.: 409, já foi usado).
      setErro(mensagemDeErroApi(err, t("TesteSeteDias.erroTexto")));
    } finally {
      setAIniciar(false);
    }
  };

  const listaExercicios = (comLigacao: boolean) => (
    <ul className="mt-4 flex flex-col gap-3">
      {EXERCICIOS_DO_TESTE.map((e) => (
        <li key={e.id}>
          {comLigacao ? (
            <Link
              to={localizar(e.rota)}
              className="flex min-h-alvo-app items-center justify-between gap-3 rounded-controlo border border-linha-forte px-4 text-corpo text-tinta hover:border-accao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              {t(e.titulo)}
              <ChevronRight className="size-5 shrink-0 text-tinta-suave" aria-hidden />
            </Link>
          ) : (
            <span className="flex gap-3 text-corpo text-tinta">
              <Check className="mt-1 size-5 shrink-0 text-acento" aria-hidden />
              {t(e.titulo)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  if (loading) {
    return (
      <LayoutTarefa {...comum} passo={passo(1)}>
        <p role="status" className="text-corpo text-tinta-suave">
          {t("TesteSeteDias.aPreparar")}
        </p>
      </LayoutTarefa>
    );
  }

  // --- Sem conta: o teste fica ligado a ela ---
  if (acesso.estado === "sem_sessao") {
    const volta = encodeURIComponent("/teste-de-7-dias");
    return (
      <LayoutTarefa
        {...comum}
        passo={passo(1)}
        accao={
          <div className="flex flex-col gap-3">
            <Botao asChild tamanho="g" larguraTotal>
              <Link to={localizar(`/login?modo=registo&next=${volta}`)}>{t("TesteSeteDias.criarConta")}</Link>
            </Botao>
            <Botao asChild tamanho="g" larguraTotal variante="secundario">
              <Link to={localizar(`/login?next=${volta}`)}>{t("TesteSeteDias.entrar")}</Link>
            </Botao>
          </div>
        }
      >
        <h1 className="text-titulo-m text-tinta">{t("TesteSeteDias.semContaTitulo")}</h1>
        <p className="mt-3 text-corpo text-tinta-suave">{t("TesteSeteDias.semContaTexto")}</p>
      </LayoutTarefa>
    );
  }

  // --- Já tem Premium ---
  if (acesso.estado === "premium") {
    return (
      <LayoutTarefa
        {...comum}
        passo={passo(TOTAL, t("TesteSeteDias.passoPronto"))}
        accao={
          <Botao asChild tamanho="g" larguraTotal>
            <Link to={localizar("/exercicios")}>{t("TesteSeteDias.verExercicios")}</Link>
          </Botao>
        }
      >
        <h1 className="text-titulo-m text-tinta">{t("TesteSeteDias.premiumTitulo")}</h1>
        <p className="mt-3 text-corpo text-tinta-suave">{t("TesteSeteDias.premiumTexto")}</p>
      </LayoutTarefa>
    );
  }

  // --- O teste acabou: só resta o Premium ---
  if (acesso.estado === "trial_terminado") {
    return (
      <LayoutTarefa
        {...comum}
        passo={passo(TOTAL, t("TesteSeteDias.passoPronto"))}
        accao={
          <Botao asChild tamanho="g" larguraTotal>
            <Link to={localizar("/registo-premium")}>
              <Lock aria-hidden /> {t("TesteSeteDias.verPremium")}
            </Link>
          </Botao>
        }
      >
        <h1 className="text-titulo-m text-tinta">{t("TesteSeteDias.terminouTitulo")}</h1>
        <p className="mt-3 text-corpo text-tinta-suave">{t("TesteSeteDias.terminouTexto")}</p>
        <Aviso className="mt-6" variante="info">
          {t("TesteSeteDias.terminouPreco", { preco: t("RegistoPremium.n15000Kz") })}
        </Aviso>
      </LayoutTarefa>
    );
  }

  // --- Teste a decorrer (acabou de começar, ou voltou à página) ---
  if (acesso.estado === "trial_ativo") {
    const dias = acesso.trial_dias_restantes;
    return (
      <LayoutTarefa
        {...comum}
        passo={passo(TOTAL, t("TesteSeteDias.passoPronto"))}
        accao={
          <Botao asChild tamanho="g" larguraTotal>
            <Link to={localizar("/exercicios")}>{t("TesteSeteDias.verExercicios")}</Link>
          </Botao>
        }
      >
        <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-sucesso-suave text-sucesso">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="mt-5 text-titulo-m text-tinta">{t("TesteSeteDias.activoTitulo")}</h1>
        {acesso.trial_termina_em && (
          <p className="mt-3 flex items-center gap-2 text-corpo text-tinta">
            <CalendarCheck className="size-5 shrink-0 text-accao" aria-hidden />
            {t("TesteSeteDias.activoAte", { data: formatarData(acesso.trial_termina_em) })}
            {typeof dias === "number" &&
              ` · ${dias === 1 ? t("TesteSeteDias.umDiaRestante") : t("TesteSeteDias.diasRestantes", { dias })}`}
          </p>
        )}
        <p className="mt-6 text-legenda font-medium text-tinta-suave">{t("TesteSeteDias.escolhaPorOndeComecar")}</p>
        {listaExercicios(true)}
      </LayoutTarefa>
    );
  }

  // --- trial_disponivel: explicar e pedir a confirmação ---
  return (
    <LayoutTarefa
      {...comum}
      passo={passo(1)}
      accao={
        <Botao tamanho="g" larguraTotal aCarregar={aIniciar} onClick={() => void comecar()}>
          {aIniciar ? t("TesteSeteDias.aComecar") : t("TesteSeteDias.comecar")}
        </Botao>
      }
    >
      <h1 className="text-titulo-m text-tinta">{t("TesteSeteDias.titulo")}</h1>
      <p className="mt-3 text-corpo text-tinta-suave">{t("TesteSeteDias.texto")}</p>

      <section aria-labelledby="teste-inclui" className="mt-8">
        <h2 id="teste-inclui" className="text-legenda font-medium text-tinta-suave">
          {t("TesteSeteDias.incluiTitulo")}
        </h2>
        {listaExercicios(false)}
      </section>

      <section aria-labelledby="teste-como" className="mt-8">
        <h2 id="teste-como" className="text-legenda font-medium text-tinta-suave">
          {t("TesteSeteDias.comoFuncionaTitulo")}
        </h2>
        <ul className="mt-4 flex flex-col gap-3 text-corpo text-tinta">
          {(["comoFuncionaConta", "comoFuncionaUmaVez", "comoFuncionaDepois", "comoFuncionaTriagem"] as const).map(
            (chave) => (
              <li key={chave} className="flex gap-3">
                <Check className="mt-1 size-5 shrink-0 text-acento" aria-hidden />
                {chave === "comoFuncionaDepois"
                  ? t(`TesteSeteDias.${chave}`, { preco: t("RegistoPremium.n15000Kz") })
                  : t(`TesteSeteDias.${chave}`)}
              </li>
            ),
          )}
        </ul>
      </section>

      {erro && (
        <Aviso className="mt-6" variante="erro" anunciar titulo={t("TesteSeteDias.erroTitulo")}>
          {erro}
        </Aviso>
      )}
    </LayoutTarefa>
  );
};

export default TesteSeteDias;

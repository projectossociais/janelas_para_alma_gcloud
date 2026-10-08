import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText, Flame } from "lucide-react";
import { MolduraApp } from "@/components/app/MolduraApp";
import { useHistoricoVisao } from "@/components/visao/hooks";
import { nomeDoExercicio } from "@/components/visao/rotulos";
import ResumoTendencia from "@/components/visao/ResumoTendencia";
import { useAuth } from "@/contexts/AuthContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Cartao } from "@/design/componentes/Cartao";
import { Seleccao } from "@/design/componentes/Seleccao";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { formatarDecimal, formatarDiaCurto } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { actividade, eixoDosLimiares, olhosComResultados, serieDeLimiares, type PontoDaSerie } from "@/lib/visao/resumoProgresso";

/**
 * "O meu progresso", no arquétipo App (o separador "Progresso" do painel): a
 * actividade dos últimos 14 dias e a evolução de cada olho nos exercícios com
 * um limiar. Para a pessoa se comparar consigo mesma e levar à consulta.
 *
 * Cuidados que este ecrã tem de ter, porque mostra dados de saúde:
 * - Nada inventado: sem histórico diz-se isso; com erro, diz-se isso.
 * - O gráfico nunca é a única forma de ler os números: há a frase "Em resumo"
 *   (sem jargão) e a tabela com os valores.
 * - Os dois olhos distinguem-se pela cor **e** pelo traço (contínuo/tracejado) e
 *   pelo marcador (círculo/quadrado): não depende de ver cores (WCAG 1.4.1).
 * - As cores vêm do tema (`currentColor`), também em tema escuro.
 */

/** Exercícios com uma curva de limiar por olho, e a unidade de cada um. */
const COM_CURVA = [
  { id: "figure8", unidade: "logmar" },
  { id: "ambliopia", unidade: "logmar" },
  { id: "cerebro", unidade: "log_cs" },
  { id: "sacadas-convergencia", unidade: "log_cs" },
] as const;
type IdCurva = (typeof COM_CURVA)[number]["id"];

const unidadeDe = (id: IdCurva) => COM_CURVA.find((c) => c.id === id)!.unidade;
/** logMAR: mais baixo é melhor -- o eixo fica invertido para "subir" ser melhorar. */
const eixoInvertido = (id: IdCurva) => unidadeDe(id) === "logmar";

const valor = (v: number | undefined) => (typeof v === "number" ? formatarDecimal(v, 2) : "—");

/** O dia `AAAA-MM-DD` ao meio-dia local (evita mudar de dia com o fuso). */
const meioDia = (dia: string) => `${dia}T12:00:00`;

const Actividade14Dias = ({ sessoes }: { sessoes: Parameters<typeof actividade>[0] }) => {
  const { t } = useTranslation();
  const a = useMemo(() => actividade(sessoes, new Date()), [sessoes]);

  return (
    <Cartao>
      <section aria-labelledby="progresso-actividade">
        <h2 id="progresso-actividade" className="text-titulo-p text-tinta">
          {t("ProgressoApp.actividadeTitulo")}
        </h2>
        <p className="mt-1 text-corpo text-tinta-suave">{t("ProgressoApp.actividadeTexto")}</p>

        <dl className="mt-6 grid grid-cols-3 gap-4">
          <div>
            <dt className="text-legenda text-tinta-suave">{t("ProgressoApp.sequencia")}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-titulo-p text-tinta">
              <Flame className="size-5 shrink-0 text-aviso" aria-hidden />
              {a.sequencia === 1 ? t("ProgressoApp.umDia") : t("ProgressoApp.nDias", { n: a.sequencia })}
            </dd>
          </div>
          <div>
            <dt className="text-legenda text-tinta-suave">{t("ProgressoApp.minutos")}</dt>
            <dd className="mt-1 text-titulo-p text-tinta">{t("ProgressoApp.nMin", { n: a.totalMinutos })}</dd>
          </div>
          <div>
            <dt className="text-legenda text-tinta-suave">{t("ProgressoApp.diasComTreino")}</dt>
            <dd className="mt-1 text-titulo-p text-tinta">{t("ProgressoApp.deDias", { n: a.diasComTreino, total: a.dias.length })}</dd>
          </div>
        </dl>

        {/* As barras são só a imagem; a tabela a seguir diz o mesmo a quem não as vê. */}
        <div aria-hidden className="mt-6 flex h-32 items-end gap-1 sm:gap-1.5">
          {a.dias.map((d) => (
            <div key={d.dia} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              {d.minutos > 0 && (
                <span className="hidden text-legenda tabular-nums text-tinta-suave sm:block">{Math.round(d.minutos)}</span>
              )}
              <div
                className={d.minutos > 0 ? "w-full rounded-t bg-accao" : "w-full rounded-t bg-linha"}
                style={{ height: d.minutos > 0 ? `${Math.max(6, (d.minutos / a.maximo) * 88)}%` : "3px" }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="mt-1 flex gap-1 sm:gap-1.5">
          {a.dias.map((d) => (
            <span
              key={d.dia}
              className={
                d.hoje
                  ? "flex-1 text-center text-legenda font-medium text-tinta"
                  : "flex-1 text-center text-legenda text-tinta-suave"
              }
            >
              {Number(d.dia.slice(8))}
            </span>
          ))}
        </div>
        <table className="sr-only">
          <caption>{t("ProgressoApp.tabelaMinutos")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("ProgressoApp.dia")}</th>
              <th scope="col">{t("ProgressoApp.minutos")}</th>
            </tr>
          </thead>
          <tbody>
            {a.dias.map((d) => (
              <tr key={d.dia}>
                <th scope="row">{formatarDiaCurto(meioDia(d.dia))}</th>
                <td>{Math.round(d.minutos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.totalMinutos === 0 && <p className="mt-4 text-corpo text-tinta-suave">{t("ProgressoApp.semTreinos")}</p>}
      </section>
    </Cartao>
  );
};

const Legenda = () => {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-legenda text-tinta">
      <li className="flex items-center gap-2">
        <svg aria-hidden width="28" height="10" className="text-accao">
          <line x1="0" y1="5" x2="28" y2="5" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="14" cy="5" r="3.5" fill="currentColor" />
        </svg>
        {t("Visao.olhoDireito")}
      </li>
      <li className="flex items-center gap-2">
        <svg aria-hidden width="28" height="10" className="text-acento">
          <line x1="0" y1="5" x2="28" y2="5" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 4" />
          <rect x="10.5" y="1.5" width="7" height="7" fill="currentColor" />
        </svg>
        {t("Visao.olhoEsquerdo")}
      </li>
    </ul>
  );
};

/** Marcador quadrado para o olho esquerdo (o direito usa o círculo por omissão). */
const Quadrado = (p: { cx?: number; cy?: number }) =>
  typeof p.cx === "number" && typeof p.cy === "number" ? <rect x={p.cx - 3.5} y={p.cy - 3.5} width={7} height={7} fill="currentColor" /> : <g />;

const DicaDoGrafico = ({ active, payload, label }: { active?: boolean; payload?: { dataKey?: unknown; value?: unknown }[]; label?: string }) => {
  const { t } = useTranslation();
  if (!active || !payload?.length || !label) return null;
  const de = (k: string) => payload.find((p) => p.dataKey === k)?.value as number | undefined;
  return (
    <div className="rounded-controlo border border-linha bg-superficie px-3 py-2 text-legenda text-tinta shadow-nivel-2">
      <p className="font-medium">{formatarDiaCurto(meioDia(label))}</p>
      <p>
        {t("Visao.olhoDireito")}: {valor(de("direito"))}
      </p>
      <p>
        {t("Visao.olhoEsquerdo")}: {valor(de("esquerdo"))}
      </p>
    </div>
  );
};

const Evolucao = ({ sessoes }: { sessoes: Parameters<typeof serieDeLimiares>[0] }) => {
  const { t } = useTranslation();
  const [exercicio, setExercicio] = useState<IdCurva>("figure8");
  const serie: PontoDaSerie[] = useMemo(() => serieDeLimiares(sessoes, exercicio), [sessoes, exercicio]);
  const invertido = eixoInvertido(exercicio);
  const eixo = useMemo(() => eixoDosLimiares(serie), [serie]);
  const olhos = useMemo(() => olhosComResultados(sessoes, exercicio), [sessoes, exercicio]);

  return (
    <Cartao>
      <section aria-labelledby="progresso-evolucao">
        <h2 id="progresso-evolucao" className="text-titulo-p text-tinta">
          {t("Visao.curvaLimiar")}
        </h2>
        <Seleccao
          className="mt-4 max-w-sm"
          rotulo={t("ProgressoApp.exercicio")}
          marcador={t("ProgressoApp.escolhaExercicio")}
          opcoes={COM_CURVA.map((c) => ({ valor: c.id, rotulo: nomeDoExercicio(c.id) }))}
          value={exercicio}
          onChange={(e) => setExercicio(e.target.value as IdCurva)}
        />

        {olhos.length > 0 && (
          <div className="mt-6">
            <ResumoTendencia sessoes={sessoes} exercicioId={exercicio} olhos={olhos} />
          </div>
        )}

        {serie.length === 0 ? (
          <p className="mt-6 text-corpo text-tinta-suave">{t("ProgressoApp.semResultadosExercicio")}</p>
        ) : (
          <>
            <div className="mt-6">
              <Legenda />
            </div>
            {/* Só imagem: a tabela abaixo tem os mesmos valores. */}
            <div aria-hidden className="mt-3 h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-linha" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tickFormatter={(d: string) => formatarDiaCurto(meioDia(d))}
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    stroke="currentColor"
                    className="text-tinta-suave"
                    minTickGap={16}
                  />
                  <YAxis
                    reversed={invertido}
                    // Marcas calculadas (eixoDosLimiares): sempre décimas exactas.
                    domain={eixo.dominio}
                    ticks={eixo.marcas}
                    interval={0}
                    allowDataOverflow={false}
                    tickFormatter={(v: number) => formatarDecimal(v, 1)}
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    stroke="currentColor"
                    className="text-tinta-suave"
                    width={40}
                  />
                  <Tooltip content={<DicaDoGrafico />} cursor={{ stroke: "currentColor", className: "text-linha-forte" }} />
                  <Line
                    type="linear"
                    dataKey="direito"
                    className="text-accao"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "currentColor", stroke: "currentColor" }}
                    activeDot={{ r: 5, fill: "currentColor" }}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="esquerdo"
                    className="text-acento"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={<Quadrado />}
                    activeDot={{ r: 5, fill: "currentColor" }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-legenda text-tinta-suave">
              {invertido ? t("Visao.curvaLogmarNota") : t("Visao.curvaContrasteNota")}
            </p>

            <details className="mt-4 group">
              <summary className="inline-flex min-h-alvo-app cursor-pointer items-center rounded-controlo text-corpo font-medium text-accao underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco">
                {t("ProgressoApp.verValores")}
              </summary>
              <table className="mt-2 w-full border-collapse text-corpo">
                <caption className="sr-only">
                  {t("ProgressoApp.tabelaValores", { exercicio: nomeDoExercicio(exercicio) })}
                </caption>
                <thead>
                  <tr className="border-b border-linha text-left text-legenda text-tinta-suave">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t("ProgressoApp.dia")}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t("Visao.olhoDireito")}
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      {t("Visao.olhoEsquerdo")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...serie].reverse().map((p) => (
                    <tr key={p.dia} className="border-b border-linha">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-tinta">
                        {formatarDiaCurto(meioDia(p.dia))}
                      </th>
                      <td className="py-2 pr-4 tabular-nums text-tinta">{valor(p.direito)}</td>
                      <td className="py-2 tabular-nums text-tinta">{valor(p.esquerdo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>
    </Cartao>
  );
};

const ProgressoVisao = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { sessoes, erro, recarregar } = useHistoricoVisao();

  // Sem conta não há progresso: leva a entrar e volta aqui.
  if (!isLoggedIn) {
    const volta = encodeURIComponent("/exercicios/progresso");
    return (
      <LayoutTarefa
        tema="claro"
        passo={{ actual: 1, total: 1, rotulo: t("Visao.progressoTitulo") }}
        sair={{ rotulo: t("ProgressoApp.sair"), aoSair: () => navigate(localizar("/exercicios")) }}
        textoSaltar={t("PainelApp.saltar")}
        accao={
          <div className="flex flex-col gap-3">
            <Botao asChild tamanho="g" larguraTotal>
              <Link to={localizar(`/login?next=${volta}`)}>{t("ProgressoApp.entrar")}</Link>
            </Botao>
            <Botao asChild tamanho="g" larguraTotal variante="secundario">
              <Link to={localizar(`/login?modo=registo&next=${volta}`)}>{t("ProgressoApp.criarConta")}</Link>
            </Botao>
          </div>
        }
      >
        <h1 className="text-titulo-m text-tinta">{t("ProgressoApp.semSessaoTitulo")}</h1>
        <p className="mt-3 text-corpo text-tinta-suave">{t("Visao.progressoSemSessao")}</p>
      </LayoutTarefa>
    );
  }

  let corpo;
  if (erro) {
    corpo = (
      <Aviso
        variante="erro"
        anunciar
        titulo={t("Visao.erroACarregar")}
        accao={
          <Botao variante="secundario" onClick={() => void recarregar()}>
            {t("Visao.tentarDeNovo")}
          </Botao>
        }
      >
        {t("ProgressoApp.erroTexto")}
      </Aviso>
    );
  } else if (sessoes === null) {
    corpo = (
      <p role="status" className="text-corpo text-tinta-suave">
        {t("ProgressoApp.aCarregar")}
      </p>
    );
  } else if (sessoes.length === 0) {
    corpo = (
      <Cartao className="border-0 bg-accao-suave p-6 sm:p-8">
        <h2 className="text-titulo-m text-tinta">{t("ProgressoApp.vazioTitulo")}</h2>
        <p className="mt-2 max-w-prose text-corpo text-tinta-suave">{t("ProgressoApp.vazioTexto")}</p>
        <Botao asChild tamanho="g" className="mt-6">
          <Link to={localizar("/exercicios")}>{t("ProgressoApp.verTreinos")}</Link>
        </Botao>
      </Cartao>
    );
  } else {
    corpo = (
      <div className="flex flex-col gap-6">
        <Actividade14Dias sessoes={sessoes} />
        <Evolucao sessoes={sessoes} />
        <Cartao className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-titulo-p text-tinta">{t("ProgressoApp.relatorioTitulo")}</h2>
            <p className="mt-1 text-corpo text-tinta-suave">{t("ProgressoApp.relatorioTexto")}</p>
          </div>
          <Botao asChild className="shrink-0">
            <Link to={localizar("/exercicios/relatorio")}>
              <FileText aria-hidden /> {t("Visao.verRelatorio")}
            </Link>
          </Botao>
        </Cartao>
      </div>
    );
  }

  return (
    <MolduraApp activo="progresso" titulo={t("Visao.progressoTitulo")} subtitulo={t("Visao.progressoTexto")}>
      {corpo}
    </MolduraApp>
  );
};

export default ProgressoVisao;

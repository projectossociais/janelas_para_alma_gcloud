import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ResumoTendencia from "@/components/visao/ResumoTendencia";
import { limiarFormatado, nomeDoExercicio, nomeDoOlho } from "@/components/visao/rotulos";
import { formatarData, formatarDataHora, formatarDiaCurto } from "@/i18n/formatar";
import { ID_ACUIDADE, ID_ANEIS } from "@/lib/visao/ids";
import {
  DIAS_RELATORIO,
  IDS_AUTOAVALIACAO,
  IDS_TREINOS,
  minutosPorDia,
  ultimosDias,
  ultimosResultados,
  type SessaoParaRelatorio,
} from "@/lib/visao/progresso";

// Estilo de relatório (pedido do dono do projecto, 2026-09-29): folha branca,
// texto preto, secções numeradas, linhas finas -- sem cores do site, ícones nem
// caixas. Igual no ecrã, na impressão e no link do médico.
const H2 = "mb-2 border-b border-neutral-400 pb-1 text-[14px] font-bold";
const TH_LINHA = "border-b border-neutral-400";

const chave = (s: SessaoParaRelatorio, i: number) => `${s.created_at}-${s.exercicio_id}-${s.olho ?? ""}-${i}`;

const inicioDoPeriodo = (hoje: Date) =>
  new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (DIAS_RELATORIO - 1));

/**
 * Corpo do relatório para o oftalmologista, igual no ecrã do pai
 * (`RelatorioSemanal`) e no link partilhado (`RelatorioPartilhado`): minutos por
 * dia, sessões da semana, evolução de cada olho e últimos resultados dos testes.
 */
const ConteudoRelatorio = ({ sessoes, hoje }: { sessoes: readonly SessaoParaRelatorio[]; hoje: Date }) => {
  const { t } = useTranslation();
  const inicioMs = inicioDoPeriodo(hoje).getTime();
  const daSemana = useMemo(() => sessoes.filter((s) => new Date(s.created_at).getTime() >= inicioMs), [sessoes, inicioMs]);
  const minutos = useMemo(() => minutosPorDia(daSemana), [daSemana]);
  const dias = ultimosDias(hoje, DIAS_RELATORIO);
  const baixaAtencao = daSemana.filter((s) => s.sinais?.baixa_atencao === true).length;
  const ultimos = useMemo(() => [...ultimosResultados(sessoes).values()], [sessoes]);

  return (
    <article className="space-y-6 text-[13px] leading-relaxed text-black">
      <section className="break-inside-avoid">
        <h2 className={H2}>1. {t("Visao.relatorioMinutos")}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className={TH_LINHA}>
              {dias.map((d) => (
                <th key={d} className="px-1 py-1 text-center font-semibold">
                  {formatarDiaCurto(`${d}T12:00:00`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {dias.map((d) => (
                <td key={d} className="px-1 py-2 text-center tabular-nums">
                  {Math.round(minutos.get(d) ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-neutral-600">
          {t("Visao.relatorioBaixaAtencao", { n: baixaAtencao })}
        </p>
      </section>

      <section>
        <h2 className={H2}>2. {t("Visao.relatorioSessoes")}</h2>
        {daSemana.length === 0 ? (
          <p className="text-neutral-600">{t("Visao.semSessoesNaSemana")}</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className={TH_LINHA}>
                <th className="py-1 pr-2 font-semibold">{t("Visao.colData")}</th>
                <th className="py-1 pr-2 font-semibold">{t("Visao.colExercicio")}</th>
                <th className="py-1 pr-2 font-semibold">{t("Visao.colOlho")}</th>
                <th className="py-1 pr-2 font-semibold">{t("Visao.colResultado")}</th>
                <th className="py-1 font-semibold">{t("Visao.colMinutos")}</th>
              </tr>
            </thead>
            <tbody>
              {daSemana.map((s, i) => (
                <tr key={chave(s, i)} className="break-inside-avoid border-b border-neutral-200">
                  <td className="py-1 pr-2 tabular-nums">{formatarDataHora(s.created_at)}</td>
                  <td className="py-1 pr-2">
                    {nomeDoExercicio(s.exercicio_id)}
                    {s.sinais?.baixa_atencao === true && ` (${t("Visao.baixaAtencaoCurto")})`}
                  </td>
                  <td className="py-1 pr-2">{nomeDoOlho(s.olho)}</td>
                  <td className="py-1 pr-2">
                    {limiarFormatado(s.limiar, s.unidade, s.sinais)}
                    {IDS_AUTOAVALIACAO.includes(s.exercicio_id) && ` (${t("Visao.autoAvaliacaoCurto")})`}
                  </td>
                  <td className="py-1 tabular-nums">
                    {IDS_TREINOS.includes(s.exercicio_id) ? Math.round((s.segundos_activos ?? 0) / 60) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="break-inside-avoid space-y-2">
        <h2 className={H2}>3. {t("Visao.relatorioEvolucao")}</h2>
        {[ID_ACUIDADE, ID_ANEIS].map((id) => (
          <div key={id}>
            <p className="font-semibold">{nomeDoExercicio(id)}</p>
            <ResumoTendencia sessoes={sessoes} exercicioId={id} olhos={["direito", "esquerdo"]} simples />
          </div>
        ))}
      </section>

      <section className="break-inside-avoid">
        <h2 className={H2}>4. {t("Visao.relatorioUltimosTestes")}</h2>
        {ultimos.length === 0 ? (
          <p className="text-neutral-600">{t("Visao.semDadosAinda")}</p>
        ) : (
          <ul className="list-none space-y-1 pl-0">
            {ultimos.map((s, i) => (
              <li key={chave(s, i)}>
                {nomeDoExercicio(s.exercicio_id)} · {nomeDoOlho(s.olho)}:{" "}
                <strong>{limiarFormatado(s.limiar, s.unidade, s.sinais)}</strong> ({formatarData(s.created_at)}
                {s.calibrado === false ? `, ${t("Visao.semCalibracaoCurto")}` : ""})
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="border-t border-neutral-300 pt-3 text-xs text-neutral-600">
        {t("Visao.relatorioAutoAvaliacaoNota")} {t("Visao.avisoTeste")} {t("Visao.avisoTreino")}
      </p>
    </article>
  );
};

/** Cabeçalho do relatório: marca, título, período e dados mínimos da pessoa. */
export const CabecalhoRelatorio = ({
  hoje,
  nome,
  olhoMaisFraco,
  usaOculos,
}: {
  hoje: Date;
  nome: string | null;
  olhoMaisFraco: string | null;
  usaOculos: boolean | null;
}) => {
  const { t } = useTranslation();
  const olho =
    olhoMaisFraco === "direito"
      ? t("Visao.olhoDireito")
      : olhoMaisFraco === "esquerdo"
        ? t("Visao.olhoEsquerdo")
        : t("Visao.naoIndicado");
  return (
    <header className="mb-6 border-b border-neutral-400 pb-3 text-black">
      <p className="text-[11px] uppercase tracking-wide text-neutral-600">Janelas Para a Alma</p>
      <h1 className="text-[20px] font-bold">{t("Visao.relatorioTitulo")}</h1>
      <p className="text-[13px] text-neutral-600">
        {t("Visao.relatorioPeriodo", { inicio: formatarData(inicioDoPeriodo(hoje)), fim: formatarData(hoje) })}
      </p>
      <p className="mt-2 text-[13px]">
        {nome ? `${nome} · ` : ""}
        {t("Visao.olhoMaisFraco")}: {olho}
        {usaOculos != null && ` · ${usaOculos ? t("Visao.usaOculosSim") : t("Visao.usaOculosNao")}`}
      </p>
    </header>
  );
};

export default ConteudoRelatorio;

/** Folha de relatório: branca e a preto mesmo com o site em tema escuro; sem moldura na impressão. */
export const FolhaRelatorio = ({ children }: { children: ReactNode }) => (
  <div className="border border-neutral-300 bg-white p-6 text-black sm:p-10 print:border-0 print:p-0">{children}</div>
);

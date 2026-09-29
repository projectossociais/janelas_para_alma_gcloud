import { useMemo } from "react";
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
    <div className="space-y-8 text-sm text-foreground print:text-black">
      <section className="break-inside-avoid">
        <h2 className="mb-2 text-base font-semibold">{t("Visao.relatorioMinutos")}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border print:border-black">
              {dias.map((d) => (
                <th key={d} className="px-1 py-1 text-center text-xs font-medium">
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
        <p className="mt-2 text-xs text-muted-foreground print:text-black">
          {t("Visao.relatorioBaixaAtencao", { n: baixaAtencao })}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">{t("Visao.relatorioSessoes")}</h2>
        {daSemana.length === 0 ? (
          <p className="text-muted-foreground print:text-black">{t("Visao.semSessoesNaSemana")}</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border print:border-black">
                <th className="py-1 pr-2 font-medium">{t("Visao.colData")}</th>
                <th className="py-1 pr-2 font-medium">{t("Visao.colExercicio")}</th>
                <th className="py-1 pr-2 font-medium">{t("Visao.colOlho")}</th>
                <th className="py-1 pr-2 font-medium">{t("Visao.colResultado")}</th>
                <th className="py-1 font-medium">{t("Visao.colMinutos")}</th>
              </tr>
            </thead>
            <tbody>
              {daSemana.map((s, i) => (
                <tr key={chave(s, i)} className="break-inside-avoid border-b border-border/50 print:border-black/30">
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

      <section className="break-inside-avoid space-y-3">
        <h2 className="text-base font-semibold">{t("Visao.relatorioEvolucao")}</h2>
        {[ID_ACUIDADE, ID_ANEIS].map((id) => (
          <div key={id}>
            <p className="mb-1 font-medium">{nomeDoExercicio(id)}</p>
            <ResumoTendencia sessoes={sessoes} exercicioId={id} olhos={["direito", "esquerdo"]} />
          </div>
        ))}
      </section>

      <section className="break-inside-avoid">
        <h2 className="mb-2 text-base font-semibold">{t("Visao.relatorioUltimosTestes")}</h2>
        {ultimos.length === 0 ? (
          <p className="text-muted-foreground print:text-black">{t("Visao.semDadosAinda")}</p>
        ) : (
          <ul className="space-y-1">
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

      <p className="border-t border-border pt-4 text-xs text-muted-foreground print:border-black print:text-black">
        {t("Visao.relatorioAutoAvaliacaoNota")} {t("Visao.avisoTeste")} {t("Visao.avisoTreino")}
      </p>
    </div>
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
    <header className="mb-6 border-b border-border pb-4 print:border-black">
      <p className="text-xs uppercase tracking-wider text-muted-foreground print:text-black">Janelas Para a Alma</p>
      <h1 className="text-2xl font-bold text-foreground print:text-black">{t("Visao.relatorioTitulo")}</h1>
      <p className="text-sm text-muted-foreground print:text-black">
        {t("Visao.relatorioPeriodo", { inicio: formatarData(inicioDoPeriodo(hoje)), fim: formatarData(hoje) })}
      </p>
      <p className="mt-2 text-sm text-foreground print:text-black">
        {nome ? `${nome} · ` : ""}
        {t("Visao.olhoMaisFraco")}: {olho}
        {usaOculos != null && ` · ${usaOculos ? t("Visao.usaOculosSim") : t("Visao.usaOculosNao")}`}
      </p>
    </header>
  );
};

export default ConteudoRelatorio;

import { useTranslation } from "react-i18next";
import { TrendingDown, TrendingUp, Minus, Clock } from "lucide-react";
import type { SessaoResumo } from "@/lib/visao/progresso";
import { nomeDoOlho } from "@/components/visao/rotulos";
import { tendencia, type Tendencia } from "@/lib/visao/tendencia";
import type { Olho } from "@/lib/visao/resultados";

/** Uma frase por olho, em linguagem simples, sobre a evolução no exercício. */
const fraseDeTendencia = (t: (k: string, o?: Record<string, unknown>) => string, olho: Olho, r: Tendencia): string => {
  const nome = nomeDoOlho(olho);
  if (r.tipo === "poucos_dados") return t("Visao.tendenciaPoucosDados", { olho: nome });
  const quando = r.dias === 1 ? t("Visao.quandoOntem") : t("Visao.quandoHaDias", { dias: r.dias });
  const periodo = r.dias === 1 ? t("Visao.periodoUmDia") : t("Visao.periodoDias", { dias: r.dias });
  if (r.tipo === "estavel") return t("Visao.tendenciaEstavel", { olho: nome, periodo });
  if (r.unidade === "logmar") {
    if (r.tipo === "melhorou")
      return r.passos === 1
        ? t("Visao.tendenciaAcuidadeMelhorouUma", { olho: nome, referencia: quando })
        : t("Visao.tendenciaAcuidadeMelhorou", { olho: nome, n: r.passos, referencia: quando });
    return r.passos === 1
      ? t("Visao.tendenciaAcuidadePiorouUma", { olho: nome, referencia: quando })
      : t("Visao.tendenciaAcuidadePiorou", { olho: nome, n: r.passos, referencia: quando });
  }
  return r.tipo === "melhorou"
    ? t("Visao.tendenciaContrasteMelhorou", { olho: nome, referencia: quando })
    : t("Visao.tendenciaContrastePiorou", { olho: nome, referencia: quando });
};

const Icone = ({ r }: { r: Tendencia }) => {
  const c = "mt-0.5 size-5 shrink-0";
  if (r.tipo === "melhorou") return <TrendingUp className={`${c} text-sucesso`} aria-hidden />;
  if (r.tipo === "piorou") return <TrendingDown className={`${c} text-aviso`} aria-hidden />;
  if (r.tipo === "estavel") return <Minus className={`${c} text-tinta-suave`} aria-hidden />;
  return <Clock className={`${c} text-tinta-suave`} aria-hidden />;
};

/**
 * "Em resumo": como está a evoluir cada olho neste exercício, sem jargão.
 * Os números técnicos (logMAR, log CS) ficam no gráfico e no relatório para o
 * médico.
 */
const ResumoTendencia = ({
  sessoes,
  exercicioId,
  olhos,
  simples = false,
}: {
  sessoes: readonly (SessaoResumo & { calibrado?: boolean | null })[];
  exercicioId: string;
  olhos: readonly Olho[];
  /** Em relatórios: só as frases, sem ícones, caixa nem cor. */
  simples?: boolean;
}) => {
  const { t } = useTranslation();
  const linhas = olhos.map((o) => ({ olho: o, r: tendencia(sessoes, exercicioId, o) }));
  if (simples)
    return (
      <ul className="list-none space-y-1 pl-0">
        {linhas.map(({ olho, r }) => (
          <li key={olho}>
            {fraseDeTendencia(t, olho, r)}
            {r.tipo !== "poucos_dados" && r.aproximado && ` ${t("Visao.tendenciaAproximada")}`}
          </li>
        ))}
      </ul>
    );
  return (
    <section aria-label={t("Visao.tendenciaTitulo")} className="w-full rounded-cartao bg-superficie-alt p-4 text-left">
      <h3 className="mb-2 text-legenda font-medium uppercase tracking-wide text-tinta-suave">{t("Visao.tendenciaTitulo")}</h3>
      <ul className="space-y-2 text-corpo text-tinta">
        {linhas.map(({ olho, r }) => (
          <li key={olho} className="flex gap-2">
            <Icone r={r} />
            <span>
              {fraseDeTendencia(t, olho, r)}
              {r.tipo !== "poucos_dados" && r.aproximado && (
                <span className="text-tinta-suave"> {t("Visao.tendenciaAproximada")}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ResumoTendencia;

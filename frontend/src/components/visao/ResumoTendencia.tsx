import { useTranslation } from "react-i18next";
import { TrendingDown, TrendingUp, Minus, Clock } from "lucide-react";
import type { SessaoExercicioPublica } from "@/lib/apiClient";
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
  const c = "mt-0.5 h-4 w-4 shrink-0";
  if (r.tipo === "melhorou") return <TrendingUp className={`${c} text-teal`} aria-hidden />;
  if (r.tipo === "piorou") return <TrendingDown className={`${c} text-gold`} aria-hidden />;
  if (r.tipo === "estavel") return <Minus className={`${c} text-muted-foreground`} aria-hidden />;
  return <Clock className={`${c} text-muted-foreground`} aria-hidden />;
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
}: {
  sessoes: readonly SessaoExercicioPublica[];
  exercicioId: string;
  olhos: readonly Olho[];
}) => {
  const { t } = useTranslation();
  const linhas = olhos.map((o) => ({ olho: o, r: tendencia(sessoes, exercicioId, o) }));
  return (
    <section aria-label={t("Visao.tendenciaTitulo")} className="w-full rounded-xl border border-border bg-muted/30 p-4 text-left">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{t("Visao.tendenciaTitulo")}</h3>
      <ul className="space-y-2 text-sm text-foreground">
        {linhas.map(({ olho, r }) => (
          <li key={olho} className="flex gap-2">
            <Icone r={r} />
            <span>
              {fraseDeTendencia(t, olho, r)}
              {r.tipo !== "poucos_dados" && r.aproximado && (
                <span className="text-muted-foreground"> {t("Visao.tendenciaAproximada")}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ResumoTendencia;

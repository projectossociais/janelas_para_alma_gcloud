import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { useHistoricoVisao } from "@/components/visao/hooks";
import { nomeDoExercicio } from "@/components/visao/rotulos";
import ResumoTendencia from "@/components/visao/ResumoTendencia";
import { useAuth } from "@/contexts/AuthContext";
import { formatarData, formatarDecimal } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { minutosPorDia, sequenciaDeDias, ultimosDias } from "@/lib/visao/progresso";
import { cn } from "@/lib/utils";

/** Exercícios com uma curva de limiar por olho. */
const COM_CURVA = ["figure8", "cerebro", "ambliopia", "sacadas-convergencia"] as const;
/** logMAR: mais baixo é melhor -- o eixo fica invertido para "subir" ser melhorar. */
const EIXO_INVERTIDO = new Set(["figure8", "ambliopia"]);

// Cores dos dois olhos: azul-marinho e turquesa da marca (contraste suficiente
// entre si e sobre fundo claro e escuro).
const COR_DIREITO = "#2AB7A9";
const COR_ESQUERDO = "#16305C";
const COR_ESQUERDO_ESCURO = "#8FA7D6";

const ProgressoVisao = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { sessoes, erro, recarregar } = useHistoricoVisao();
  const [exercicio, setExercicio] = useState<(typeof COM_CURVA)[number]>("figure8");
  const escuro = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const dados = useMemo(() => {
    const s = (sessoes ?? [])
      .filter((x) => x.exercicio_id === exercicio && x.limiar !== null && (x.olho === "direito" || x.olho === "esquerdo"))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return s.map((x) => ({
      data: formatarData(x.created_at),
      direito: x.olho === "direito" ? x.limiar : undefined,
      esquerdo: x.olho === "esquerdo" ? x.limiar : undefined,
    }));
  }, [exercicio, sessoes]);

  const hoje = new Date();
  const minutos = useMemo(() => minutosPorDia(sessoes ?? []), [sessoes]);
  const dias = ultimosDias(hoje, 14);
  const maxMin = Math.max(1, ...dias.map((d) => minutos.get(d) ?? 0));

  let corpo;
  if (!isLoggedIn) corpo = <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.progressoSemSessao")}</p>;
  else if (erro)
    corpo = (
      <div className="py-10 text-center text-sm text-destructive" role="alert">
        <p>{t("Visao.erroACarregar")}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void recarregar()}>
          {t("Visao.tentarDeNovo")}
        </Button>
      </div>
    );
  else if (sessoes === null) corpo = <div className="h-60" aria-busy />;
  else
    corpo = (
      <div className="flex flex-col gap-8">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Flame className="h-5 w-5 text-gold" aria-hidden />
            {t("Visao.sequenciaDias", { dias: sequenciaDeDias(sessoes, hoje) })}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">{t("Visao.minutosUltimos14")}</p>
          <ol className="flex h-28 items-end gap-1" aria-label={t("Visao.minutosUltimos14")}>
            {dias.map((d) => {
              const m = minutos.get(d) ?? 0;
              return (
                <li key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${Math.round(m)} min`}>
                  <div className="w-full rounded-t bg-teal" style={{ height: `${Math.max(2, (m / maxMin) * 96)}px` }} />
                  <span className="sr-only">
                    {d}: {Math.round(m)} min
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold text-foreground">{t("Visao.curvaLimiar")}</h2>
          <div role="tablist" className="mb-4 flex flex-wrap gap-2">
            {COM_CURVA.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={exercicio === id}
                onClick={() => setExercicio(id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  exercicio === id ? "border-teal bg-teal/10 text-foreground" : "border-border text-muted-foreground",
                )}
              >
                {nomeDoExercicio(id)}
              </button>
            ))}
          </div>
          <div className="mb-4">
            <ResumoTendencia sessoes={sessoes} exercicioId={exercicio} olhos={["direito", "esquerdo"]} />
          </div>
          {dados.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.semDadosAinda")}</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis
                    reversed={EIXO_INVERTIDO.has(exercicio)}
                    // Margem de 0,1 acima e abaixo, em décimas: com um só ponto o eixo não fica colado a ele.
                    domain={[(min: number) => Math.floor((min - 0.1) * 10) / 10, (max: number) => Math.ceil((max + 0.1) * 10) / 10]}
                    tickFormatter={(v: number) => formatarDecimal(v, 1)}
                    tick={{ fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="direito"
                    name={t("Visao.olhoDireito")}
                    stroke={COR_DIREITO}
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                  <Line
                    type="monotone"
                    dataKey="esquerdo"
                    name={t("Visao.olhoEsquerdo")}
                    stroke={escuro ? COR_ESQUERDO_ESCURO : COR_ESQUERDO}
                    strokeWidth={2}
                    connectNulls
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {EIXO_INVERTIDO.has(exercicio) ? t("Visao.curvaLogmarNota") : t("Visao.curvaContrasteNota")}
          </p>
        </section>

        <div className="flex justify-center">
          <Button asChild size="lg" className="gap-2 bg-navy text-navy-foreground hover:bg-navy/90">
            <Link to={localizar("/exercicios/relatorio")}>
              <FileText className="h-4 w-4" />
              {t("Visao.verRelatorio")}
            </Link>
          </Button>
        </div>
      </div>
    );

  return (
    <PaginaExercicio>
      <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">{t("Visao.progressoTitulo")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("Visao.progressoTexto")}</p>
      {corpo}
    </PaginaExercicio>
  );
};

export default ProgressoVisao;

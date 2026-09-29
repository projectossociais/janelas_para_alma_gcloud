import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHistoricoVisao } from "@/components/visao/hooks";
import { limiarFormatado, nomeDoExercicio, nomeDoOlho } from "@/components/visao/rotulos";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { formatarData, formatarDataHora, formatarDiaCurto } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { IDS_TREINOS, diaLocal, minutosPorDia, ultimosDias, ultimosResultados } from "@/lib/visao/progresso";

const DIAS = 7;

/**
 * Relatório semanal para levar ao oftalmologista: minutos activos por dia,
 * limiares por sessão, sessões de baixa atenção e últimos resultados dos
 * testes. Página simples com estilos de impressão (`print:`) e
 * `window.print()` -- o browser gera o PDF, sem dependências novas.
 */
const RelatorioSemanal = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { profile } = useProfile();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (DIAS - 1));
  // O histórico completo é preciso para os "últimos resultados" dos testes.
  const { sessoes, erro, recarregar } = useHistoricoVisao();

  const daSemana = useMemo(
    () => (sessoes ?? []).filter((s) => new Date(s.created_at) >= inicio),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `inicio` muda a cada render, o dia não
    [sessoes, diaLocal(inicio)],
  );
  const minutos = useMemo(() => minutosPorDia(daSemana), [daSemana]);
  const dias = ultimosDias(hoje, DIAS);
  const baixaAtencao = daSemana.filter((s) => s.sinais?.baixa_atencao === true).length;
  const ultimos = useMemo(() => [...ultimosResultados(sessoes ?? []).values()], [sessoes]);

  const olhoMaisFraco =
    profile?.olho_mais_fraco === "direito"
      ? t("Visao.olhoDireito")
      : profile?.olho_mais_fraco === "esquerdo"
        ? t("Visao.olhoEsquerdo")
        : t("Visao.naoIndicado");

  return (
    <div className="min-h-screen bg-background print:bg-white print:text-black">
      <div className="container mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button variant="ghost" asChild>
            <Link to={localizar("/exercicios/progresso")}>
              <ArrowLeft className="h-4 w-4" />
              {t("Visao.voltarAoProgresso")}
            </Link>
          </Button>
          <Button onClick={() => window.print()} className="gap-2 bg-navy text-navy-foreground hover:bg-navy/90" disabled={!sessoes}>
            <Printer className="h-4 w-4" />
            {t("Visao.imprimir")}
          </Button>
        </div>

        <header className="mb-6 border-b border-border pb-4 print:border-black">
          <p className="text-xs uppercase tracking-wider text-muted-foreground print:text-black">Janelas Para a Alma</p>
          <h1 className="text-2xl font-bold text-foreground print:text-black">{t("Visao.relatorioTitulo")}</h1>
          <p className="text-sm text-muted-foreground print:text-black">
            {t("Visao.relatorioPeriodo", { inicio: formatarData(inicio), fim: formatarData(hoje) })}
          </p>
          {profile && (
            <p className="mt-2 text-sm text-foreground print:text-black">
              {profile.nome_completo || profile.email} · {t("Visao.olhoMaisFraco")}: {olhoMaisFraco}
              {profile.usa_oculos != null &&
                ` · ${profile.usa_oculos ? t("Visao.usaOculosSim") : t("Visao.usaOculosNao")}`}
            </p>
          )}
        </header>

        {!isLoggedIn ? (
          <p className="text-sm text-muted-foreground">{t("Visao.progressoSemSessao")}</p>
        ) : erro ? (
          <div className="text-sm text-destructive" role="alert">
            <p>{t("Visao.erroACarregar")}</p>
            <Button variant="outline" size="sm" className="mt-3 print:hidden" onClick={() => void recarregar()}>
              {t("Visao.tentarDeNovo")}
            </Button>
          </div>
        ) : sessoes === null ? (
          <div className="h-40" aria-busy />
        ) : (
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
                    {daSemana.map((s) => (
                      <tr key={s.id} className="break-inside-avoid border-b border-border/50 print:border-black/30">
                        <td className="py-1 pr-2 tabular-nums">{formatarDataHora(s.created_at)}</td>
                        <td className="py-1 pr-2">
                          {nomeDoExercicio(s.exercicio_id)}
                          {s.sinais?.baixa_atencao === true && ` (${t("Visao.baixaAtencaoCurto")})`}
                        </td>
                        <td className="py-1 pr-2">{nomeDoOlho(s.olho)}</td>
                        <td className="py-1 pr-2">{limiarFormatado(s.limiar, s.unidade, s.sinais)}</td>
                        <td className="py-1 tabular-nums">
                          {IDS_TREINOS.includes(s.exercicio_id) ? Math.round((s.segundos_activos ?? 0) / 60) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="break-inside-avoid">
              <h2 className="mb-2 text-base font-semibold">{t("Visao.relatorioUltimosTestes")}</h2>
              {ultimos.length === 0 ? (
                <p className="text-muted-foreground print:text-black">{t("Visao.semDadosAinda")}</p>
              ) : (
                <ul className="space-y-1">
                  {ultimos.map((s) => (
                    <li key={s.id}>
                      {nomeDoExercicio(s.exercicio_id)} · {nomeDoOlho(s.olho)}:{" "}
                      <strong>{limiarFormatado(s.limiar, s.unidade, s.sinais)}</strong> ({formatarData(s.created_at)}
                      {s.calibrado === false ? `, ${t("Visao.semCalibracaoCurto")}` : ""})
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="border-t border-border pt-4 text-xs text-muted-foreground print:border-black print:text-black">
              {t("Visao.avisoTeste")} {t("Visao.avisoTreino")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RelatorioSemanal;

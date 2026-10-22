import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  limiarFormatado,
  nomeDoExercicio,
  nomeDoSentido,
  rotuloRoturaRecuperacao,
} from "@/components/visao/rotulos";
import { formatarData, formatarDecimal, separadorDecimal } from "@/i18n/formatar";
import { fraccao6 } from "@/lib/visao/geometria";
import { ID_ACUIDADE, ID_ANEIS, ID_ASTIGMATISMO, ID_CONTRASTE, ID_CONVERGENCIA, ID_ESTEREOPSIA } from "@/lib/visao/ids";
import { SENTIDOS, type ResumoSentido } from "@/lib/visao/pontes";
import type { SessaoParaRelatorio } from "@/lib/visao/progresso";
import type { Olho } from "@/lib/visao/resultados";
import {
  DIAS_RESUMO_CLINICO,
  SEMANAS_ADESAO,
  resumoClinico,
  temMedicoes,
  type Condicoes,
  type Medicao,
  type PorOlho,
  type Resumo,
  type ValorKianda,
  type ValorLuz,
  type ValorPesca,
} from "@/lib/visao/resumoClinico";

// Mesmo estilo do resto do relatório (ConteudoRelatorio): preto sobre branco,
// linhas finas, um só cinzento para notas -- sem cores do site.

/** Minutos de uma semana: "<1" quando houve treino mas menos de um minuto. */
const minutos = (m: number) => (m > 0 && m < 1 ? "<1" : String(Math.round(m)));

const abrevOlho = (t: TFunction, o: Olho) => (o === "direito" ? t("Visao.clinicoOD") : t("Visao.clinicoOE"));

/** "OD: logMAR 0,30 (6/12) · OE: logMAR 0,10 (6/7,5)". */
function porOlho<V>(t: TFunction, v: PorOlho<V>, formatar: (x: V) => string): string {
  return (["direito", "esquerdo"] as const)
    .filter((o) => o in v)
    .map((o) => `${abrevOlho(t, o)}: ${formatar(v[o] as V)}`)
    .join(" · ");
}

const recenteEPrimeira = <V,>(t: TFunction, r: Resumo<V>, formatar: (v: V) => string): string[] => [
  t("Visao.clinicoRecente", { data: formatarData(r.recente.data), valor: formatar(r.recente.valor) }),
  ...(r.primeira ? [t("Visao.clinicoPrimeira", { data: formatarData(r.primeira.data), valor: formatar(r.primeira.valor) })] : []),
];

function textoCondicoes(t: TFunction, c: Condicoes): string {
  const cm = c.distanciaMm !== null ? Math.round(c.distanciaMm / 10) : null;
  const partes = [
    cm !== null && t(c.distanciaMedida ? "Visao.clinicoDistanciaMedida" : "Visao.clinicoDistanciaIndicada", { cm }),
    c.calibrado === true && t("Visao.clinicoCalibrado"),
    c.calibrado === false && t("Visao.clinicoSemCalibracao"),
    c.oculosVerificados === true && t("Visao.clinicoOculosVerificados"),
    c.oculosVerificados === false && t("Visao.clinicoOculosNaoVerificados"),
    c.oculosAfinados === true && t("Visao.clinicoCoresAfinadas"),
  ].filter((p): p is string => typeof p === "string");
  const dias = c.dias === 1 ? t("Visao.clinicoUmDia") : t("Visao.clinicoDias", { n: c.dias });
  return partes.length ? `${dias} ${t("Visao.clinicoNaMaisRecente", { condicoes: partes.join("; ") })}` : dias;
}

const Medida = ({
  titulo,
  exercicio,
  linhas,
  condicoes,
}: {
  titulo: string;
  exercicio?: string;
  linhas: readonly string[];
  condicoes?: string;
}) => (
  <div className="break-inside-avoid border-b border-neutral-200 py-2">
    <dt className="font-semibold">
      {titulo}
      {exercicio && <span className="font-normal text-neutral-600"> · {exercicio}</span>}
    </dt>
    {linhas.map((l, i) => (
      <dd key={i} className="m-0">
        {l}
      </dd>
    ))}
    {condicoes && <dd className="m-0 text-xs text-neutral-600">{condicoes}</dd>}
  </div>
);

/**
 * Secção 1 do relatório para o oftalmologista: o que as medições dos últimos
 * 90 dias dizem, medida a medida, nas unidades do consultório, com as
 * condições em que foram feitas e uma nota de método no fim.
 */
const ResumoClinico = ({ sessoes, hoje }: { sessoes: readonly SessaoParaRelatorio[]; hoje: Date }) => {
  const { t } = useTranslation();
  const hojeMs = hoje.getTime();
  const r = useMemo(() => resumoClinico(sessoes, new Date(hojeMs)), [sessoes, hojeMs]);

  const acuidade = (x: number | null) =>
    x === null ? t("Visao.clinicoNaoLeu") : `${limiarFormatado(x, "logmar", null)} (${fraccao6(x, separadorDecimal())})`;
  const diferenca = (n: number) =>
    n === 0
      ? t("Visao.clinicoDiferencaZero")
      : n === 1
        ? t("Visao.clinicoDiferencaUma")
        : t("Visao.clinicoDiferencaLinhas", { n });
  const kianda = (v: ValorKianda) =>
    [
      v.sustentado === null
        ? t("Visao.clinicoKiandaSemRonda")
        : t("Visao.clinicoKiandaContraste", { contraste: `${Math.round(v.sustentado * 100)}%` }),
      v.orientacao !== null &&
        t("Visao.clinicoKiandaOrientacao", { graus: formatarDecimal(v.orientacao, v.orientacao % 1 ? 1 : 0) }),
    ]
      .filter(Boolean)
      .join(" · ");
  const pesca = (v: ValorPesca) =>
    v.graus === null
      ? t("Visao.clinicoPescaSemLimiar")
      : t("Visao.clinicoPescaValor", { graus: formatarDecimal(v.graus, v.graus % 1 ? 1 : 0), nivel: v.nivel ?? "–" });
  const luz = (v: ValorLuz) => {
    const partes = [
      ...v.reflexo.map((a) => t("Visao.clinicoLuzReflexo", { olho: abrevOlho(t, a.olho), sentido: t(`Visao.luzSentido_${a.sentido}`), delta: a.delta })),
      ...v.tapar.map((a) => t("Visao.clinicoLuzTapar", { olho: abrevOlho(t, a.olho), sentido: t(`Visao.luzSentido_${a.sentido}`) })),
    ];
    const diario = v.frequencia ? t("Visao.clinicoLuzDiario", { frequencia: t(`Visao.luzFrequencia_${v.frequencia}`).toLowerCase() }) : null;
    return [partes.length ? partes.join(" · ") : t("Visao.clinicoLuzSemDesvio"), diario].filter(Boolean).join(" · ");
  };
  const sentido = (nome: string, m: Medicao<ResumoSentido>, chave: string) =>
    `${nome} · ${t(chave, { data: formatarData(m.data), valor: rotuloRoturaRecuperacao(m.valor) })}`;

  const { adesao } = r;
  const totalDias = SEMANAS_ADESAO * 7;
  const medicaoComDistancia = [r.acuidade, r.contraste, r.estereopsia, r.vergencia, r.kianda, r.pesca].some(
    (m) => m?.condicoes.distanciaMedida,
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-600">{t("Visao.clinicoIntro")}</p>

      {r.diplopia.length > 0 && (
        <p className="font-semibold">
          {t("Visao.clinicoDiplopia", { datas: r.diplopia.map((d) => formatarData(d)).join(", ") })}
        </p>
      )}
      {!temMedicoes(r) && <p className="text-neutral-600">{t("Visao.clinicoSemDados", { dias: DIAS_RESUMO_CLINICO })}</p>}

      <dl className="m-0">
        {r.acuidade && (
          <Medida
            titulo={
              r.acuidade.tipo === "longe"
                ? t("Visao.clinicoAcuidadeLonge")
                : r.acuidade.tipo === "barras"
                  ? t("Visao.clinicoAcuidade")
                  : t("Visao.clinicoAcuidadeIsolada")
            }
            exercicio={nomeDoExercicio(ID_ACUIDADE)}
            linhas={recenteEPrimeira(t, r.acuidade, (v) => porOlho(t, v, acuidade)).map((l, i) =>
              i === 0 && r.acuidade?.diferencaLinhas != null ? `${l} · ${diferenca(r.acuidade.diferencaLinhas)}` : l,
            )}
            condicoes={textoCondicoes(t, r.acuidade.condicoes)}
          />
        )}
        {r.contraste && (
          <Medida
            titulo={t("Visao.clinicoContraste")}
            exercicio={nomeDoExercicio(ID_CONTRASTE)}
            linhas={recenteEPrimeira(t, r.contraste, (v) => porOlho(t, v, (x) => limiarFormatado(x, "log_cs", null)))}
            condicoes={textoCondicoes(t, r.contraste.condicoes)}
          />
        )}
        {r.estereopsia && (
          <Medida
            titulo={t("Visao.clinicoEstereo")}
            exercicio={nomeDoExercicio(ID_ESTEREOPSIA)}
            linhas={recenteEPrimeira(t, r.estereopsia, (v) =>
              v === null ? t("Visao.clinicoEstereoNaoViu") : limiarFormatado(v, "arcsec", null),
            )}
            condicoes={textoCondicoes(t, r.estereopsia.condicoes)}
          />
        )}
        {r.vergencia && (
          <Medida
            titulo={t("Visao.clinicoVergencia")}
            exercicio={nomeDoExercicio(ID_CONVERGENCIA)}
            linhas={SENTIDOS.flatMap((s) => {
              const m = r.vergencia?.sentidos[s];
              if (!m) return [];
              return [
                sentido(nomeDoSentido(s), m.recente, "Visao.clinicoRecente"),
                ...(m.primeira ? [sentido(nomeDoSentido(s), m.primeira, "Visao.clinicoPrimeira")] : []),
              ];
            })}
            condicoes={textoCondicoes(t, r.vergencia.condicoes)}
          />
        )}
        {r.pesca && (
          <Medida
            titulo={t("Visao.clinicoPesca")}
            exercicio={nomeDoExercicio(ID_ANEIS)}
            linhas={[
              ...(r.pesca.olho ? [t("Visao.clinicoPescaOlho", { olho: abrevOlho(t, r.pesca.olho) })] : []),
              ...recenteEPrimeira(t, r.pesca, pesca),
            ]}
            condicoes={textoCondicoes(t, r.pesca.condicoes)}
          />
        )}
        {r.kianda && (
          <Medida
            titulo={t("Visao.clinicoKianda")}
            exercicio={nomeDoExercicio(ID_ANEIS)}
            linhas={[
              ...(r.kianda.olhoFraco ? [t("Visao.clinicoKiandaOlhoFraco", { olho: abrevOlho(t, r.kianda.olhoFraco) })] : []),
              ...recenteEPrimeira(t, r.kianda, kianda),
            ]}
            condicoes={textoCondicoes(t, r.kianda.condicoes)}
          />
        )}
        {r.luz && (
          <Medida
            titulo={t("Visao.clinicoLuz")}
            exercicio={nomeDoExercicio(ID_ASTIGMATISMO)}
            linhas={recenteEPrimeira(t, r.luz, luz)}
            condicoes={r.luz.condicoes.dias === 1 ? t("Visao.clinicoUmDia") : t("Visao.clinicoDias", { n: r.luz.condicoes.dias })}
          />
        )}
        {r.astigmatismo && (
          <Medida
            titulo={t("Visao.clinicoAstigmatismo")}
            exercicio={nomeDoExercicio(ID_ASTIGMATISMO)}
            linhas={recenteEPrimeira(t, r.astigmatismo, (v) =>
              porOlho(t, v, (b) => (b ? t("Visao.astigmatismoSinalCurto") : t("Visao.astigmatismoSemSinalCurto"))),
            )}
          />
        )}
        <Medida
          titulo={t("Visao.clinicoTreino", { semanas: SEMANAS_ADESAO })}
          linhas={
            adesao.diasComTreino === 0
              ? [t("Visao.clinicoSemTreino")]
              : [
                  t("Visao.clinicoMinutosSemana", { minutos: adesao.minutosPorSemana.map(minutos).join(" · ") }),
                  t("Visao.clinicoDiasComTreino", { n: adesao.diasComTreino, total: totalDias }),
                  ...(adesao.sessoesBaixaAtencao ? [t("Visao.clinicoBaixaAtencao", { n: adesao.sessoesBaixaAtencao })] : []),
                ]
          }
        />
      </dl>

      {temMedicoes(r) && (
        <div className="space-y-1 text-xs text-neutral-600">
          <p className="font-semibold">{t("Visao.clinicoMetodoTitulo")}</p>
          {r.acuidade && (
            <p>
              {r.acuidade.tipo === "longe"
                ? t("Visao.clinicoMetodoAcuidadeLonge")
                : r.acuidade.tipo === "barras"
                  ? t("Visao.clinicoMetodoAcuidadeAglomeracao")
                  : t("Visao.clinicoMetodoAcuidade")}
            </p>
          )}
          {r.estereopsia && <p>{t("Visao.clinicoMetodoEstereo")}</p>}
          {r.vergencia && (
            <p>{r.vergencia.fusaoLivre ? t("Visao.clinicoMetodoFusaoLivre") : t("Visao.clinicoMetodoVergencia")}</p>
          )}
          {r.pesca && <p>{t("Visao.clinicoMetodoPesca")}</p>}
          {r.luz && <p>{t("Visao.clinicoMetodoLuz")}</p>}
          {r.kianda && <p>{t("Visao.clinicoMetodoKianda")}</p>}
          {medicaoComDistancia && <p>{t("Visao.clinicoMetodoDistancia")}</p>}
        </div>
      )}
    </div>
  );
};

export default ResumoClinico;

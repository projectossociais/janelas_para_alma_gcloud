import { useEffect, useState } from "react";
import { Activity, Eye, Stethoscope } from "lucide-react";
import { useTranslation } from "react-i18next";
import fotoRastreio from "@/assets/pillar-saude.jpg";
import { impactoApi, type NumerosImpacto } from "@/lib/apiClient";
import { useIdioma } from "@/i18n/useIdioma";
import { IDIOMA_EN } from "@/i18n/idiomas";

const METRICAS = [
  { chave: "rastreios", rotulo: "Inicio.metricaRastreios", nota: "Inicio.metricaRastreiosNota", icone: Eye },
  { chave: "sessoes_treino", rotulo: "Inicio.metricaTreinos", nota: "Inicio.metricaTreinosNota", icone: Activity },
  {
    chave: "encaminhamentos",
    rotulo: "Inicio.metricaEncaminhamentos",
    nota: "Inicio.metricaEncaminhamentosNota",
    icone: Stethoscope,
  },
] as const;

/**
 * B. Sensibilização e números de impacto. Os números vêm da API
 * (`GET /impacto/numeros`, contagens reais): nunca se escrevem à mão, e sem
 * resposta mostra-se um traço em vez de um valor inventado.
 */
const NarrativaImpacto = () => {
  const { t } = useTranslation();
  const ingles = useIdioma() === IDIOMA_EN;
  const [numeros, setNumeros] = useState<NumerosImpacto | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let activo = true;
    impactoApi
      .numeros()
      .then((n) => activo && setNumeros(n))
      .catch(() => activo && setFalhou(true));
    return () => {
      activo = false;
    };
  }, []);

  const formatar = (n: number) => n.toLocaleString(ingles ? "en-US" : "pt-PT");

  return (
    <section id="duplo-impacto" className="bg-marca-marfim py-16 md:py-24">
      <div className="container">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-widest text-marca-turquesa">{t("Inicio.porqueImporta")}</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-marca-marinho md:text-4xl">
              {t("Inicio.imaginaCrescer")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-marca-marinho/75 md:text-lg">{t("Inicio.realidadeEstrabismo")}</p>
            <p className="mt-4 text-base leading-relaxed text-marca-marinho/75 md:text-lg">{t("Inicio.realidadeAmbliopia")}</p>
          </div>
          <img
            src={fotoRastreio}
            alt={t("Inicio.fotoRastreioAlt")}
            className="h-72 w-full rounded-3xl object-cover md:h-96"
            loading="lazy"
          />
        </div>

        <h3 className="mt-16 text-center text-2xl font-bold text-marca-marinho md:text-3xl">
          {t("Inicio.oNossoDuploImpacto")}
        </h3>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {METRICAS.map(({ chave, rotulo, nota, icone: Icone }) => (
            <li key={chave} className="rounded-3xl bg-marca-celeste/25 p-7 text-center">
              <Icone className="mx-auto h-8 w-8 text-marca-azul" aria-hidden="true" />
              <p className="mt-4 text-4xl font-bold tabular-nums text-marca-marinho md:text-5xl" aria-live="polite">
                {numeros ? formatar(numeros[chave]) : falhou ? "—" : <span className="inline-block h-10 w-24 animate-pulse rounded-lg bg-marca-marfim/70 align-middle" />}
              </p>
              <p className="mt-2 font-semibold text-marca-marinho">{t(rotulo)}</p>
              <p className="mt-1 text-sm text-marca-marinho/75">{t(nota)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-marca-marinho/60">{t("Inicio.notaNumeros")}</p>
      </div>
    </section>
  );
};

export default NarrativaImpacto;

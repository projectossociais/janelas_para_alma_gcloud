import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** Fotografias de antes (em cima) e depois (em baixo), em public/olhares/. */
export const FOTOS_OLHARES = Array.from({ length: 7 }, (_, i) => `/olhares/olhar-${i + 1}.jpg`);

/** Cada fotografia fica 5 s no ecrã (pedido do dono do projecto, 2026-11-08). */
export const INTERVALO_OLHARES_MS = 5000;

/** Carrossel da página inicial: muda sozinho a cada 5 s; pára enquanto o rato ou o foco estão nele. */
const OlharesCarrossel = () => {
  const { t } = useTranslation();
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado) return;
    const id = window.setTimeout(() => setActual((i) => (i + 1) % FOTOS_OLHARES.length), INTERVALO_OLHARES_MS);
    return () => window.clearTimeout(id);
  }, [actual, pausado]);

  return (
    <section aria-labelledby="olhares-titulo" className="bg-white py-16 md:py-24">
      <div className="container grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className="max-w-md">
          <h2 id="olhares-titulo" className="text-3xl font-bold leading-tight text-marca-marinho md:text-4xl">
            {t("Olhares.titulo")}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-marca-marinho/75">{t("Olhares.texto")}</p>
          <p className="mt-3 text-sm text-marca-marinho/60">{t("Olhares.nota")}</p>
        </div>

        <div
          className="mx-auto w-full max-w-md"
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
          onFocus={() => setPausado(true)}
          onBlur={() => setPausado(false)}
        >
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label={t("Olhares.titulo")}
            className="relative aspect-square overflow-hidden rounded-2xl bg-marca-marinho shadow-lg ring-1 ring-marca-marinho/10"
          >
            {FOTOS_OLHARES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={i === actual ? t("Olhares.fotoAlt", { numero: i + 1 }) : ""}
                aria-hidden={i !== actual}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  i === actual ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            <span className="absolute left-3 top-3 rounded-full bg-marca-marinho/85 px-3 py-1 text-xs font-bold uppercase tracking-wide text-marca-marfim">
              {t("Olhares.antes")}
            </span>
            <span className="absolute left-3 top-[calc(50%+0.75rem)] rounded-full bg-marca-turquesa px-3 py-1 text-xs font-bold uppercase tracking-wide text-marca-marinho">
              {t("Olhares.depois")}
            </span>
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {FOTOS_OLHARES.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setActual(i)}
                aria-label={t("Olhares.verFoto", { numero: i + 1 })}
                aria-current={i === actual}
                className={`h-2.5 rounded-full transition-all ${
                  i === actual ? "w-8 bg-marca-azul" : "w-2.5 bg-marca-celeste hover:bg-marca-azul/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OlharesCarrossel;

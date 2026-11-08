import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";
import { HISTORIAS } from "./conteudoInicio";

/**
 * F. Carrossel de histórias de transformação, antes do rodapé. Sem rotação
 * automática: muda só com as setas, os pontos ou as setas do teclado.
 */
const HistoriasTransformacao = () => {
  const { t } = useTranslation();
  const [indice, setIndice] = useState(0);
  const total = HISTORIAS.length;
  const historia = HISTORIAS[indice];
  const ir = (passo: number) => setIndice((i) => (i + passo + total) % total);

  return (
    <section id="historias" className="bg-marca-celeste/25 py-16 md:py-24" aria-roledescription={t("Historias.carrossel")}>
      <div className="container">
        <h2 className="sr-only">{t("Historias.titulo")}</h2>
        <div
          className="relative mx-auto max-w-5xl rounded-3xl bg-marca-marfim px-6 py-10 shadow-lg ring-1 ring-marca-marinho/10 sm:px-14 md:px-16 md:py-12"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") ir(-1);
            if (e.key === "ArrowRight") ir(1);
          }}
        >
          <div
            key={historia.id}
            className="grid items-center gap-10 animate-in fade-in-0 duration-500 md:grid-cols-[1.2fr_1fr]"
            role="group"
            aria-roledescription={t("Historias.diapositivo")}
            aria-label={t("Historias.posicao", { actual: indice + 1, total })}
          >
            <div>
              <h3 className="text-2xl font-bold leading-tight text-marca-marinho md:text-3xl">{t(historia.titulo)}</h3>
              <p className="mt-4 text-base leading-relaxed text-marca-marinho/85 md:text-lg">{t(historia.resumo)}</p>
              {historia.ilustrativa && <p className="mt-3 text-xs text-marca-marinho/60">{t("Historias.notaIlustrativa")}</p>}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={localizar("/apoiar")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-marca-ouro px-7 py-3 text-sm font-bold text-marca-marinho hover:bg-marca-ouro/85"
                >
                  <Heart className="h-4 w-4" aria-hidden="true" />
                  {t("Inicio.doarAgora")}
                </Link>
                <Link
                  to={localizar("/publicacoes")}
                  className="inline-flex items-center justify-center rounded-full bg-marca-marinho px-7 py-3 text-sm font-bold text-marca-marfim hover:bg-marca-marinho/90"
                >
                  {t("Historias.conhecerMais")}
                </Link>
              </div>
            </div>

            <div className="relative mx-auto h-64 w-64 sm:h-72 sm:w-72">
              <img
                src={historia.fotoAntes}
                alt={t("Historias.fotoAntes")}
                className="absolute left-0 top-0 h-32 w-32 rounded-full border-4 border-marca-marfim object-cover shadow-md ring-4 ring-marca-celeste/70 grayscale sm:h-36 sm:w-36"
                loading="lazy"
              />
              <img
                src={historia.fotoDepois}
                alt={t("Historias.fotoDepois")}
                className="absolute bottom-0 right-0 h-48 w-48 rounded-full border-4 border-marca-marfim object-cover shadow-xl ring-4 ring-marca-celeste/70 sm:h-56 sm:w-56"
                loading="lazy"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => ir(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md bg-marca-celeste/25 p-2 text-marca-marinho hover:bg-marca-celeste/40 sm:left-3"
            aria-label={t("Historias.anterior")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => ir(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-marca-celeste/25 p-2 text-marca-marinho hover:bg-marca-celeste/40 sm:right-3"
            aria-label={t("Historias.seguinte")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="mt-8 flex justify-center gap-2.5">
            {HISTORIAS.map((h, i) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={t("Historias.irPara", { numero: i + 1 })}
                aria-current={i === indice}
                className={`h-2.5 rounded-full transition-all ${i === indice ? "w-6 bg-marca-azul" : "w-2.5 bg-marca-celeste"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HistoriasTransformacao;

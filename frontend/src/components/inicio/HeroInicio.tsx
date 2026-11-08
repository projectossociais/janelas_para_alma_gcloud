import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import fotoHero from "@/assets/hero-bg.jpg";
import { localizar } from "@/i18n/rotas";

/** Os três pilares, cada um com a última palavra em destaque (como no título do Project Prakash). */
const PILARES = [
  { inicio: "Inicio.pilar1Inicio", destaque: "Inicio.pilar1Destaque" },
  { inicio: "Inicio.pilar2Inicio", destaque: "Inicio.pilar2Destaque" },
  { inicio: "Inicio.pilar3Inicio", destaque: "Inicio.pilar3Destaque" },
] as const;

/** A. Hero com os pilares triplos, seguido dos cartões Visão e Missão. */
const HeroInicio = () => {
  const { t } = useTranslation();
  return (
    <>
      {/* Hero (pedido de 2026-11-08): a fotografia de sempre do site (hero-bg.jpg),
          inteira e sem o véu azul-marinho que a escurecia; por cima, só o botão de doar.
          Os botões ficam no canto inferior esquerdo. */}
      <section
        aria-labelledby="hero-titulo"
        className="relative flex h-[100svh] min-h-[32rem] w-full items-end overflow-hidden bg-marca-marinho pt-16"
      >
        <img
          src={fotoHero}
          alt={t("Inicio.fotoHeroAlt")}
          className="absolute inset-0 h-full w-full object-cover object-[35%_center]"
          fetchPriority="high"
          decoding="async"
        />
        <h1 id="hero-titulo" className="sr-only">
          {PILARES.map((p) => `${t(p.inicio)} ${t(p.destaque)}`).join(". ")}
        </h1>
        <div className="container relative z-10 flex justify-start pb-10 md:pb-16">
          <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:w-auto sm:flex-row">
            <Link
              to={localizar("/apoiar?modo=unica")}
              className="inline-flex min-w-[13rem] items-center justify-center gap-2 rounded-full bg-marca-azul px-8 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-marca-marfim shadow-lg transition-colors hover:bg-marca-marinho"
            >
              <Heart className="h-4 w-4" aria-hidden="true" />
              {t("Inicio.doarAgora")}
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="visao-missao" className="border-b border-marca-marinho/10 bg-marca-marfim">
        <h2 id="visao-missao" className="sr-only">
          {t("Inicio.visaoEMissao")}
        </h2>
        <div className="container grid gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-16">
          <div>
            <h3 className="text-xl font-bold text-marca-azul md:text-2xl">{t("Inicio.aNossaVisao")}</h3>
            <p className="mt-3 text-lg leading-relaxed text-marca-marinho">{t("Inicio.aNossaVisaoTexto")}</p>
          </div>
          <div>
            <h3 className="text-xl font-bold text-marca-azul md:text-2xl">{t("Inicio.aNossaMissao")}</h3>
            <p className="mt-3 text-lg leading-relaxed text-marca-marinho">{t("Inicio.aNossaMissaoTexto")}</p>
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroInicio;

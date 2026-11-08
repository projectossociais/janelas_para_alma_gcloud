import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import fotoHero from "@/assets/hero-bg.jpg";
import { localizar } from "@/i18n/rotas";

/**
 * Hero da página inicial (pedido de 2026-11-08): a fotografia de sempre do site
 * (hero-bg.jpg) em ecrã inteiro, sem o véu azul-marinho que a escurecia, e por
 * cima só o botão "Doar Agora", no canto inferior esquerdo.
 */
const HeroInicio = () => {
  const { t } = useTranslation();
  return (
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
          Janelas Para a Alma
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
  );
};

export default HeroInicio;

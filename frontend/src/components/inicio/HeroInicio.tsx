import { Link } from "react-router-dom";
import { Heart, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { localizar } from "@/i18n/rotas";

/** A fotografia do menino que estava no cartão "Sabia que... O que é o Estrabismo?". */
const fotoHero = "/estrabismo-intro-boy.jpg";

/**
 * Hero da página inicial (pedidos de 2026-11-08): a fotografia em ecrã inteiro, sem véu
 * por cima, e no canto inferior esquerdo só "Doar Agora" e, sem sessão, "Entrar".
 */
const HeroInicio = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  return (
      <section
        aria-labelledby="hero-titulo"
        className="relative flex h-[100svh] min-h-[32rem] w-full items-end overflow-hidden bg-marca-marinho pt-16"
      >
        <img
          src={fotoHero}
          alt={t("Inicio.fotoHeroAlt")}
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
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
            {!isLoggedIn && (
              <Link
                to={localizar("/auth")}
                className="inline-flex min-w-[13rem] items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-marca-azul shadow-lg ring-2 ring-marca-azul transition-colors hover:bg-marca-celeste/30"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {t("Navbar.entrar")}
              </Link>
            )}
          </div>
        </div>
      </section>
  );
};

export default HeroInicio;

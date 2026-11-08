import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { localizar } from "@/i18n/rotas";

/**
 * Diapositivos da capa (pedidos do dono do projecto, 2026-11-08): uma fotografia por
 * criança, por esta ordem, em ecrã inteiro (public/olhares/; a do menino com estrabismo
 * foi suavizada: menos contraste e cor).
 */
export const DIAPOSITIVOS_CAPA: readonly { src: string; alt: string; posicao?: string }[] = [
  { src: "/olhares/menino-oculos-azuis.jpg", alt: "Inicio.capaFotoOculos" },
  { src: "/olhares/menina-escola.jpg", alt: "Inicio.capaFotoMeninaEscola", posicao: "object-[35%_center]" },
  { src: "/olhares/menina.jpg", alt: "Inicio.capaFotoMenina" },
  { src: "/olhares/menino-estrabismo.jpg", alt: "Inicio.fotoHeroAlt" },
];

/** Cada diapositivo fica 5 s no ecrã. */
export const INTERVALO_CAPA_MS = 5000;

/**
 * Capa da página inicial: carrossel em ecrã inteiro, sem véu por cima, que muda
 * sozinho a cada 5 s. "Doar Agora" e (sem sessão) "Entrar" ficam sempre por cima,
 * no canto inferior esquerdo, seja qual for o diapositivo.
 */
const HeroInicio = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const [actual, setActual] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setActual((i) => (i + 1) % DIAPOSITIVOS_CAPA.length), INTERVALO_CAPA_MS);
    return () => window.clearTimeout(id);
  }, [actual]);

  return (
    <section
      aria-labelledby="hero-titulo"
      className="relative flex h-[100svh] min-h-[32rem] w-full items-end overflow-hidden bg-white pt-16"
    >
      <div aria-roledescription="carousel" aria-label={t("Inicio.capaCarrossel")} className="absolute inset-0">
        {DIAPOSITIVOS_CAPA.map(({ src, alt, posicao }, i) => (
          <img
            key={src}
            src={src}
            alt={i === actual ? t(alt) : ""}
            data-testid="diapositivo-capa"
            aria-hidden={i !== actual}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              posicao ?? "object-[center_30%]"
            } ${i === actual ? "opacity-100" : "opacity-0"}`}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
            decoding="async"
          />
        ))}
      </div>

      <h1 id="hero-titulo" className="sr-only">
        Janelas Para a Alma
      </h1>

      <div className="container relative z-10 flex flex-col items-start gap-5 pb-10 sm:flex-row sm:items-center sm:gap-6 sm:pb-8">
        <div className="flex w-full max-w-md flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row">
          <Link
            to={localizar("/apoiar?modo=unica")}
            className="inline-flex min-w-[17rem] items-center justify-center gap-3 rounded-full bg-marca-azul px-12 py-5 text-lg font-bold uppercase tracking-[0.08em] text-marca-marfim shadow-lg transition-colors hover:bg-marca-marinho md:min-w-[21rem] md:py-6 md:text-xl"
          >
            <Heart className="h-6 w-6" aria-hidden="true" />
            {t("Inicio.doarAgora")}
          </Link>
          {!isLoggedIn && (
            <Link
              to={localizar("/auth")}
              className="inline-flex min-w-[17rem] items-center justify-center gap-3 rounded-full bg-white px-12 py-5 text-lg font-bold uppercase tracking-[0.08em] text-marca-azul shadow-lg ring-2 ring-marca-azul transition-colors hover:bg-marca-celeste/30 md:min-w-[21rem] md:py-6 md:text-xl"
            >
              <LogIn className="h-6 w-6" aria-hidden="true" />
              {t("Navbar.entrar")}
            </Link>
          )}
        </div>
        <div className="flex gap-2 rounded-full bg-marca-marinho/40 px-3 py-2">
          {DIAPOSITIVOS_CAPA.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActual(i)}
              aria-label={t("Inicio.capaVerDiapositivo", { numero: i + 1 })}
              aria-current={i === actual}
              className={`h-2.5 rounded-full transition-all ${
                i === actual ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroInicio;

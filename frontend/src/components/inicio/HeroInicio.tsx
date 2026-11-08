import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { localizar } from "@/i18n/rotas";

/**
 * Diapositivos da capa (pedidos do dono do projecto, 2026-11-08). As fotografias de
 * antes/depois são pequenas para o ecrã inteiro, por isso vão quatro de cada vez, recortadas
 * à volta dos olhos (capa-N.jpg: antes em cima, depois em baixo) e abaixo do cabeçalho.
 */
export const DIAPOSITIVOS_CAPA: readonly { fotos: readonly string[]; alt: string }[] = [
  { fotos: ["/estrabismo-intro-boy.jpg"], alt: "Inicio.fotoHeroAlt" },
  {
    fotos: ["/olhares/capa-1.jpg", "/olhares/capa-2.jpg", "/olhares/capa-3.jpg", "/olhares/capa-4.jpg"],
    alt: "Inicio.capaFotoOlhares",
  },
  { fotos: ["/olhares/menino-oculos-azuis.jpg"], alt: "Inicio.capaFotoOculos" },
  {
    fotos: ["/olhares/capa-5.jpg", "/olhares/capa-6.jpg", "/olhares/capa-7.jpg", "/olhares/capa-1.jpg"],
    alt: "Inicio.capaFotoOlhares",
  },
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
        {DIAPOSITIVOS_CAPA.map(({ fotos, alt }, i) => (
          <div
            key={i}
            data-testid="diapositivo-capa"
            aria-hidden={i !== actual}
            className={`absolute inset-x-0 transition-opacity duration-1000 ${
              i === actual ? "opacity-100" : "opacity-0"
            } ${
              fotos.length > 1
                ? // A grelha acaba acima dos botões, para nenhum deles tapar uma fotografia.
                  "bottom-[14rem] top-16 grid grid-cols-1 grid-rows-4 bg-white sm:bottom-32 sm:grid-cols-[auto_auto] sm:grid-rows-2 sm:justify-center"
                : "inset-y-0"
            }`}
          >
            {fotos.length === 1 ? (
              <img
                src={fotos[0]}
                alt={i === actual ? t(alt) : ""}
                className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                decoding="async"
              />
            ) : (
              // Na grelha nada se corta: cada fotografia aparece inteira (object-contain) sobre branco.
              fotos.map((src, j) => (
                <img
                  key={`${src}-${j}`}
                  src={src}
                  alt={i === actual ? t(alt) : ""}
                  className="h-full min-h-0 w-full object-contain sm:w-auto"
                  loading="lazy"
                  decoding="async"
                />
              ))
            )}
          </div>
        ))}
      </div>

      <h1 id="hero-titulo" className="sr-only">
        Janelas Para a Alma
      </h1>

      <div className="container relative z-10 flex flex-col items-start gap-5 pb-10 sm:flex-row sm:items-center sm:gap-6 sm:pb-8">
        <div className="flex w-full max-w-sm flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row">
          <Link
            to={localizar("/apoiar?modo=unica")}
            className="inline-flex min-w-[15rem] items-center justify-center gap-3 rounded-full bg-marca-azul px-10 py-4 text-base font-bold uppercase tracking-[0.08em] text-marca-marfim shadow-lg transition-colors hover:bg-marca-marinho md:min-w-[17rem] md:py-5 md:text-lg"
          >
            <Heart className="h-5 w-5" aria-hidden="true" />
            {t("Inicio.doarAgora")}
          </Link>
          {!isLoggedIn && (
            <Link
              to={localizar("/auth")}
              className="inline-flex min-w-[15rem] items-center justify-center gap-3 rounded-full bg-white px-10 py-4 text-base font-bold uppercase tracking-[0.08em] text-marca-azul shadow-lg ring-2 ring-marca-azul transition-colors hover:bg-marca-celeste/30 md:min-w-[17rem] md:py-5 md:text-lg"
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
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

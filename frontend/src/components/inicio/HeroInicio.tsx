import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Heart, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { localizar } from "@/i18n/rotas";
import { NUMEROS_CAPA } from "./numerosCapa";

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
 * Capa da página inicial: carrossel em ecrã inteiro, com um véu azul suave, que muda
 * sozinho a cada 5 s. Por cima, sempre visíveis: "Doar Agora", "Exercícios Visuais",
 * "Entrar" (só sem sessão) e os números do projecto.
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

      {/* Véu azul suave por cima das fotografias (pedido da coordenação, 2026-11-08): mais
          forte do lado do texto e em baixo, para os botões e os números se lerem bem. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-marca-marinho/85 via-marca-marinho/55 to-marca-azul/30"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-marca-marinho/80 via-transparent to-transparent" />

      <h1 id="hero-titulo" className="sr-only">
        Janelas Para a Alma
      </h1>

      <div className="container relative z-10 pb-8 md:pb-12">
        {/* Números do projecto, à esquerda e por cima dos botões (fonte e actualização em numerosCapa.ts). */}
        <ul className="mb-6 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 md:mb-8 md:gap-y-6">
          {NUMEROS_CAPA.map((n) => (
            <li key={n.legenda}>
              <span className="block text-3xl font-bold leading-none text-white md:text-5xl">{n.valor}</span>
              <span className="mt-1.5 block text-sm leading-snug text-white/85 md:mt-2 md:text-base">{t(n.legenda)}</span>
            </li>
          ))}
        </ul>

        <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-4">
          <Link
            to={localizar("/apoiar?modo=unica")}
            className="inline-flex items-center justify-center gap-3 rounded-full bg-marca-azul px-8 py-4 text-base font-bold uppercase tracking-[0.08em] text-white shadow-lg transition-colors hover:bg-marca-azul/85 lg:px-10 lg:py-5 lg:text-lg"
          >
            <Heart className="h-5 w-5 lg:h-6 lg:w-6" aria-hidden="true" />
            {t("Inicio.doarAgora")}
          </Link>
          <Link
            to={localizar("/exercicios")}
            className="inline-flex items-center justify-center gap-3 rounded-full bg-marca-turquesa px-8 py-4 text-base font-bold uppercase tracking-[0.08em] text-marca-marinho shadow-lg transition-colors hover:bg-marca-turquesa/85 lg:px-10 lg:py-5 lg:text-lg"
          >
            <Eye className="h-5 w-5 lg:h-6 lg:w-6" aria-hidden="true" />
            {t("Cabecalho.exerciciosVisuais")}
          </Link>
          {!isLoggedIn && (
            <Link
              to={localizar("/auth")}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-white/10 px-8 py-4 text-base font-bold uppercase tracking-[0.08em] text-white ring-2 ring-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 lg:px-10 lg:py-5 lg:text-lg"
            >
              <LogIn className="h-5 w-5 lg:h-6 lg:w-6" aria-hidden="true" />
              {t("Navbar.entrar")}
            </Link>
          )}
        </div>


        <div className="mt-6 flex w-fit gap-2 rounded-full bg-marca-marinho/40 px-3 py-2">
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

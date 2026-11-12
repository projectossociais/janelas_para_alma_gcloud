import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import fotoEquipa from "@/assets/team-group-stairs.jpg";
import fotoDalva from "@/assets/team-dalva.png";
import fotoLukeny from "@/assets/team-lukeny.png";
import fotoKassia from "@/assets/team-kassia.webp";
import { localizar } from "@/i18n/rotas";

/** Fotografias pequenas à volta da principal: posição em percentagem do quadro. */
const CIRCULOS = [
  { src: fotoDalva, alt: "Visionarios.fotoDalvaAlt", classe: "left-[2%] top-[30%] h-24 w-24 md:h-28 md:w-28" },
  { src: fotoLukeny, alt: "Visionarios.fotoLukenyAlt", classe: "left-[28%] top-0 h-28 w-28 md:h-32 md:w-32" },
  { src: fotoKassia, alt: "Visionarios.fotoKassiaAlt", classe: "right-[4%] top-[4%] h-28 w-28 md:h-36 md:w-36" },
] as const;

/** C. "Guiados por visionários na ciência e no serviço": autoridade da equipa. */
const Visionarios = () => {
  const { t } = useTranslation();
  return (
    <section className="overflow-hidden bg-marca-celeste/25 py-16 md:py-24">
      <div className="container grid items-center gap-12 lg:grid-cols-2">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold leading-tight text-marca-marinho md:text-4xl">{t("Visionarios.titulo")}</h2>
          <p className="mt-5 text-base leading-relaxed text-marca-marinho/85 md:text-lg">{t("Visionarios.paragrafo1")}</p>
          <p className="mt-4 text-base leading-relaxed text-marca-marinho/85 md:text-lg">{t("Visionarios.paragrafo2")}</p>
          <Link
            to={localizar("/equipa")}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-marca-ouro px-6 py-3 text-sm font-bold text-marca-marinho shadow-sm transition-colors hover:bg-marca-ouro/85"
          >
            {t("Visionarios.conhecerAEquipa")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md lg:max-w-lg">
          <img
            src={fotoEquipa}
            alt={t("Visionarios.fotoEquipaAlt")}
            className="absolute bottom-0 left-1/2 h-[72%] w-[72%] -translate-x-1/2 rounded-full border-[6px] border-marca-marfim object-cover shadow-xl"
            loading="lazy"
          />
          {CIRCULOS.map((c) => (
            <img
              key={c.alt}
              src={c.src}
              alt={t(c.alt)}
              className={`absolute rounded-full border-4 border-marca-marfim bg-marca-marfim object-cover object-top shadow-lg ring-4 ring-marca-celeste/60 ${c.classe}`}
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Visionarios;

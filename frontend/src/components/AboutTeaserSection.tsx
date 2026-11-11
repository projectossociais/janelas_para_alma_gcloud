import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import teamGroupPhoto from "@/assets/team-group-stairs.jpg";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

/**
 * Prende as três últimas palavras com espaços que não quebram, para a última linha do
 * parágrafo nunca ficar com uma palavra sozinha ("dele.", pedido da coordenação, 2026-11-11).
 */
const semPalavraSozinha = (texto: string) => {
  const palavras = texto.trim().split(" ");
  if (palavras.length < 4) return texto;
  return [palavras.slice(0, -3).join(" "), palavras.slice(-3).join("\u00a0")].join(" ");
};

const AboutTeaserSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section id="quem-somos" className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 md:items-stretch max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-elevated h-64 sm:h-80 md:h-auto">
            <img
              src={teamGroupPhoto}
              alt={t("AboutTeaserSection.equipaDoJanelasPara")}
              className="absolute inset-0 w-full h-full object-cover"
              decoding="async"
              width={1080}
              height={560}
            />
          </div>

          <div className="space-y-5 flex flex-col justify-center">
            <span className="text-sm font-medium tracking-widest uppercase text-marca-azul">
              {t("AboutTeaserSection.sobreNos")}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-marca-marinho leading-tight">
              {t("AboutTeaserSection.umaEquipaJovemA")}
            </h2>
            <p className="text-marca-marinho/70 leading-relaxed text-base md:text-lg text-justify text-pretty">
              {semPalavraSozinha(t("AboutTeaserSection.somosJovensAngolanosQue"))}
            </p>
            <button
              onClick={() => navigate(localizar("/impacto"))}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-marca-turquesa text-white font-semibold transition-all hover:opacity-90 hover:gap-3 self-start"
            >
              {t("AboutTeaserSection.lerMais")}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutTeaserSection;

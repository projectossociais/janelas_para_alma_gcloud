import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";
import logoIcon from "@/assets/logo-icon.png";

const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section
      className="relative w-full min-h-screen flex items-center justify-start overflow-hidden bg-slate-900"
      style={{
        backgroundImage: `url(${heroImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Preload for fast paint */}
      <img
        src={heroImage}
        alt=""
        aria-hidden="true"
        className="hidden"
        fetchPriority="high"
        decoding="async"
      />
      {/* Dark overlay: heavy on left, transparent on right */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-transparent to-navy/40" />

      <div className="relative z-10 flex flex-col items-start text-left w-full max-w-3xl ml-6 md:ml-12 lg:ml-24 pr-6">
        {/* Bloco do Logótipo (Lockup Horizontal) */}
        <div className="flex flex-row items-center justify-start gap-1 md:gap-2 mb-6">
          <img
            src={logoIcon}
            className="h-28 md:h-40 w-auto object-contain shrink-0 -ml-12 md:-ml-20 lg:-ml-32"
            alt="Logo"
          />

          <div className="flex flex-col items-start">
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight m-0 p-0 text-primary-foreground">
              Janelas
              <br />
              Para a Alma
            </h1>

            <p className="text-xl md:text-2xl font-medium mt-1 text-teal">
              Um Olhar Alinhado, Uma Vida Transformada
            </p>
          </div>
        </div>

        {/* Texto e CTA */}
        <p className="text-xl text-left mb-10 max-w-2xl text-primary-foreground/85">
          Uma instituição angolana que promove a inclusão visual alinhada à economia circular e inovação tecnológica.
        </p>

        <div className="flex flex-row justify-start">
          <button
            onClick={() => navigate("/apoiar")}
            className="group inline-flex items-center gap-3 px-10 py-5 rounded-xl bg-gold text-navy font-bold text-lg md:text-xl transition-all hover:opacity-95 hover:translate-y-[-2px] shadow-elevated ring-2 ring-gold/40 hover:ring-gold/70"
          >
            <Heart className="w-6 h-6 fill-navy" />
            Apoiar
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

import { Link } from "react-router-dom";
import { ArrowUpRight, Gamepad2 } from "lucide-react";
import teamGroupPhoto from "@/assets/team-group-stairs.jpg";
import saudeMundialPhoto from "@/assets/novidade-saude-mundial.jpg";

const novidades = [
  {
    title: "Campanha de Conscientização na Gamek",
    to: "/meu-kamba/campanha-gamek",
    external: false,
    image: teamGroupPhoto,
  },
  {
    title: "Notícias sobre a Saúde Visual no Mundo",
    to: "https://www.cnnbrasil.com.br/tudo-sobre/saude-ocular/",
    external: true,
    image: saudeMundialPhoto,
  },
  {
    title: "Lançamento do nosso jogo: Inclusivamente",
    to: "/jogo-curiosidades",
    external: false,
    image: null,
  },
];

const NovidadesSection = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <div className="text-center mb-12 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Fique por dentro
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">Novidades</h2>
        </div>

        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide touch-pan-x">
          {novidades.map((item) => {
            const cardContent = (
              <>
                <div className="relative w-full h-48 overflow-hidden">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-gold/20 to-navy/10 flex items-center justify-center">
                      <Gamepad2 className="w-10 h-10 text-navy/40" />
                    </div>
                  )}
                  {item.external && (
                    <span className="absolute top-4 left-4 bg-navy text-navy-foreground px-3 py-1 rounded-lg font-semibold text-xs">
                      Externo
                    </span>
                  )}
                </div>
                <div className="p-6 space-y-3 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-foreground leading-snug">
                    {item.title}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-sm text-teal font-medium mt-auto pt-2">
                    Saiba mais...
                    {item.external && <ArrowUpRight className="w-4 h-4" />}
                  </span>
                </div>
              </>
            );

            const cardClass =
              "snap-start shrink-0 w-[85%] sm:w-[70%] md:w-[45%] lg:w-[32%] rounded-2xl overflow-hidden bg-card shadow-card border border-border/50 transition-all hover:shadow-elevated hover:scale-[1.02] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex flex-col";

            return item.external ? (
              <a
                key={item.title}
                href={item.to}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {cardContent}
              </a>
            ) : (
              <Link key={item.title} to={item.to} className={cardClass}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default NovidadesSection;

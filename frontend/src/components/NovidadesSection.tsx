import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FileBadge, Gamepad2, Newspaper } from "lucide-react";
import FirmaOlharAlinhadoModal from "@/components/FirmaOlharAlinhadoModal";
import teamGroupPhoto from "@/assets/team-group-stairs.jpg";
import saudeMundialPhoto from "@/assets/novidade-saude-mundial.jpg";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { disponivelNoIdiomaActual, localizar } from "@/i18n/rotas";
import { publicacoesApi, type PublicacaoPublica } from "@/lib/apiClient";
import { eVideoDaGaleria } from "@/lib/midiaPublicacao";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

type Novidade = {
  readonly title: string;
  /** Destino do cartão; ausente quando o cartão abre um modal. */
  readonly to?: string;
  external: boolean;
  image: string | null;
  /** Vídeo mostrado como miniatura quando não há imagem (publicação só com vídeo). */
  video?: string;
  /** Texto em português vindo da API (marca-se com `lang` no site inglês). */
  conteudoPt?: boolean;
  /** Ícone mostrado no lugar da imagem, quando não há imagem. */
  icon?: typeof Gamepad2;
  readonly tag?: string;
  readonly resumo?: string;
  modal?: "firma";
};

const novidades: Novidade[] = [
  {
    get title() {
      return i18n.t("NovidadesSection.oficializacaoDaFirma");
    },
    get tag() {
      return i18n.t("NovidadesSection.tagInstitucional");
    },
    get resumo() {
      return i18n.t("NovidadesSection.oficializacaoDaFirmaResumo");
    },
    external: false,
    image: null,
    icon: FileBadge,
    modal: "firma",
  },
  {
    get title() {
      return i18n.t("NovidadesSection.campanhaDeConsciencializacaoNa");
    },
    get to() {
      return localizar("/meu-kamba/campanha-gamek");
    },
    external: false,
    image: teamGroupPhoto,
  },
  {
    get title() {
      return i18n.t("NovidadesSection.noticiasSobreASaude");
    },
    to: "https://www.cnnbrasil.com.br/tudo-sobre/saude-ocular/",
    external: true,
    image: saudeMundialPhoto,
  },
  {
    get title() {
      return i18n.t("NovidadesSection.lancamentoDoNossoJogo");
    },
    get to() {
      return localizar("/jogo-curiosidades");
    },
    external: false,
    image: null,
  },
];

/** Uma publicação do blog (`/publicacoes`) como cartão das Novidades. A
 *  miniatura é a capa; sem capa, a primeira foto da galeria; só com vídeo,
 *  o primeiro fotograma do vídeo. */
function novidadeDaPublicacao(p: PublicacaoPublica): Novidade {
  const foto = p.midias.find((m) => !eVideoDaGaleria(m.url));
  const video = p.midias.find((m) => eVideoDaGaleria(m.url));
  return {
    title: p.titulo,
    resumo: p.resumo,
    get tag() {
      return i18n.t("NovidadesSection.tagPublicacao");
    },
    get to() {
      return localizar(`/publicacoes/${p.slug}`);
    },
    external: false,
    image: p.capa_url ?? foto?.url ?? null,
    video: p.capa_url || foto ? undefined : video?.url,
    icon: Newspaper,
    conteudoPt: true,
  };
}

const NovidadesSection = () => {
  const { t } = useTranslation();
  const [modalAberto, setModalAberto] = useState<Novidade["modal"] | null>(null);
  const [publicacoes, setPublicacoes] = useState<Novidade[]>([]);

  useEffect(() => {
    let activo = true;
    // Uma falha aqui nunca estraga a página inicial: ficam só os cartões fixos.
    publicacoesApi
      .listarPublicadas()
      .then((lista) => {
        if (activo) setPublicacoes(lista.map(novidadeDaPublicacao));
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="text-center mb-12 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-marca-azul">
            {t("NovidadesSection.fiquePorDentro")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-marca-marinho">{t("NovidadesSection.novidades")}</h2>
        </div>

        {/* Todas as publicações (mais recentes primeiro) e depois os cartões
            fixos, num carrossel: arrasta-se com o dedo ou muda-se com as setas. */}
        <Carousel opts={{ align: "start" }} aria-label={t("NovidadesSection.novidades")}>
          <CarouselContent className="-ml-6 py-2">
          {[...publicacoes, ...novidades].filter((item) => !item.to || disponivelNoIdiomaActual(item.to)).map((item) => {
            const Icone = item.icon ?? Gamepad2;
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
                  ) : item.video ? (
                    <video
                      src={`${item.video}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      aria-hidden="true"
                      className="w-full h-48 object-cover bg-marca-marinho"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-marca-ouro/20 to-marca-marinho/10 flex items-center justify-center">
                      <Icone className="w-10 h-10 text-marca-marinho/40" />
                    </div>
                  )}
                  {item.external && (
                    <span className="absolute top-4 left-4 bg-marca-marinho text-marca-marfim px-3 py-1 rounded-lg font-semibold text-xs">
                      {t("NovidadesSection.externo")}
                    </span>
                  )}
                  {item.tag && (
                    <span className="absolute top-4 left-4 bg-marca-marinho text-marca-marfim px-3 py-1 rounded-lg font-semibold text-xs">
                      {item.tag}
                    </span>
                  )}
                </div>
                <div className="p-6 space-y-3 flex flex-col flex-1">
                  <h3 lang={item.conteudoPt ? "pt-AO" : undefined} className="text-lg font-bold text-marca-marinho leading-snug">
                    {item.title}
                  </h3>
                  {item.resumo && (
                    <p lang={item.conteudoPt ? "pt-AO" : undefined} className="text-sm text-marca-marinho/70 leading-relaxed line-clamp-3">{item.resumo}</p>
                  )}
                  <span className="inline-flex items-center gap-1 text-sm text-marca-azul font-medium mt-auto pt-2">
                    {t("NovidadesSection.saibaMais")}
                    {item.external && <ArrowUpRight className="w-4 h-4" />}
                  </span>
                </div>
              </>
            );

            const cardClass =
              "h-full w-full rounded-2xl overflow-hidden bg-white shadow-card border border-border/50 transition-shadow hover:shadow-elevated cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex flex-col";
            const itemClass = "pl-6 basis-[85%] sm:basis-[70%] md:basis-1/2 lg:basis-1/3 xl:basis-1/4";

            if (item.modal) {
              const modal = item.modal;
              return (
                <CarouselItem key={item.title} className={itemClass}>
                  <button type="button" onClick={() => setModalAberto(modal)} className={cardClass}>
                    {cardContent}
                  </button>
                </CarouselItem>
              );
            }

            return (
              <CarouselItem key={item.to ?? item.title} className={itemClass}>
                {item.external ? (
                  <a href={item.to} target="_blank" rel="noopener noreferrer" className={cardClass}>
                    {cardContent}
                  </a>
                ) : (
                  <Link to={item.to ?? "/"} className={cardClass}>
                    {cardContent}
                  </Link>
                )}
              </CarouselItem>
            );
          })}
          </CarouselContent>
          <div className="mt-6 flex justify-center gap-3">
            <CarouselPrevious
              aria-label={t("NovidadesSection.anterior")}
              className="static h-10 w-10 translate-y-0 border-marca-marinho/20 text-marca-marinho"
            />
            <CarouselNext
              aria-label={t("NovidadesSection.seguinte")}
              className="static h-10 w-10 translate-y-0 border-marca-marinho/20 text-marca-marinho"
            />
          </div>
        </Carousel>
      </div>

      <FirmaOlharAlinhadoModal
        open={modalAberto === "firma"}
        onOpenChange={(aberto) => setModalAberto(aberto ? "firma" : null)}
      />
    </section>
  );
};

export default NovidadesSection;

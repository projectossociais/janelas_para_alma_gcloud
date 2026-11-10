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

/** Quantas publicações do blog entram nas Novidades (as mais recentes). */
export const MAX_PUBLICACOES_NAS_NOVIDADES = 3;

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
        if (activo) setPublicacoes(lista.slice(0, MAX_PUBLICACOES_NAS_NOVIDADES).map(novidadeDaPublicacao));
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

        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide touch-pan-x">
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
              "snap-start shrink-0 w-[85%] sm:w-[70%] md:w-[45%] lg:w-[32%] xl:w-[calc(25%-1.125rem)] rounded-2xl overflow-hidden bg-white shadow-card border border-border/50 transition-all hover:shadow-elevated hover:scale-[1.02] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex flex-col";

            if (item.modal) {
              const modal = item.modal;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setModalAberto(modal)}
                  className={cardClass}
                >
                  {cardContent}
                </button>
              );
            }

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
              <Link key={item.to ?? item.title} to={item.to ?? "/"} className={cardClass}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      </div>

      <FirmaOlharAlinhadoModal
        open={modalAberto === "firma"}
        onOpenChange={(aberto) => setModalAberto(aberto ? "firma" : null)}
      />
    </section>
  );
};

export default NovidadesSection;

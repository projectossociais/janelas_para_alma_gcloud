import { useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Microscope, Play, Stethoscope, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FOTOS_NO_TERRENO, VIDEO_PRINCIPAL, VIDEOS_CURTOS, type Video } from "./conteudoInicio";

const PILARES = [
  { icone: Users, titulo: "EmAccao.pilarAlcance", texto: "EmAccao.pilarAlcanceTexto" },
  { icone: Stethoscope, titulo: "EmAccao.pilarTriagem", texto: "EmAccao.pilarTriagemTexto" },
  { icone: Microscope, titulo: "EmAccao.pilarInvestigacao", texto: "EmAccao.pilarInvestigacaoTexto" },
  { icone: BookOpen, titulo: "EmAccao.pilarEducacao", texto: "EmAccao.pilarEducacaoTexto" },
] as const;

/**
 * Leitor de vídeo leve: mostra um cartaz e só carrega o iframe do YouTube
 * (youtube-nocookie) quando a pessoa carrega no play -- nada de terceiros a
 * carregar na página inicial sem um gesto. Sem vídeo, o cartaz diz "em breve".
 */
const LeitorVideo = ({ video, vertical }: { video: Video; vertical?: boolean }) => {
  const { t } = useTranslation();
  const [aTocar, setATocar] = useState(false);
  const proporcao = vertical ? "aspect-[9/16]" : "aspect-video";

  if (aTocar && video.youtubeId) {
    return (
      <iframe
        className={`w-full rounded-2xl ${proporcao}`}
        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
        title={t(video.titulo)}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!video.youtubeId}
      onClick={() => setATocar(true)}
      className={`group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-marca-marinho via-marca-azul to-marca-turquesa text-marca-marfim ${proporcao} disabled:cursor-default`}
      aria-label={video.youtubeId ? t("EmAccao.verVideo", { titulo: t(video.titulo) }) : t(video.titulo)}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-marca-marfim/15 ring-2 ring-marca-marfim/60 transition-transform group-enabled:group-hover:scale-110">
        <Play className="ml-1 h-7 w-7 fill-marca-marfim" aria-hidden="true" />
      </span>
      <span className={`mt-4 px-4 text-center font-bold ${vertical ? "text-base" : "text-xl md:text-2xl"}`}>
        {t(video.titulo)}
      </span>
      {!video.youtubeId && (
        <span className="mt-2 rounded-full bg-marca-marfim/15 px-3 py-1 text-xs font-medium">{t("EmAccao.emBreve")}</span>
      )}
    </button>
  );
};

/** D. Vídeos, os quatro pilares e o carrossel de fotografias do terreno. */
const EmAccao = () => {
  const { t } = useTranslation();
  const faixa = useRef<HTMLUListElement>(null);

  const deslizar = (sentido: 1 | -1) => {
    const el = faixa.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="bg-marca-marfim py-16 md:py-24">
      <div className="container">
        <h2 className="text-center text-3xl font-bold text-marca-marinho md:text-4xl">
          {t("EmAccao.vejaO")} <span className="text-marca-azul">Janelas Para a Alma</span> {t("EmAccao.emAccao")}
        </h2>

        <div className="mx-auto mt-10 max-w-4xl">
          <LeitorVideo video={VIDEO_PRINCIPAL} />
        </div>

        <div className="mx-auto mt-8 grid max-w-5xl items-start gap-6 md:grid-cols-[auto_1fr]">
          <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-4 md:w-72">
            {VIDEOS_CURTOS.map((v) => (
              <LeitorVideo key={v.titulo} video={v} vertical />
            ))}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PILARES.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="rounded-2xl border border-marca-marinho/10 p-5">
                <Icone className="h-6 w-6 text-marca-turquesa" aria-hidden="true" />
                <h3 className="mt-3 font-bold text-marca-marinho">{t(titulo)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-marca-marinho/75">{t(texto)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-marca-marinho">{t("EmAccao.noTerreno")}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => deslizar(-1)}
                className="rounded-full border border-marca-marinho/10 p-2 text-marca-marinho hover:bg-marca-celeste/25"
                aria-label={t("EmAccao.fotografiasAnteriores")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => deslizar(1)}
                className="rounded-full border border-marca-marinho/10 p-2 text-marca-marinho hover:bg-marca-celeste/25"
                aria-label={t("EmAccao.fotografiasSeguintes")}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <ul
            ref={faixa}
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide"
            aria-label={t("EmAccao.noTerreno")}
          >
            {FOTOS_NO_TERRENO.map((f) => (
              <li key={f.alt} className="w-72 shrink-0 snap-start md:w-80">
                <img src={f.src} alt={t(f.alt)} className="h-52 w-full rounded-2xl object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default EmAccao;

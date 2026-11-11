import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Eye, Heart, Loader2, Newspaper, Languages } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { publicacoesApi, mensagemDeErroApi, type PublicacaoPublica } from "@/lib/apiClient";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";
import { formatarData } from "@/i18n/formatar";
import { useIdioma } from "@/i18n/useIdioma";
import { IDIOMA_EN, IDIOMA_PT } from "@/i18n/idiomas";
import { minutosDeLeitura } from "@/lib/leitura";

const Publicacoes = () => {
  const { t } = useTranslation();
  const [publicacoes, setPublicacoes] = useState<PublicacaoPublica[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  // O conteúdo das publicações vem da API e só existe em português. No site
  // inglês avisa-se disso e marca-se com `lang`, para leitores de ecrã o
  // pronunciarem correctamente. Em português não muda nada.
  const conteudoNoutroIdioma = useIdioma() === IDIOMA_EN;
  const langConteudo = conteudoNoutroIdioma ? IDIOMA_PT : undefined;

  useEffect(() => {
    (async () => {
      try {
        setPublicacoes(await publicacoesApi.listarPublicadas());
      } catch (err) {
        toast.error(mensagemDeErroApi(err, t("Publicacoes.naoFoiPossivelCarregar")));
      } finally {
        setACarregar(false);
      }
    })();
  }, [t]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* Cabeçalho ao estilo "Stories of Sight": faixa clara com o título centrado */}
        <header className="bg-white">
          <BackButton fallbackPath={localizar("/")} label={t("Publicacoes.voltar")} />
          <div className="container max-w-3xl pb-14 pt-4 text-center md:pb-16">
            <span className="text-sm font-bold uppercase tracking-widest text-marca-turquesa">
              {t("Publicacoes.accoesRecentes")}
            </span>
            <h1 className="mt-3 text-4xl font-bold text-marca-azul md:text-5xl">{t("Publicacoes.historiasDeVisao")}</h1>
            <p className="mt-4 text-lg text-marca-marinho/75">{t("Publicacoes.actividadesCampanhasENoticias")}</p>
          </div>
        </header>

        <div className="container py-12">
          {aCarregar && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-marca-marinho/70" />
            </div>
          )}

          {!aCarregar && !publicacoes.length && (
            <div className="max-w-md mx-auto text-center py-16 space-y-3">
              <Newspaper className="w-10 h-10 mx-auto text-marca-marinho/70" />
              <p className="text-marca-marinho/70">
                {t("Publicacoes.aindaNaoHaPublicacoes")}
              </p>
            </div>
          )}

          <ul id="artigos" className="mx-auto grid max-w-6xl gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            {publicacoes.map((p) => (
              <li key={p.id}>
                <Link
                  to={localizar(`/publicacoes/${p.slug}`)}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-marca-marinho/10 bg-marca-marfim transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azul"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-gradient-to-br from-marca-celeste to-marca-marfim">
                    {p.capa_url && (
                      <img
                        src={p.capa_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-marca-marinho/60">
                      {p.data_evento && <span>{formatarData(p.data_evento)}</span>}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("Publicacoes.minDeLeitura", { count: minutosDeLeitura(p.corpo) })}
                      </span>
                      {p.local && <span lang={langConteudo}>{p.local}</span>}
                      {conteudoNoutroIdioma && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          <Languages className="w-3.5 h-3.5" aria-hidden="true" />
                          {t("Publicacoes.emPortugues")}
                        </span>
                      )}
                    </div>
                    <h2 lang={langConteudo} className="mt-3 text-lg font-bold leading-snug text-marca-marinho group-hover:text-marca-azul">
                      {p.titulo}
                    </h2>
                    <p lang={langConteudo} className="mt-2 line-clamp-3 text-sm text-marca-marinho/75">{p.resumo}</p>
                    <div className="mt-auto flex items-center gap-4 border-t border-marca-marinho/10 pt-4 text-xs text-marca-marinho/60">
                      <span className="inline-flex items-center gap-1" title={t("AccoesPublicacao.visualizacoes")}>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("AccoesPublicacao.nVisualizacoes", { count: p.visualizacoes ?? 0 })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("AccoesPublicacao.nGostos", { count: p.gostos ?? 0 })}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Publicacoes;

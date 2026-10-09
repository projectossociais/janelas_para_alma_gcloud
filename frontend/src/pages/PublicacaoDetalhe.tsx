import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Languages, MapPin, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Contentor } from "@/design/layouts/Contentor";
import { formatarDiaCivil } from "@/i18n/formatar";
import { IDIOMA_EN, IDIOMA_PT } from "@/i18n/idiomas";
import { localizar } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import { publicacoesApi, mensagemDeErroApi, type PublicacaoPublica } from "@/lib/apiClient";

type Estado = { tipo: "a_carregar" } | { tipo: "ok"; publicacao: PublicacaoPublica } | { tipo: "nao_encontrada" } | { tipo: "erro"; mensagem: string };

/**
 * Uma publicação. A galeria é uma grelha de fotos -- até 2026-10-09 era um
 * carrossel que mudava sozinho a cada 10 s sem forma de o parar (WCAG 2.2.2).
 * Um erro que não seja "não encontrada" diz-se, com "Tentar de novo" (antes a
 * página ficava em branco).
 */
const PublicacaoDetalhe = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: "a_carregar" });
  // O conteúdo vem da API e só existe em português. No site inglês avisa-se
  // disso e marca-se com `lang`, para leitores de ecrã o pronunciarem bem.
  const conteudoNoutroIdioma = useIdioma() === IDIOMA_EN;
  const langConteudo = conteudoNoutroIdioma ? IDIOMA_PT : undefined;

  const carregar = useCallback(async () => {
    if (!slug) return;
    setEstado({ tipo: "a_carregar" });
    try {
      setEstado({ tipo: "ok", publicacao: await publicacoesApi.obterPorSlug(slug) });
    } catch (err) {
      // Duck-typing no `status` (CLAUDE.md §6, testes com o módulo mockado).
      if ((err as { status?: unknown } | null)?.status === 404) setEstado({ tipo: "nao_encontrada" });
      else setEstado({ tipo: "erro", mensagem: mensagemDeErroApi(err, t("PublicacaoDetalhe.naoFoiPossivelCarregar")) });
    }
  }, [slug, t]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <Contentor className="py-10 lg:py-14">
      <Botao asChild variante="fantasma" className="-ml-3 px-3">
        <Link to={localizar("/publicacoes")}>
          <ArrowLeft aria-hidden /> {t("PublicacaoDetalhe.voltarAsPublicacoes")}
        </Link>
      </Botao>

      <div className="mt-6">
        {estado.tipo === "a_carregar" && (
          <p role="status" className="text-corpo text-tinta-suave">
            {t("PublicacaoDetalhe.aCarregar")}
          </p>
        )}

        {estado.tipo === "erro" && (
          <Aviso
            variante="erro"
            anunciar
            accao={
              <Botao variante="secundario" onClick={() => void carregar()}>
                <RefreshCw aria-hidden /> {t("PublicacaoDetalhe.tentarDeNovo")}
              </Botao>
            }
          >
            {estado.mensagem}
          </Aviso>
        )}

        {estado.tipo === "nao_encontrada" && (
          <div className="max-w-xl">
            <h1 className="text-titulo-m text-tinta">{t("PublicacaoDetalhe.publicacaoNaoEncontrada")}</h1>
            <p className="mt-2 text-corpo text-tinta-suave">{t("PublicacaoDetalhe.estaPublicacaoPodeTer")}</p>
            <Link to={localizar("/publicacoes")} className="mt-4 inline-block font-medium text-accao underline underline-offset-2">
              {t("PublicacaoDetalhe.verTodasAsPublicacoes")}
            </Link>
          </div>
        )}

        {estado.tipo === "ok" && (
          <article className="max-w-3xl">
            <header>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-legenda text-tinta-suave">
                {estado.publicacao.data_evento && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-4" aria-hidden />
                    {formatarDiaCivil(estado.publicacao.data_evento)}
                  </span>
                )}
                {estado.publicacao.local && (
                  <span lang={langConteudo} className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden />
                    {estado.publicacao.local}
                  </span>
                )}
              </p>
              <h1 lang={langConteudo} className="mt-3 text-titulo-g text-tinta">
                {estado.publicacao.titulo}
              </h1>
              <p lang={langConteudo} className="mt-4 text-corpo-g text-tinta-suave">
                {estado.publicacao.resumo}
              </p>
              {conteudoNoutroIdioma && (
                <p role="note" className="mt-4 inline-flex items-center gap-1.5 rounded-pilula bg-superficie-alt px-3 py-1 text-legenda text-tinta-suave">
                  <Languages className="size-4" aria-hidden />
                  {t("PublicacaoDetalhe.disponivelSoEmPortugues")}
                </p>
              )}
            </header>

            {estado.publicacao.capa_url && (
              // `object-contain`: nunca corta a foto. Decorativa -- o título já diz o que é.
              <div className="mt-8 overflow-hidden rounded-cartao bg-superficie-alt">
                <img src={estado.publicacao.capa_url} alt="" className="max-h-[420px] w-full object-contain" />
              </div>
            )}

            <div lang={langConteudo} className="mt-8 max-w-prose whitespace-pre-wrap text-corpo leading-relaxed text-tinta">
              {estado.publicacao.corpo}
            </div>

            {estado.publicacao.midias.length > 0 && (
              <section aria-labelledby="publicacao-galeria" className="mt-12 border-t border-linha pt-8">
                <h2 id="publicacao-galeria" className="text-titulo-p text-tinta">
                  {t("PublicacaoDetalhe.galeriaDeFotos")}
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {estado.publicacao.midias.map((m, i) => (
                    <li key={m.id}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-controlo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco">
                        <img
                          src={m.url}
                          alt={t("PublicacaoDetalhe.fotoDaGaleria", { n: i + 1, total: estado.publicacao.midias.length })}
                          className="aspect-square w-full object-cover transition-transform duration-transicao hover:scale-[1.02] motion-reduce:transition-none"
                          loading="lazy"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        )}
      </div>
    </Contentor>
  );
};

export default PublicacaoDetalhe;

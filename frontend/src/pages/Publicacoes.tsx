import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Languages, MapPin, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Cartao, CartaoLigacao, CartaoTitulo } from "@/design/componentes/Cartao";
import { Contentor } from "@/design/layouts/Contentor";
import { formatarDiaCivil } from "@/i18n/formatar";
import { IDIOMA_EN, IDIOMA_PT } from "@/i18n/idiomas";
import { localizar } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import { publicacoesApi, mensagemDeErroApi, type PublicacaoPublica } from "@/lib/apiClient";

/**
 * As acções no terreno (publicações), em cartões. Uma falha da API diz-se
 * como falha, com "Tentar de novo" -- até 2026-10-09 terminava em "Ainda não
 * há publicações", que era falso.
 */
const Publicacoes = () => {
  const { t } = useTranslation();
  const [publicacoes, setPublicacoes] = useState<PublicacaoPublica[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O conteúdo das publicações vem da API e só existe em português. No site
  // inglês avisa-se disso e marca-se com `lang`, para leitores de ecrã o
  // pronunciarem correctamente. Em português não muda nada.
  const conteudoNoutroIdioma = useIdioma() === IDIOMA_EN;
  const langConteudo = conteudoNoutroIdioma ? IDIOMA_PT : undefined;

  const carregar = useCallback(async () => {
    setErro(null);
    setPublicacoes(null);
    try {
      setPublicacoes(await publicacoesApi.listarPublicadas());
    } catch (err) {
      setErro(mensagemDeErroApi(err, t("Publicacoes.naoFoiPossivelCarregar")));
    }
  }, [t]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <Contentor className="py-12 lg:py-16">
      <header className="max-w-2xl">
        <p className="text-legenda font-medium text-accao">{t("Publicacoes.accoesRecentes")}</p>
        <h1 className="mt-2 text-titulo-g text-tinta">{t("Publicacoes.noTerrenoComA")}</h1>
        <p className="mt-4 text-corpo-g text-tinta-suave">{t("Publicacoes.actividadesCampanhasENoticias")}</p>
      </header>

      <div className="mt-10">
        {erro ? (
          <Aviso
            variante="erro"
            anunciar
            accao={
              <Botao variante="secundario" onClick={() => void carregar()}>
                <RefreshCw aria-hidden /> {t("Publicacoes.tentarDeNovo")}
              </Botao>
            }
          >
            {erro}
          </Aviso>
        ) : publicacoes === null ? (
          <p role="status" className="text-corpo text-tinta-suave">
            {t("Publicacoes.aCarregar")}
          </p>
        ) : publicacoes.length === 0 ? (
          <p className="text-corpo text-tinta-suave">{t("Publicacoes.aindaNaoHaPublicacoes")}</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {publicacoes.map((p) => (
              <li key={p.id}>
                <Cartao interactivo className="flex h-full flex-col overflow-hidden p-0">
                  {p.capa_url && (
                    // A imagem é decorativa aqui: o título, logo abaixo, já diz o que é.
                    <img src={p.capa_url} alt="" className="h-44 w-full object-cover" loading="lazy" />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-legenda text-tinta-suave">
                      {p.data_evento && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-4" aria-hidden />
                          {formatarDiaCivil(p.data_evento)}
                        </span>
                      )}
                      {p.local && (
                        <span lang={langConteudo} className="inline-flex items-center gap-1">
                          <MapPin className="size-4" aria-hidden />
                          {p.local}
                        </span>
                      )}
                      {conteudoNoutroIdioma && (
                        <span className="inline-flex items-center gap-1 rounded-pilula bg-superficie-alt px-2 py-0.5">
                          <Languages className="size-4" aria-hidden />
                          {t("Publicacoes.emPortugues")}
                        </span>
                      )}
                    </p>
                    <CartaoTitulo como="h2" className="mt-3" lang={langConteudo}>
                      <CartaoLigacao asChild>
                        <Link to={localizar(`/publicacoes/${p.slug}`)}>
                          {p.titulo}
                        </Link>
                      </CartaoLigacao>
                    </CartaoTitulo>
                    <p lang={langConteudo} className="mt-2 line-clamp-3 text-corpo text-tinta-suave">
                      {p.resumo}
                    </p>
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Contentor>
  );
};

export default Publicacoes;

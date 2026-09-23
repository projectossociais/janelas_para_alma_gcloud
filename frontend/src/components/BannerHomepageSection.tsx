import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { bannerHomepageApi, type BannerHomepagePublico } from "@/lib/apiClient";
import { useTranslation } from "react-i18next";

/** Secção visual só na homepage, para campanhas/promoções -- distinta da
 * `HeroSection` (fixa, identidade da marca) e da faixa fina de aviso
 * (`SiteBanner`, texto só). Sem banner ativo com foto é um estado normal:
 * a secção simplesmente não aparece, nunca quebra a página (mesmo
 * princípio do SiteBanner). */
const BannerHomepageSection = () => {
  const { t } = useTranslation();
  const [banner, setBanner] = useState<BannerHomepagePublico | null>(null);

  useEffect(() => {
    bannerHomepageApi
      .obterAtivo()
      .then(setBanner)
      .catch(() => {
        // Sem banner é normal — nunca deve derrubar a homepage.
      });
  }, []);

  if (!banner || !banner.imagem_url) return null;

  const conteudo = (
    <>
      <img
        src={banner.imagem_url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent" />
      <div className="relative h-full flex flex-col justify-end gap-2 p-6 md:p-10 text-white">
        <h2 className="text-2xl md:text-4xl font-bold">{banner.titulo}</h2>
        {banner.descricao && <p className="max-w-xl text-white/90">{banner.descricao}</p>}
        {banner.link && (
          <span className="inline-flex items-center gap-1.5 font-semibold mt-1">
            {t("BannerHomepageSection.saberMais")}{" "}<ArrowRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </>
  );

  return (
    <section className="container py-8 md:py-12">
      {banner.link ? (
        <Link
          to={banner.link}
          className="relative block w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-elevated"
        >
          {conteudo}
        </Link>
      ) : (
        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-elevated">
          {conteudo}
        </div>
      )}
    </section>
  );
};

export default BannerHomepageSection;

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { bannerHomepageApi, type BannerHomepagePublico } from "@/lib/apiClient";
import { Contentor } from "@/design/layouts/Contentor";
import { Ligacao } from "@/design/Ligacao";

/**
 * Campanha em destaque, gerida pelos admins (`/admin/banners`, banner da
 * homepage). Mesmo comportamento da secção antiga: sem campanha activa, ou se
 * a API falhar, a secção não aparece e nunca parte a página. Composição
 * editorial: imagem e texto lado a lado, não um cartaz a toda a largura.
 */
export const CampanhaDestaque = () => {
  const { t } = useTranslation();
  const [campanha, setCampanha] = useState<BannerHomepagePublico | null>(null);

  useEffect(() => {
    let activo = true;
    bannerHomepageApi
      .obterAtivo()
      .then((b) => activo && setCampanha(b))
      .catch(() => {
        // Sem campanha é um estado normal: a página continua inteira.
      });
    return () => {
      activo = false;
    };
  }, []);

  if (!campanha?.imagem_url) return null;

  return (
    <section aria-labelledby="inicio-campanha" className="bg-superficie py-16 lg:py-20">
      <Contentor className="grid items-center gap-8 md:grid-cols-12">
        <img
          src={campanha.imagem_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-video w-full rounded-cartao object-cover md:col-span-7"
        />
        <div className="md:col-span-5">
          <h2 id="inicio-campanha" className="text-titulo-m text-tinta">
            {campanha.titulo}
          </h2>
          {campanha.descricao && <p className="mt-3 text-corpo text-tinta-suave">{campanha.descricao}</p>}
          {campanha.link && (
            <Ligacao
              href={campanha.link}
              className="mt-6 inline-flex min-h-alvo-app items-center gap-2 rounded-controlo font-medium text-accao underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              {t("Inicio.campanhaSaberMais")} <ArrowRight className="size-5" aria-hidden />
            </Ligacao>
          )}
        </div>
      </Contentor>
    </section>
  );
};

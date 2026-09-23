import { useEffect, useRef, useState } from "react";
import { bannersApi, type BannerPublico } from "@/lib/apiClient";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { useDefinirSiteBannerAltura } from "@/contexts/SiteBannerContext";
import { useTranslation } from "react-i18next";

const SiteBanner = () => {
  const { t } = useTranslation();
  const [banner, setBanner] = useState<BannerPublico | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const definirAltura = useDefinirSiteBannerAltura();

  useEffect(() => {
    bannersApi
      .obterAtivo()
      .then((data) => {
        if (data) {
          const stored = localStorage.getItem(`banner_dismissed_${data.id}`);
          if (!stored) setBanner(data);
        }
      })
      .catch(() => {
        // Sem banner é um estado normal — nunca deve quebrar o resto da página.
      });
  }, []);

  const visivel = !!banner && !dismissed;

  // O Navbar (fixo, no topo) precisa de saber a altura real desta faixa
  // para se deslocar para baixo — sem isto sobrepunham-se sempre os dois
  // (ver SiteBannerContext.tsx). `ResizeObserver` porque a altura muda com
  // o wrap do texto em ecrãs estreitos, não só quando o banner aparece/some.
  useEffect(() => {
    if (!visivel || !ref.current) {
      definirAltura(0);
      return;
    }
    const elemento = ref.current;
    const observer = new ResizeObserver(([entry]) => definirAltura(entry.contentRect.height));
    observer.observe(elemento);
    return () => {
      observer.disconnect();
      definirAltura(0);
    };
  }, [visivel, definirAltura]);

  if (!visivel) return null;

  const dismiss = () => {
    localStorage.setItem(`banner_dismissed_${banner!.id}`, "1");
    setDismissed(true);
  };

  const inner = (
    <div className="container flex items-center justify-center gap-2 py-2 px-4 text-sm text-center">
      <span className="font-semibold">{banner!.titulo}</span>
      <span className="opacity-90">— {banner!.mensagem}</span>
    </div>
  );

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 right-0 z-[60] w-full bg-teal text-teal-foreground"
    >
      {banner!.link ? (
        <Link to={banner!.link} className="block hover:underline">{inner}</Link>
      ) : inner}
      <button
        onClick={dismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10"
        aria-label={t("SiteBanner.fechar")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SiteBanner;

import { useEffect, useState } from "react";
import { bannersApi, type BannerPublico } from "@/lib/apiClient";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

const SiteBanner = () => {
  const [banner, setBanner] = useState<BannerPublico | null>(null);
  const [dismissed, setDismissed] = useState(false);

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

  if (!banner || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(`banner_dismissed_${banner.id}`, "1");
    setDismissed(true);
  };

  const inner = (
    <div className="container flex items-center justify-center gap-2 py-2 px-4 text-sm text-center">
      <span className="font-semibold">{banner.titulo}</span>
      <span className="opacity-90">— {banner.mensagem}</span>
    </div>
  );

  return (
    <div className="w-full bg-teal text-teal-foreground relative">
      {banner.link ? (
        <Link to={banner.link} className="block hover:underline">{inner}</Link>
      ) : inner}
      <button
        onClick={dismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SiteBanner;

import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      {/* O vercel.json serve o index.html (200) para qualquer URL: sem isto, um
          URL inexistente seria indexável como página ("soft 404"). */}
      <Helmet>
        <title>{t("seo.modeloTitulo", { pagina: t("seo.naoEncontradaTitulo") })}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("NotFound.oopsPageNotFound")}</p>
        <a href={localizar("/")} className="text-primary underline hover:text-primary/90">
          {t("NotFound.returnToHome")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;

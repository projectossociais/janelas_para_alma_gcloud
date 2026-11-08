import Navbar from "@/components/Navbar";
import BannerHomepageSection from "@/components/BannerHomepageSection";
import HeroInicio from "@/components/inicio/HeroInicio";
import NarrativaImpacto from "@/components/inicio/NarrativaImpacto";
import Visionarios from "@/components/inicio/Visionarios";
import EmAccao from "@/components/inicio/EmAccao";
import ParceirosSection from "@/components/ParceirosSection";
import HistoriasTransformacao from "@/components/inicio/HistoriasTransformacao";
import Footer from "@/components/Footer";

/**
 * Página inicial (redesenho de 2026-10-26, inspirado no Project Prakash):
 * uma narrativa por secções -- pilares e visão/missão, a realidade e os
 * números, a equipa, a acção em vídeo, os parceiros e as histórias.
 * O banner gerido no painel de administração continua logo a seguir ao hero.
 */
const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-marca-marfim">
      <Navbar />
      <main className="flex-1">
        <HeroInicio />
        <BannerHomepageSection />
        <NarrativaImpacto />
        <Visionarios />
        <EmAccao />
        <ParceirosSection />
        <HistoriasTransformacao />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

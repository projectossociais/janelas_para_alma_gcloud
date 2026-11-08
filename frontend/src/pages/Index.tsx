import Navbar from "@/components/Navbar";
import HeroInicio from "@/components/inicio/HeroInicio";
import BannerHomepageSection from "@/components/BannerHomepageSection";
import StrabismusIntroCard from "@/components/StrabismusIntroCard";
import OlharesCarrossel from "@/components/inicio/OlharesCarrossel";
import AboutTeaserSection from "@/components/AboutTeaserSection";
import PillarsSection from "@/components/PillarsSection";
import CuriosidadesSection from "@/components/CuriosidadesSection";
import NovidadesSection from "@/components/NovidadesSection";
import ParceirosSection from "@/components/ParceirosSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <HeroInicio />
        <BannerHomepageSection />
        <StrabismusIntroCard />
        <OlharesCarrossel />
        <AboutTeaserSection />
        <PillarsSection />
        <CuriosidadesSection />
        <NovidadesSection />
        <ParceirosSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;


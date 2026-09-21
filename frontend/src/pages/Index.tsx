import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StrabismusIntroCard from "@/components/StrabismusIntroCard";
import AboutTeaserSection from "@/components/AboutTeaserSection";
import PillarsSection from "@/components/PillarsSection";
import CuriosidadesSection from "@/components/CuriosidadesSection";
import NovidadesSection from "@/components/NovidadesSection";
import ParceirosSection from "@/components/ParceirosSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StrabismusIntroCard />
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


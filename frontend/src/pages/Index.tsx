import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import BannerHomepageSection from "@/components/BannerHomepageSection";
import StrabismusIntroCard from "@/components/StrabismusIntroCard";
import ExercisesSection from "@/components/ExercisesSection";
import PillarsSection from "@/components/PillarsSection";


import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <BannerHomepageSection />
        <StrabismusIntroCard />
        <ExercisesSection />
        <PillarsSection />


      </main>
      <Footer />
    </div>
  );
};

export default Index;


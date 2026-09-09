import Navbar from "@/components/Navbar";
import AboutSection from "@/components/AboutSection";
import StrabismusSection from "@/components/StrabismusSection";
import Footer from "@/components/Footer";

const Sobre = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-14 md:pt-16 pb-24">
        <AboutSection />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <StrabismusSection />
      </main>
      <Footer />
    </div>
  );
};

export default Sobre;

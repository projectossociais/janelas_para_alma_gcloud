import Navbar from "@/components/Navbar";
import StrabismusSection from "@/components/StrabismusSection";
import Footer from "@/components/Footer";

const Sobre = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-14 md:pt-16">
        <StrabismusSection />
      </main>
      <Footer />
    </div>
  );
};

export default Sobre;

import Navbar from "@/components/Navbar";
import StrabismusSection from "@/components/StrabismusSection";
import Footer from "@/components/Footer";

const Sobre = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1">
        <StrabismusSection />
      </div>
      <Footer />
    </div>
  );
};

export default Sobre;

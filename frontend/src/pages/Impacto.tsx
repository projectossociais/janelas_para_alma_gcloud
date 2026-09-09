import Navbar from "@/components/Navbar";
import ImpactSection from "@/components/ImpactSection";
import Footer from "@/components/Footer";

const Impacto = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        <ImpactSection />
      </main>
      <Footer />
    </div>
  );
};

export default Impacto;

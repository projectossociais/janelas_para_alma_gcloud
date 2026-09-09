import Navbar from "@/components/Navbar";
import TeamSection from "@/components/TeamSection";
import Footer from "@/components/Footer";

const Equipa = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-14 md:pt-16 pb-24">
        <TeamSection />
      </main>
      <Footer />
    </div>
  );
};

export default Equipa;

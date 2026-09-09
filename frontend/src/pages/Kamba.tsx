import Navbar from "@/components/Navbar";
import VolunteerSection from "@/components/VolunteerSection";
import Footer from "@/components/Footer";

const Kamba = () => {
  return (
    <div className="min-h-screen flex flex-col bg-navy">
      <Navbar />
      <main className="flex-1 pt-14 md:pt-16 pb-24">
        <VolunteerSection />
      </main>
      <Footer />
    </div>
  );
};

export default Kamba;

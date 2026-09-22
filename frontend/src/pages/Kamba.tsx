import Navbar from "@/components/Navbar";
import VolunteerSection from "@/components/VolunteerSection";
import ActivitiesFeed from "@/components/kamba/ActivitiesFeed";
import Footer from "@/components/Footer";

const Kamba = () => {
  return (
    <div className="min-h-screen flex flex-col bg-navy">
      <Navbar />
      <main className="flex-1 pt-14 md:pt-16">
        <VolunteerSection />
        <ActivitiesFeed />
      </main>
      <Footer />
    </div>
  );
};

export default Kamba;

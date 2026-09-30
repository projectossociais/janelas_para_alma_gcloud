import Navbar from "@/components/Navbar";
import VolunteerSection from "@/components/VolunteerSection";
import ActivitiesFeed from "@/components/kamba/ActivitiesFeed";
import UpcomingActivities from "@/components/kamba/UpcomingActivities";
import Footer from "@/components/Footer";

const Kamba = () => {
  return (
    <div className="min-h-screen flex flex-col bg-navy">
      <Navbar />
      <div className="flex-1">
        <VolunteerSection />
        <UpcomingActivities />
        <ActivitiesFeed />
      </div>
      <Footer />
    </div>
  );
};

export default Kamba;

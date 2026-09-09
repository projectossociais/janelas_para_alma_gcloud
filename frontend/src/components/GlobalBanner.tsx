import { useLocation } from "react-router-dom";
import SiteBanner from "@/components/SiteBanner";

const GlobalBanner = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return <SiteBanner />;
};

export default GlobalBanner;

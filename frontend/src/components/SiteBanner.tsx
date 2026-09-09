import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

interface Banner {
  id: string;
  title: string;
  message: string;
  link: string | null;
  color: string;
  active: boolean;
}

const colorMap: Record<string, string> = {
  teal: "bg-teal text-teal-foreground",
  navy: "bg-navy text-primary-foreground",
  gold: "bg-gold text-navy",
  green: "bg-green-600 text-white",
  red: "bg-red-600 text-white",
};

const SiteBanner = () => {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    supabase
      .from("banners")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const stored = localStorage.getItem(`banner_dismissed_${data.id}`);
          if (!stored) setBanner(data as Banner);
        }
      });
  }, []);

  if (!banner || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(`banner_dismissed_${banner.id}`, "1");
    setDismissed(true);
  };

  const cls = colorMap[banner.color] || colorMap.teal;

  const inner = (
    <div className="container flex items-center justify-center gap-2 py-2 px-4 text-sm text-center">
      <span className="font-semibold">{banner.title}</span>
      <span className="opacity-90">— {banner.message}</span>
    </div>
  );

  return (
    <div className={`w-full ${cls} relative`}>
      {banner.link ? (
        <Link to={banner.link} className="block hover:underline">{inner}</Link>
      ) : inner}
      <button
        onClick={dismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SiteBanner;

import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Images } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import teamGroupPhoto from "@/assets/team-group-stairs.jpg";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

const ActivitiesFeed = () => {
  const { t } = useTranslation();
  return (
    <section id="acoes-recentes" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-4 mb-12">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            {t("ActivitiesFeed.accaoNoTerreno")}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold">
            {t("ActivitiesFeed.campanhaDeConsciencializacaoNa")}
          </h2>
        </div>

        <Card className="max-w-3xl mx-auto overflow-hidden shadow-elevated">
          <CardContent className="p-8 md:p-10 flex flex-col items-center text-center gap-6">
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap justify-center">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {t("ActivitiesFeed.n12DeSetembro")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {t("ActivitiesFeed.gamekLuanda")}
              </span>
            </div>

            <img
              src={teamGroupPhoto}
              alt={t("ActivitiesFeed.equipaDoJanelasPara")}
              className="w-full max-w-xl mx-auto rounded-xl object-cover max-h-64"
              loading="lazy"
            />

            <p className="text-muted-foreground leading-relaxed max-w-xl">
              {t("ActivitiesFeed.acompanheDePertoA")}
            </p>

            <Link
              to={localizar("/meu-kamba/campanha-gamek")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal text-teal-foreground font-bold shadow-elevated transition-all hover:opacity-90 hover:translate-y-[-2px]"
            >
              <Images className="w-5 h-5" />
              {t("ActivitiesFeed.verGaleriaDaAccao")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ActivitiesFeed;

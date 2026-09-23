import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

interface CampaignVideo {
  src: string;
  title: string;
  summary: string;
}

const campaignVideos: CampaignVideo[] = [
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Campanha%20de%20conscientizacao.mp4#t=0.001",
    get title() {
      return i18n.t("CampanhaGamek.vozesDaMudancaNas");
    },
    get summary() {
      return i18n.t("CampanhaGamek.voluntariosEEmbaixadoresDe");
    },
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Dalva%20Introducao%20ao%20Projecto.mp4#t=0.001",
    get title() {
      return i18n.t("CampanhaGamek.missaoEPropositoSocial");
    },
    get summary() {
      return i18n.t("CampanhaGamek.dalvaFilipeExplicaA");
    },
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Kambas.mp4#t=0.001",
    get title() {
      return i18n.t("CampanhaGamek.historiasReaisESuperacao");
    },
    get summary() {
      return i18n.t("CampanhaGamek.testemunhosInspiradoresDeNoelma");
    },
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/JPA%20Grupo.mov#t=0.001",
    get title() {
      return i18n.t("CampanhaGamek.gritoDeEsperancaE");
    },
    get summary() {
      return i18n.t("CampanhaGamek.oEncerramentoMarcanteDa");
    },
  },
];

const CampanhaGamek = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/kamba")} label={t("CampanhaGamek.voltarAoMeuKamba")} />
      <main className="flex-1">
        <div className="container">
          <div className="max-w-3xl mx-auto flex flex-col gap-12 py-10">
            <header className="text-center space-y-2">
              <span className="text-sm font-medium tracking-widest uppercase text-teal">
                {t("CampanhaGamek.n12DeSetembro")}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold">
                {t("CampanhaGamek.campanhaDeConsciencializacaoSobre")}
              </h1>
            </header>

            <div className="flex flex-col items-center gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8">
              <img
                src="/assets/kamba/campanha-gamek-poster.jpg"
                alt={t("CampanhaGamek.cartazDaCampanhaDe")}
                className="w-full max-w-xl mx-auto rounded-xl object-contain"
              />
              <div className="text-muted-foreground leading-relaxed space-y-4">
                <p>
                  {t("CampanhaGamek.noDia12De")}
                </p>
                <p>
                  {t("CampanhaGamek.aComunidadeMeuKamba")}
                </p>
                <p>
                  {t("CampanhaGamek.reafirmamosONossoCompromisso")}
                </p>
                <p>
                  {t("CampanhaGamek.janelasParaAAlma")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <hr className="border-slate-200" />
              <h2 className="text-xl md:text-2xl font-bold text-center">
                {t("CampanhaGamek.coberturaEmVideoDa")}
              </h2>
            </div>

            {campaignVideos.map((video) => (
              <div key={video.src} className="bg-white shadow-sm border border-slate-100 rounded-xl p-6 flex flex-col gap-4">
                <video
                  controls
                  preload="metadata"
                  className="max-h-[480px] w-auto mx-auto rounded-lg object-contain bg-black/5"
                  src={video.src}
                />
                <div>
                  <p className="font-bold">{video.title}</p>
                  <p className="text-muted-foreground">{video.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CampanhaGamek;

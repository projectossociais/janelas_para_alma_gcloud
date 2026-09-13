import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";

interface CampaignVideo {
  src: string;
  description: string;
}

const campaignVideos: CampaignVideo[] = [
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Campanha%20de%20conscientizacao.mp4",
    description: "Resumo da Campanha de Conscientização nas ruas da Gamek.",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Dalva%20Introducao%20ao%20Projecto.mp4",
    description: "Dalva apresenta o impacto e a missão do projeto.",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Kambas.mp4",
    description: "Os nossos Kambas em ação no terreno.",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/JPA%20Grupo.mov",
    description: "A nossa equipa unida pela causa Janelas Para a Alma.",
  },
];

const CampanhaGamek = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton to="/kamba" label="Voltar ao Meu Kamba" />
      <main className="flex-1">
        <div className="container">
          <div className="max-w-3xl mx-auto flex flex-col gap-12 py-10">
            <header className="text-center space-y-2">
              <span className="text-sm font-medium tracking-widest uppercase text-teal">
                12 de Setembro
              </span>
              <h1 className="text-3xl md:text-4xl font-bold">
                Campanha de Conscientização sobre o Estrabismo na Gamek
              </h1>
            </header>

            {campaignVideos.map((video) => (
              <div key={video.src} className="flex flex-col gap-3">
                <video controls preload="metadata" className="w-full rounded-lg" src={video.src} />
                <p className="text-muted-foreground">{video.description}</p>
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

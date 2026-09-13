import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";

interface CampaignVideo {
  src: string;
  title: string;
  summary: string;
}

const campaignVideos: CampaignVideo[] = [
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Campanha%20de%20conscientizacao.mp4#t=0.001",
    title: "Vozes da Mudança nas Ruas da Gamek 🚶🏾‍♂️📢",
    summary:
      "Voluntários e embaixadores de inclusão visual abordam a comunidade sobre o estrabismo, partilham soluções acessíveis e convidam novos jovens a juntarem-se à causa.",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Dalva%20Introducao%20ao%20Projecto.mp4#t=0.001",
    title: "Missão e Propósito Social 💡🌍",
    summary:
      "A Dalva explica a importância de levar informação precisa às famílias, combater diagnósticos errados e erradicar o estigma associado ao estrabismo.",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Kambas.mp4#t=0.001",
    title: "Histórias Reais e Superação 💙👀",
    summary:
      "Testemunhos inspiradores de quem convive com a condição desde cedo e o impacto transformador da empatia e do apoio mútuo na autoestima.",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/JPA%20Grupo.mov#t=0.001",
    title: "Grito de Esperança e União 🚀🙌🏾",
    summary:
      "O encerramento marcante da nossa equipa celebrando o compromisso conjunto: Um olhar alinhado, uma vida transformada!",
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

            <div className="flex flex-col items-center gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8">
              <img
                src="/assets/kamba/campanha-gamek-poster.jpg"
                alt="Cartaz da Campanha de Conscientização sobre o Estrabismo na Gamek"
                className="w-full max-w-xl mx-auto rounded-xl object-contain"
              />
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                Hoje realizou-se a campanha de conscientização sobre o estrabismo pelas ruas da Gamek, na cidade de Luanda.{"\n\n"}
                A comunidade Meu Kamba Estrábico, pertencente ao Janelas para a Alma, efectivou hoje, pelas 9h30 a campanha de conscientização e sensibilização cujo objectivo principal foi transmitir às pessoas informações importantes sobre a condição e apresentar a nossa proposta de valor, a plataforma Janelas para a Alma, onde foi possível abordar diversas pessoas portadoras da condição ou ainda próximos à pessoas com a condição.{"\n\n"}
                Reafirmamos o nosso compromisso com a difusão da informação sobre o estrabismo e saúde visual.{"\n\n"}
                Janelas para a alma - Um olhar alinhado, uma vida transformada.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <hr className="border-slate-200" />
              <h2 className="text-xl md:text-2xl font-bold text-center">
                Cobertura em Vídeo da Ação no Terreno
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

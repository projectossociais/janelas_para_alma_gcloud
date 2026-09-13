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
    description:
      "🚶🏾‍♂️📢✨ Hoje, jovens agentes de mudança saem às ruas para falar sobre uma causa que, muitas das vezes, é ignorada, mas é mais frequente do que nós podemos pensar. Sim, este é o estrabismo. E nós estamos aqui voluntários, kambas estrábicos e embaixadores de inclusão visual, saem às ruas para falar e mostrar que esta causa não deve ser mais ignorada. E um dos primeiros passos para conseguirmos resolver este problema é comunicar. Então, venha conosco, se torne um voluntário.",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Dalva%20Introducao%20ao%20Projecto.mp4",
    description:
      "🌍A transformação acontece quando nós conseguimos identificar qual problema e qual comunidade servimos, e envolver pessoas que possam realmente fazer com que ela aconteça. Parte do conhecimento, parte da identificação e parte da consciência de mudar e identificar o que é que nos aflige. É por isso que hoje nós saímos às ruas para conscientizar e realizar a nossa campanha sobre o estrabismo. Muitas das pessoas que vivem e convivem com o estrabismo, além das suas famílias, não têm informação precisa a qualquer hora e a qualquer momento, e têm sempre dúvidas. Algumas sofrem por estigma e outras, sem saber o que sofrem, recebem diagnósticos que não são os que deviam receber. Por isso, nós vamos às ruas para conscientizar, alertar e despertar para mais conhecimento sobre o estrabismo e podermos erradicar a ignorância a nível do estrabismo. Por isso, venha connosco e vamos juntos!",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/Kambas.mp4",
    description:
      "💙👀🫂 Eu decidi participar desta iniciativa porque o estrabismo também faz parte da minha história. Eu sou uma pessoa estrábica, mas pouco se nota porque eu comecei o acompanhamento cedo. Então, participar deste projeto é dar oportunidade com que mais pessoas recebam informações importantes sobre esta condição e comecem o acompanhamento cedo, porque faz total diferença.\n\nOlá, eu sou a Josefina Afonso. Eu vim apoiar esta campanha porque eu tenho a noção que informação é poder. E trazendo esta informação para a rua vai ajudar muita gente que sofre com autoestima baixa por ter o estrabismo.\n\nSaudações! Chamo-me Welton Vieira Dias e sou voluntário do Janelas Para a Alma. A princípio, eu não tinha muito conhecimento sobre estrabismo, mas com a ajuda com os meus amigos dos meus amigos, eu pude entender que o estrabismo não é só uma questão visual, mas que impacta também a qualidade de vida e a saúde dos indivíduos. É bem sabido que muitas pessoas com a condição de estrabismo sofrem bullying e preconceito por parte da sociedade. E e é por isso que eu participei nessa campanha, porque informar a sociedade também é uma forma de promover a empatia, a inclusão e o respeito a todos. Muito obrigado!",
  },
  {
    src: "https://yjzqnjatrdngzfixrxcg.supabase.co/storage/v1/object/public/kamba-media/JPA%20Grupo.mov",
    description: "🚀🔥 Líder: Janelas Para a Alma!\nGrupo: Um olhar alinhado, uma vida transformada!",
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
                <p className="text-muted-foreground whitespace-pre-line">{video.description}</p>
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

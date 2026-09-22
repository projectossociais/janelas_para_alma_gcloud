import { useState } from "react";
import { Linkedin, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import teamDalva from "@/assets/team-dalva.png";
import teamManuel from "@/assets/team-manuel.png";
import teamLukeny from "@/assets/team-lukeny.png";
import teamPedro from "@/assets/team-pedro.png";
import teamKassia from "@/assets/team-kassia.webp";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  description: string;
  image: string;
  bio: string;
  mission: string;
  linkedin: string;
  email: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 1,
    name: "Dalva Filipe",
    role: "Coordenação Geral",
    description: "Impulsionando a visão do Janelas para a Alma.",
    image: teamDalva,
    bio: "Sou estudante do terceiro ano do curso de Contabilidade e Finanças no ISAF e bolseira de mérito da Fundação BAI. Natural de Benguela, desenvolvo-me activamente em iniciativas ligadas à educação financeira, liderança juvenil e mercado de capitais.\n\nFaço parte da coordenação do Clube de Finanças do ISAF e desempenho funções de liderança em diversos projectos estudantis e associativos. Paralelamente, sou investidora e tenho interesse em contribuir para a inclusão financeira e o desenvolvimento social.",
    mission: "O que me move neste projecto é a vontade de dar voz e visibilidade a realidades que muitas vezes passam despercebidas, promovendo empatia, inclusão e consciência social. Acredito que pequenas acções podem gerar grandes mudanças, e este projecto é a minha forma de contribuir para uma sociedade mais humana e atenta às diferenças.\n\n\"O 'Janelas para a Alma' nasceu da necessidade de dar visibilidade ao que muitas vezes é ignorado porque compreender o outro também é uma forma de transformar o mundo.\"",
    linkedin: "https://www.linkedin.com/in/dalva-filipe-b7523129b",
    email: "dalvafilipe182@gmail.com",
  },
  {
    id: 2,
    name: "Manuel Francisco",
    role: "Director Financeiro",
    description: "Investigador e líder jovem dedicado à inclusão visual.",
    image: teamManuel,
    bio: "Sou estudante universitário de Contabilidade e Finanças no ISAF, com forte interesse em investigação científica e liderança.\n\nJuntei-me ao Janelas Para a Alma porque acredito que ver o outro com humanidade é o primeiro passo para transformar qualquer sociedade. Num contexto em que o estrabismo ainda é alvo de estigma, acredito que a educação, a tecnologia e a inclusão são as ferramentas mais poderosas para mudar essa realidade.",
    mission: "Acredito que a educação, a tecnologia e a inclusão são as ferramentas mais poderosas para transformar realidades marcadas pelo estigma.\n\n\"Ver o outro com humanidade é o primeiro passo para transformar qualquer sociedade.\"",
    linkedin: "https://www.linkedin.com/in/manuel-francisco-050428327",
    email: "manuelfrancisco.profissional@gmail.com",
  },
  {
    id: 3,
    name: "Lukeny Viegas",
    role: "Director de TI",
    description: "Amplificando a nossa mensagem e mobilizando a comunidade.",
    image: teamLukeny,
    bio: "Estudante universitário, natural de Luanda, Angola. Amante de práticas contabilistas, ESL Student at UofA e graduando em Finance.\n\nInteressado em projectos ligados à acção social desde cedo e almejo contribuir mais para o Projecto \"Janelas Para a Alma\" de modo a torná-lo realidade.",
    mission: "O forte desejo de ajudar outrem move-me a ajudar os mais necessitados e, para este projecto, ajudar aqueles que sofrem a condição. Este projecto é muito mais abrangente do que eu possa enxergar, as janelas da visão e mentalidade que pretendemos alcançar.\n\n\"Este projecto visa abrir a Janela que sempre ficava fechada, a mentalidade e a alma dos que sofrem a condição e os que nem conhecem\".",
    linkedin: "https://www.linkedin.com/in/lukeny-viegas-4524a5356",
    email: "lukenyviegas1@gmail.com",
  },
  {
    id: 4,
    name: "Pedro Sapalo",
    role: "Director de Legalização e Logística",
    description: "Garantindo a conformidade e a eficiência operacional.",
    image: teamPedro,
    bio: "Sou estudante universitário com forte interesse em pesquisa científica e aplicada. Fora do projecto \"Janelas para a Alma\", coopero activamente em associativismo académico, contribuindo para o fortalecimento da comunidade estudantil e para a promoção de iniciativas de impacto social e educacional.",
    mission: "O que me inspira neste projeto é a possibilidade de promover a inclusão visual, reconhecimento e valorização das pessoas acometidas com estrabismo e outras deficiências visuais.\n\n\"Juntei-me ao Janelas Para a Alma porque acredito que iniciativas como esta têm o poder de impactar vidas e de nos ensinar a enxergar as diferenças com respeito e humanidade.\"",
    linkedin: "https://www.linkedin.com/in/pedrosapalo",
    email: "sapalop15@gmail.com",
  },
  {
    id: 5,
    name: "Kássia Nunda",
    role: "Directora de Comunicação e Marketing",
    description: "Construindo alianças e definindo o rumo do nosso crescimento.",
    image: teamKassia,
    bio: "Sou uma jovem cristã de 22 anos, estudante do 3.º ano da Licenciatura em Contabilidade e Finanças no Instituto Superior de Administração e Finanças (ISAF). Apaixonada por liderança, voluntariado e trabalho em equipa, destaco-me pelo meu envolvimento activo em diversas iniciativas e projectos juvenis.\n\nSou Presidente da Comunidade Nexus, Roteirista oficial e responsável pelas Relações Exteriores do podcast Palco Universitário, Coordenadora auxiliar da Comunidade Estudante Blindado e Responsável pela área financeira do movimento ASG Conexão Mulheres.\n\nNo âmbito profissional, exerço funções como navegadora no Banco BAI, conciliando esta actividade com o meu espírito empreendedor no sector dos cosméticos.",
    mission: "Acredito que a fé, aliada a um forte sentido de propósito, constitui o alicerce para a minha superação diária e a concretização de objectivos.\n\n\"Integrei o Janelas para a Alma por me sentir genuinamente ligada à sua missão: levar cuidado e esperança a pessoas com estrabismo, um grupo frequentemente invisibilizado em Angola, e assim cumprir o propósito de fazer a diferença na vida de quem muito precisa, mas poucas vezes é percebido.\"",
    linkedin: "https://www.linkedin.com/in/k%C3%A1ssia-palmira-nunda-4a03b7308",
    email: "kc.nunda@gmail.com",
  },
];

const TeamSection = () => {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  return (
    <section id="equipa" className="py-20 md:py-28 bg-navy overflow-hidden">
      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            A Nossa Equipa
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-navy-foreground">
            As pessoas por trás da missão
          </h2>
          <p className="text-lg text-navy-foreground/70 max-w-2xl mx-auto">
            Jovens angolanos comprometidos com a inclusão visual e a
            sustentabilidade ambiental.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row w-full">
        {TEAM_MEMBERS.map((member, index) => {
          const isLight = index % 2 === 1;
          const [firstName, ...rest] = member.name.split(" ");
          const lastName = rest.join(" ");

          return (
            <div
              key={member.id}
              className={cn(
                "relative flex-1 min-w-0 min-h-[420px] md:min-h-[600px] flex flex-col justify-between overflow-hidden cursor-pointer transition-transform duration-300",
                isLight
                  ? "bg-white text-slate-900 md:-mx-6 md:z-10 md:hover:scale-[1.03] md:[clip-path:polygon(5%_0,_100%_3%,_95%_100%,_0_97%)]"
                  : "bg-transparent text-navy-foreground",
              )}
              onClick={() => setSelectedMember(member)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedMember(member);
                }
              }}
            >
              <div className="p-6 md:p-8">
                <h3 className="font-black text-2xl uppercase leading-none">
                  {firstName}
                  <br />
                  {lastName}
                </h3>
                <p className="font-light text-xs uppercase tracking-wider mt-2">
                  {member.role}
                </p>
              </div>
              <img
                src={member.image}
                alt={member.name}
                className="w-full object-cover object-bottom mt-auto"
                loading="eager"
              />
            </div>
          );
        })}
      </div>

      {/* Team Member Detail Modal */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-hidden p-0 gap-0 rounded-2xl border-border/50">
          {selectedMember && (
            <div className="flex flex-col md:flex-row max-h-[90vh]">
              {/* Left column: photo, name, role */}
              <div className="md:w-2/5 flex flex-col bg-gradient-to-br from-teal/10 to-teal/5 shrink-0">
                <img
                  src={selectedMember.image}
                  alt={selectedMember.name}
                  className="w-full h-64 md:h-auto md:flex-1 object-cover object-top"
                />
                <div className="text-center md:text-left p-6 space-y-2">
                  <DialogTitle className="text-2xl font-bold text-foreground">
                    {selectedMember.name}
                  </DialogTitle>
                  <span className="inline-block text-sm font-semibold text-teal bg-teal/10 px-4 py-1.5 rounded-full">
                    {selectedMember.role}
                  </span>
                </div>
              </div>

              {/* Right column: bio, mission, contact */}
              <div className="md:w-3/5 overflow-y-auto p-6 sm:p-8 space-y-6">
                {/* Bio */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold tracking-widest uppercase text-teal">
                    Sobre Mim
                  </h4>
                  <div className="text-muted-foreground leading-relaxed space-y-3">
                    {selectedMember.bio.split("\n\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </div>

                {/* Mission */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold tracking-widest uppercase text-teal">
                    A Minha Missão
                  </h4>
                  <blockquote className="border-l-4 border-teal/40 bg-teal/5 rounded-r-lg px-5 py-4 italic text-foreground/90 leading-relaxed space-y-3">
                    {selectedMember.mission.split("\n\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </blockquote>
                </div>

                {/* Social Links */}
                <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                  {selectedMember.linkedin && (
                    <a
                      href={selectedMember.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(210,80%,40%)] text-white text-sm font-medium hover:bg-[hsl(210,80%,35%)] transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  )}
                  <a
                    href={`mailto:${selectedMember.email}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-accent transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default TeamSection;

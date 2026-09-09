import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Linkedin, Mail, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import teamDalva from "@/assets/team-dalva.png";
import teamManuel from "@/assets/team-manuel.png";
import teamLukeny from "@/assets/team-lukeny.jpg";
import teamPedro from "@/assets/team-pedro.jpg";
import teamKassia from "@/assets/team-kassia.png";

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
    description: "Impulsionando a visão da Janelas para a Alma.",
    image: teamDalva,
    bio: "Sou estudante do terceiro ano do curso de Contabilidade e Finanças no ISAF e bolseira de mérito da Fundação BAI. Natural de Benguela, desenvolvo-me activamente em iniciativas ligadas à educação financeira, liderança juvenil e mercado de capitais.\n\nFaço parte da coordenação do Clube de Finanças do ISAF e desempenho funções de liderança em diversos projectos estudantis e associativos. Paralelamente, sou investidora e tenho interesse em contribuir para a inclusão financeira e o desenvolvimento social.",
    mission: "O que me move neste projecto é a vontade de dar voz e visibilidade a realidades que muitas vezes passam despercebidas, promovendo empatia, inclusão e consciência social. Acredito que pequenas acções podem gerar grandes mudanças, e este projecto é a minha forma de contribuir para uma sociedade mais humana e atenta às diferenças.\n\n\"O 'Janelas para a Alma' nasceu da necessidade de dar visibilidade ao que muitas vezes é ignorado porque compreender o outro também é uma forma de transformar o mundo.\"",
    linkedin: "https://www.linkedin.com/in/dalva-filipe-b7523129b",
    email: "dalvafilipe182@gmail.com",
  },
  {
    id: 2,
    name: "Manuel Francisco",
    role: "Director de Relações Públicas",
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
    role: "Especialista em Comunicação e Marketing",
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
    role: "Responsável pela Legalização e Logística",
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
    role: "Líder em Parcerias e Estratégia",
    description: "Construindo alianças e definindo o rumo do nosso crescimento.",
    image: teamKassia,
    bio: "Sou uma jovem cristã de 22 anos, estudante do 3.º ano da Licenciatura em Contabilidade e Finanças no Instituto Superior de Administração e Finanças (ISAF). Apaixonada por liderança, voluntariado e trabalho em equipa, destaco-me pelo meu envolvimento activo em diversas iniciativas e projectos juvenis.\n\nSou Presidente da Comunidade Nexus, Roteirista oficial e responsável pelas Relações Exteriores do podcast Palco Universitário, Coordenadora auxiliar da Comunidade Estudante Blindado e Responsável pela área financeira do movimento ASG Conexão Mulheres.\n\nNo âmbito profissional, exerço funções como navegadora no Banco BAI, conciliando esta actividade com o meu espírito empreendedor no sector dos cosméticos.",
    mission: "Acredito que a fé, aliada a um forte sentido de propósito, constitui o alicerce para a minha superação diária e a concretização de objectivos.\n\n\"Integrei o Janelas para a Alma por me sentir genuinamente ligada à sua missão: levar cuidado e esperança a pessoas com estrabismo, um grupo frequentemente invisibilizado em Angola, e assim cumprir o propósito de fazer a diferença na vida de quem muito precisa, mas poucas vezes é percebido.\"",
    linkedin: "https://www.linkedin.com/in/k%C3%A1ssia-palmira-nunda-4a03b7308",
    email: "kc.nunda@gmail.com",
  },
];

const TeamSection = () => {
  const [current, setCurrent] = useState(0);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const totalMembers = TEAM_MEMBERS.length;

  useEffect(() => {
    TEAM_MEMBERS.forEach((member) => {
      const img = new Image();
      img.src = member.image;
    });
  }, []);

  const navigate = useCallback((dir: "left" | "right") => {
    setCurrent((prev) =>
      dir === "right"
        ? (prev + 1) % totalMembers
        : (prev - 1 + totalMembers) % totalMembers
    );
  }, [totalMembers]);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  return (
    <section id="equipa" className="py-20 md:py-28 bg-background">
      <div className="hidden" aria-hidden="true">
        {TEAM_MEMBERS.map((member) => (
          <img key={member.id} src={member.image} alt="" />
        ))}
      </div>

      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            A Nossa Equipa
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">
            As pessoas por trás da missão
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Jovens angolanos comprometidos com a inclusão visual e a
            sustentabilidade ambiental.
          </p>
        </div>

        <div className="relative flex flex-col items-center group/carousel">
          <div className="relative w-full max-w-sm mx-auto">
            <button
              onClick={() => navigate("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-12 md:-translate-x-16 z-10 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-card/90 shadow-elevated border border-border/50 flex items-center justify-center text-muted-foreground hover:text-teal transition-all duration-300 opacity-0 group-hover/carousel:opacity-100"
              aria-label="Membro anterior"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button
              onClick={() => navigate("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-12 md:translate-x-16 z-10 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-card/90 shadow-elevated border border-border/50 flex items-center justify-center text-muted-foreground hover:text-teal transition-all duration-300 opacity-0 group-hover/carousel:opacity-100"
              aria-label="Próximo membro"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <div className="overflow-hidden rounded-2xl">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{
                  width: `${totalMembers * 100}%`,
                  transform: `translateX(-${(current * 100) / totalMembers}%)`,
                }}
              >
                {TEAM_MEMBERS.map((member) => (
                  <div
                    key={member.id}
                    className="flex-shrink-0"
                    style={{ width: `${100 / totalMembers}%` }}
                  >
                    <div
                      className="rounded-2xl bg-card shadow-card border border-border/50 text-center overflow-hidden cursor-pointer group/card transition-shadow duration-300 hover:shadow-elevated"
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
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-72 md:h-80 object-cover object-top rounded-t-xl"
                        loading="eager"
                      />
                      <div className="p-6 space-y-3">
                        <h3 className="text-xl font-bold text-foreground">
                          {member.name}
                        </h3>
                        <span className="inline-block text-sm font-medium text-teal bg-teal/10 px-3 py-1 rounded-full">
                          {member.role}
                        </span>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {member.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-8">
            {TEAM_MEMBERS.map((member, index) => (
              <button
                key={member.id}
                onClick={() => goTo(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === current
                    ? "bg-teal scale-125"
                    : "bg-border hover:bg-muted-foreground"
                }`}
                aria-label={`Ver membro ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Team Member Detail Modal */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border/50">
          <DialogTitle className="sr-only">
            {selectedMember?.name} — {selectedMember?.role}
          </DialogTitle>

          {selectedMember && (
            <div className="flex flex-col">
              {/* Header with photo and identity */}
              <div className="relative bg-gradient-to-br from-teal/10 to-teal/5 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <img
                    src={selectedMember.image}
                    alt={selectedMember.name}
                    className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl object-cover object-top shadow-elevated border-2 border-background flex-shrink-0"
                  />
                  <div className="text-center sm:text-left space-y-2 pt-1">
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {selectedMember.name}
                    </h3>
                    <span className="inline-block text-sm font-semibold text-teal bg-teal/10 px-4 py-1.5 rounded-full">
                      {selectedMember.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 sm:p-8 space-y-6 pb-16">
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
                <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
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

import { useState } from "react";
import { Linkedin, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import teamDalva from "@/assets/team-dalva.png";
import teamManuel from "@/assets/team-manuel.png";
import teamLukeny from "@/assets/team-lukeny.png";
import teamPedro from "@/assets/team-pedro.png";
import teamKassia from "@/assets/team-kassia.webp";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

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
    get name() {
      return i18n.t("TeamSection.dalvaFilipe");
    },
    get role() {
      return i18n.t("TeamSection.coordenacaoGeral");
    },
    get description() {
      return i18n.t("TeamSection.impulsionandoAVisaoDo");
    },
    image: teamDalva,
    get bio() {
      return i18n.t("TeamSection.souEstudanteDoTerceiro");
    },
    get mission() {
      return i18n.t("TeamSection.oQueMeMove");
    },
    linkedin: "https://www.linkedin.com/in/dalva-filipe-b7523129b",
    email: "dalvafilipe182@gmail.com",
  },
  {
    id: 2,
    get name() {
      return i18n.t("TeamSection.manuelFrancisco");
    },
    get role() {
      return i18n.t("TeamSection.directorFinanceiro");
    },
    get description() {
      return i18n.t("TeamSection.investigadorELiderJovem");
    },
    image: teamManuel,
    get bio() {
      return i18n.t("TeamSection.souEstudanteUniversitarioDe");
    },
    get mission() {
      return i18n.t("TeamSection.acreditoQueAEducacao");
    },
    linkedin: "https://www.linkedin.com/in/manuel-francisco-050428327",
    email: "manuelfrancisco.profissional@gmail.com",
  },
  {
    id: 3,
    get name() {
      return i18n.t("TeamSection.lukenyViegas");
    },
    get role() {
      return i18n.t("TeamSection.directorDeTi");
    },
    get description() {
      return i18n.t("TeamSection.amplificandoANossaMensagem");
    },
    image: teamLukeny,
    get bio() {
      return i18n.t("TeamSection.estudanteUniversitarioNaturalDe");
    },
    get mission() {
      return i18n.t("TeamSection.oForteDesejoDe");
    },
    linkedin: "https://www.linkedin.com/in/lukeny-viegas-4524a5356",
    email: "lukenyviegas1@gmail.com",
  },
  {
    id: 4,
    get name() {
      return i18n.t("TeamSection.pedroSapalo");
    },
    get role() {
      return i18n.t("TeamSection.directorDeLegalizacaoE");
    },
    get description() {
      return i18n.t("TeamSection.garantindoAConformidadeE");
    },
    image: teamPedro,
    get bio() {
      return i18n.t("TeamSection.souEstudanteUniversitarioCom");
    },
    get mission() {
      return i18n.t("TeamSection.oQueMeInspira");
    },
    linkedin: "https://www.linkedin.com/in/pedrosapalo",
    email: "sapalop15@gmail.com",
  },
  {
    id: 5,
    get name() {
      return i18n.t("TeamSection.kassiaNunda");
    },
    get role() {
      return i18n.t("TeamSection.directoraDeComunicacaoE");
    },
    get description() {
      return i18n.t("TeamSection.construindoAliancasEDefinindo");
    },
    image: teamKassia,
    get bio() {
      return i18n.t("TeamSection.souUmaJovemCrista");
    },
    get mission() {
      return i18n.t("TeamSection.acreditoQueAFe");
    },
    linkedin: "https://www.linkedin.com/in/k%C3%A1ssia-palmira-nunda-4a03b7308",
    email: "kc.nunda@gmail.com",
  },
];

const TeamSection = () => {
  const { t } = useTranslation();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  return (
    <section id="equipa" className="py-20 md:py-28 bg-slate-50">
      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            {t("TeamSection.aNossaEquipa")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
            {t("TeamSection.asPessoasPorTras")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("TeamSection.jovensAngolanosComprometidosCom")}
          </p>
        </div>

        <div className="flex flex-row flex-nowrap overflow-x-auto overflow-y-hidden gap-6 pb-8 px-4 snap-x snap-mandatory">
          {TEAM_MEMBERS.map((member) => (
            <div
              key={member.id}
              className="snap-center shrink-0 bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col w-[220px] hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 cursor-pointer"
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
              <div className="bg-white">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-[280px] object-contain object-bottom pt-8"
                  loading="eager"
                />
              </div>
              <div className="p-6 flex flex-col items-center text-center bg-white">
                <h3 className="text-lg font-bold text-slate-900">
                  {member.name}
                </h3>
                <span className="inline-block text-[11px] font-semibold text-teal bg-teal/10 uppercase tracking-wider leading-tight px-2 py-1 rounded-full mt-2">
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
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
                    {t("TeamSection.sobreMim")}
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
                    {t("TeamSection.aMinhaMissao")}
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
                    {t("TeamSection.email")}
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

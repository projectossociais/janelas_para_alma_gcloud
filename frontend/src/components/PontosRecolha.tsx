import { Clock, MapPin, User } from "lucide-react";
import i18n from "@/i18n";

interface PontoRecolha {
  id: string;
  nome: string;
  responsavel: string;
  morada: string;
  horario: string[];
}

const pontosRecolha: PontoRecolha[] = [
  {
    id: "luanda-centro",
    get nome() {
      return i18n.t("PontosRecolha.luandaCentro");
    },
    get responsavel() {
      return i18n.t("PontosRecolha.dalvaFilipe");
    },
    get morada() {
      return i18n.t("PontosRecolha.ingombotasRuaDoAssalto");
    },
    get horario() {
      return [i18n.t("PontosRecolha.segASex8h"), i18n.t("PontosRecolha.sabEDom10h")];
    },
  },
  {
    id: "luanda-sul",
    get nome() {
      return i18n.t("PontosRecolha.luandaSul");
    },
    get responsavel() {
      return i18n.t("PontosRecolha.kassiaNunda");
    },
    get morada() {
      return i18n.t("PontosRecolha.benficaZonaVerdeCondominio");
    },
    get horario() {
      return [i18n.t("PontosRecolha.segASex12h")];
    },
  },
];

/** Lista os pontos onde um doador pode entregar materiais pessoalmente. */
const PontosRecolha = () => (
  <div className="space-y-3">
    {pontosRecolha.map((ponto) => (
      <div key={ponto.id} className="rounded-xl border border-teal/20 bg-teal/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal text-teal-foreground">
            <MapPin className="h-4 w-4" />
          </span>
          <h4 className="font-bold text-foreground">{ponto.nome}</h4>
        </div>
        <dl className="space-y-1.5 pl-10 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
            <span>{ponto.responsavel}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
            <span>{ponto.morada}</span>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
            <div className="space-y-0.5">
              {ponto.horario.map((linha) => (
                <p key={linha}>{linha}</p>
              ))}
            </div>
          </div>
        </dl>
      </div>
    ))}
  </div>
);

export default PontosRecolha;

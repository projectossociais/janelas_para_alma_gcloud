import { Clock, MapPin, User } from "lucide-react";

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
    nome: "Luanda Centro",
    responsavel: "Dalva Filipe",
    morada:
      "Ingombotas, Rua do assalto ao quartel da Moncada, perto do edifício da Planad",
    horario: ["Seg – Sex: 8h – 12h", "Sáb – Dom: 10h – 16h"],
  },
  {
    id: "luanda-sul",
    nome: "Luanda Sul",
    responsavel: "Kássia Nunda",
    morada: "Benfica / Zona Verde / Condomínio Villa Israel",
    horario: ["Seg – Sex: 12h – 16h"],
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

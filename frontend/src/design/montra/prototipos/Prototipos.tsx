import { useParams } from "react-router-dom";
import { ProvedorMovimento } from "../../ProvedorMovimento";
import { useTema } from "../../useTema";
import { PrototipoEntrada } from "./PrototipoEntrada";
import { PrototipoSite } from "./PrototipoSite";
import { PrototipoTarefa } from "./PrototipoTarefa";

/**
 * Protótipos dos arquétipos de página à escala real (docs/LAYOUTS.md), só em
 * desenvolvimento: /_montra/prototipos/site (e, a seguir, entrar, tarefa, app).
 * O tema segue a escolha feita na montra.
 */
const Prototipos = () => {
  const { qual } = useParams();
  const { efectivo } = useTema();
  return (
    <ProvedorMovimento>
      {qual === "site" ? (
        <PrototipoSite tema={efectivo} />
      ) : qual === "entrar" ? (
        <PrototipoEntrada />
      ) : qual === "tarefa" ? (
        <PrototipoTarefa tema={efectivo} />
      ) : (
        <p className="p-8 text-corpo">Protótipo desconhecido.</p>
      )}
    </ProvedorMovimento>
  );
};

export default Prototipos;

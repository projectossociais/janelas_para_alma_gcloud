import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Glasses } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { escolhaAleatoria } from "@/lib/visao/escada";

const LETRAS = ["E", "H", "K", "N", "P", "T", "X", "Z"];
const VERMELHO = "#ff0000";
const CIANO = "#00ffff";

/** Verificação dos óculos: cada olho só deve ver uma das letras. */
const VerificarOculos = ({ aoContinuar }: { aoContinuar: (ok: boolean) => void }) => {
  const { t } = useTranslation();
  const [letras, setLetras] = useState(() => {
    const a = escolhaAleatoria(LETRAS.length, null);
    return { vermelha: LETRAS[a], ciano: LETRAS[escolhaAleatoria(LETRAS.length, a)] };
  });
  const [fase, setFase] = useState<"esquerdo" | "direito" | "falhou">("esquerdo");
  const [certas, setCertas] = useState(0);
  const opcoes = useMemo(() => {
    const extra = LETRAS.filter((l) => l !== letras.vermelha && l !== letras.ciano).slice(0, 2);
    return [letras.vermelha, letras.ciano, ...extra].sort();
  }, [letras]);

  // Filtro vermelho no olho esquerdo: vê a letra ciano (escura) e não a vermelha.
  const responder = (letra: string | null) => {
    const certa = fase === "esquerdo" ? letras.ciano : letras.vermelha;
    const n = certas + (letra === certa ? 1 : 0);
    if (fase === "esquerdo") {
      setCertas(n);
      setFase("direito");
    } else if (n === 2) {
      aoContinuar(true);
    } else {
      setFase("falhou");
    }
  };

  if (fase === "falhou")
    return (
      <EcraPasso
        icone={<Glasses className="h-7 w-7" />}
        titulo={t("Visao.oculosVCFalhouTitulo")}
        accao={
          <>
            <BotaoContinuar
              aoClicar={() => {
                const a = escolhaAleatoria(LETRAS.length, null);
                setLetras({ vermelha: LETRAS[a], ciano: LETRAS[escolhaAleatoria(LETRAS.length, a)] });
                setCertas(0);
                setFase("esquerdo");
              }}
            >
              {t("Visao.tentarDeNovo")}
            </BotaoContinuar>
            <Button variant="ghost" onClick={() => aoContinuar(false)}>
              {t("Visao.continuarMesmoAssim")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t("Visao.oculosVCFalhouTexto")}</p>
      </EcraPasso>
    );

  return (
    <EcraPasso icone={<Glasses className="h-7 w-7" />} titulo={t("Visao.oculosVCTitulo")}>
      <p className="text-sm text-muted-foreground">{t("Visao.oculosVCTexto")}</p>
      <PalcoVisual className="min-h-[140px] gap-10" rotulo={t("Visao.rotuloLetrasOculos")}>
        <span style={{ color: VERMELHO, fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{letras.vermelha}</span>
        <span style={{ color: CIANO, fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{letras.ciano}</span>
      </PalcoVisual>
      <p className="font-semibold text-foreground" aria-live="polite">
        {fase === "esquerdo" ? t("Visao.oculosVCFecheDireito") : t("Visao.oculosVCFecheEsquerdo")}
      </p>
      <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-5">
        {opcoes.map((l) => (
          <Button key={`${fase}-${l}`} size="lg" variant="outline" className="text-xl font-bold" onClick={() => responder(l)}>
            {l}
          </Button>
        ))}
        <Button size="lg" variant="outline" className="col-span-3 sm:col-span-1" onClick={() => responder(null)}>
          {t("Visao.vejoAsDuas")}
        </Button>
      </div>
    </EcraPasso>
  );
};

export default VerificarOculos;

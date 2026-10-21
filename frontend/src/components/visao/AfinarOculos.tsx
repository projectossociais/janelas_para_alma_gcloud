import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Glasses } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import { FUGA_MAX, coresAnulacao, guardarAfinacao, lerAfinacao, type Afinacao, type Rgb } from "@/lib/visao/anaglifo";
import type { Olho } from "@/lib/visao/resultados";

const PASSO_CURSOR = 0.005;
const css = (c: Rgb) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/**
 * Um olho de cada vez: fundo cinzento e um quadrado que esse olho deixa de ver
 * quando o cursor iguala a fuga do seu filtro (ver `lib/visao/anaglifo.ts`).
 * Cores fixas, não do tema -- fazem parte da medição.
 */
const AnularOlho = ({ olho, aoTerminar }: { olho: Olho; aoTerminar: (fuga: number) => void }) => {
  const { t } = useTranslation();
  const [fuga, setFuga] = useState(0);
  const { fundo, quadrado } = coresAnulacao(olho, fuga);
  const direito = olho === "direito";
  return (
    <EcraPasso
      icone={<Glasses className="h-7 w-7" />}
      titulo={direito ? t("Visao.afinarDireitoTitulo") : t("Visao.afinarEsquerdoTitulo")}
      accao={<BotaoContinuar aoClicar={() => aoTerminar(fuga)} />}
    >
      <p className="text-sm text-muted-foreground">
        {direito ? t("Visao.afinarDireitoTexto") : t("Visao.afinarEsquerdoTexto")}
      </p>
      <div
        role="img"
        aria-label={t("Visao.afinarRotuloQuadrado")}
        className="flex h-48 w-full items-center justify-center rounded-xl border border-border"
        style={{ backgroundColor: css(fundo), colorScheme: "light" }}
      >
        <div className="h-24 w-24 rounded-md" style={{ backgroundColor: css(quadrado) }} />
      </div>
      <div className="w-full max-w-sm space-y-2">
        <Slider
          value={[fuga]}
          min={0}
          max={FUGA_MAX}
          step={PASSO_CURSOR}
          onValueChange={([v]) => setFuga(v)}
          aria-label={t("Visao.afinarCursor")}
        />
        <p className="text-xs text-muted-foreground">{t("Visao.afinarDica")}</p>
      </div>
    </EcraPasso>
  );
};

/**
 * Régua Invisível, passo dos óculos: mede a fuga de cor de cada filtro neste
 * ecrã, para os estímulos dicópticos a descontarem. Fica guardada neste
 * aparelho; da vez seguinte, um só ecrã a perguntar se são os mesmos óculos.
 * `aoContinuar(null)` = sem afinação (desenha-se como antes).
 */
const AfinarOculos = ({ aoContinuar }: { aoContinuar: (af: Afinacao | null) => void }) => {
  const { t } = useTranslation();
  const [guardada] = useState(() => lerAfinacao());
  const [fase, setFase] = useState<"guardada" | "direito" | "esquerdo">(guardada ? "guardada" : "direito");
  const [fugaNoCiano, setFugaNoCiano] = useState(0);

  if (fase === "guardada" && guardada)
    return (
      <EcraPasso
        icone={<Glasses className="h-7 w-7" />}
        titulo={t("Visao.afinarGuardadaTitulo")}
        accao={
          <>
            <BotaoContinuar aoClicar={() => aoContinuar(guardada)} />
            <Button variant="ghost" onClick={() => setFase("direito")}>
              {t("Visao.afinarDeNovo")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t("Visao.afinarGuardadaTexto")}</p>
      </EcraPasso>
    );

  if (fase === "direito")
    return (
      <div className="flex flex-col items-center gap-2">
        <AnularOlho
          key="direito"
          olho="direito"
          aoTerminar={(fuga) => {
            setFugaNoCiano(fuga);
            setFase("esquerdo");
          }}
        />
        <Button variant="ghost" onClick={() => aoContinuar(null)}>
          {t("Visao.afinarSaltar")}
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-2">
      <AnularOlho
        key="esquerdo"
        olho="esquerdo"
        aoTerminar={(fugaNoVermelho) => {
          const af: Afinacao = { fugaNoVermelho, fugaNoCiano };
          guardarAfinacao(af);
          aoContinuar(af);
        }}
      />
      <Button variant="ghost" onClick={() => aoContinuar(null)}>
        {t("Visao.afinarSaltar")}
      </Button>
    </div>
  );
};

export default AfinarOculos;

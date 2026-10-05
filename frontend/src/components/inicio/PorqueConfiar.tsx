import { useTranslation } from "react-i18next";
import { ArrowRight, Check } from "lucide-react";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/design/cn";
import { Contentor } from "@/design/layouts/Contentor";
import { Ligacao } from "@/design/Ligacao";
import { Carrossel } from "@/design/componentes/Carrossel";
// Recorte de retrato (cabeça e ombros): a fotografia inteira é de corpo inteiro
// e, num círculo, mostrava só o tronco e as mãos.
import fotoDalva from "@/assets/team-dalva-retrato.jpg";
import logoDesafioGenial from "@/assets/partner-desafio-genial-logo.png";
import logoUnicef from "@/assets/partner-unicef-logo.jpg";
import logoArotec from "@/assets/partner-arotec-logo.png";
import logoOptioptika from "@/assets/partner-optioptika-logo.jpg";
import logoNelt from "@/assets/partner-nelt-group-logo.png";

/**
 * "Posso confiar?" (ESTRUTURA_SITE §5, secção 5): uma faixa marinho a toda a
 * largura com a voz e o rosto de uma pessoa real da equipa, a preto e branco
 * como pede o manual da marca (docs/MARCA.md §1, pág. 2), e factos que se
 * podem verificar. Nada de testemunhos de banco de imagens.
 */
const FACTOS = ["Inicio.confiarFacto1", "Inicio.confiarFacto2", "Inicio.confiarFacto3"] as const;

// Os mesmos parceiros e ligações que o site mostrava (ParceirosSection antiga).
// `fundoClaro`: logótipos desenhados para fundo branco levam um fundo branco.
// O Desafio Genial é o programa da UNICEF Angola com a Arotec.
const PARCEIROS = [
  { nome: "Inicio.parceiroDesafioGenial", logo: logoDesafioGenial, fundoClaro: false, url: "https://www.unicef.org/angola/desafio-genial-gera%C3%A7%C3%A3o-digital" },
  { nome: "Inicio.parceiroUnicef", logo: logoUnicef, fundoClaro: true, url: "https://www.unicef.org/" },
  { nome: "Inicio.parceiroArotec", logo: logoArotec, fundoClaro: true, url: "https://www.arotec.ao/programas/desafio-genial" },
  { nome: "Inicio.parceiroOptioptika", logo: logoOptioptika, fundoClaro: true, url: "https://www.optioptika.com/" },
  { nome: "Inicio.parceiroNelt", logo: logoNelt, fundoClaro: false, url: "https://www.nelt.com/en/markets/angola/" },
] as const;

export const PorqueConfiar = () => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="inicio-confiar" className="tema-escuro bg-superficie py-16 text-tinta lg:py-24">
      <Contentor className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
        <figure className="flex flex-col gap-8 sm:flex-row sm:items-center lg:col-span-7">
          <img
            src={fotoDalva}
            alt=""
            width={128}
            height={128}
            loading="lazy"
            decoding="async"
            className="size-28 shrink-0 rounded-pilula object-cover grayscale sm:size-32"
          />
          <div>
            <h2 id="inicio-confiar" className="text-legenda font-medium uppercase tracking-wide text-accao">
              {t("Inicio.confiarRotulo")}
            </h2>
            <blockquote className="mt-4">
              <p className="text-titulo-p text-tinta sm:text-titulo-m">“{t("Inicio.confiarCitacao")}”</p>
            </blockquote>
            <figcaption className="mt-4 text-corpo text-tinta-suave">{t("Inicio.confiarAutor")}</figcaption>
          </div>
        </figure>
        <div className="lg:col-span-4 lg:col-start-9">
          <ul className="flex flex-col gap-5">
            {FACTOS.map((f) => (
              <li key={f} className="flex gap-3 text-corpo text-tinta">
                <Check className="mt-1 size-5 shrink-0 text-acento" aria-hidden />
                {t(f)}
              </li>
            ))}
          </ul>
          <Ligacao
            href={localizar("/equipa")}
            className="mt-8 inline-flex min-h-alvo-app items-center gap-2 rounded-controlo font-medium text-accao underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            {t("Inicio.confiarEquipa")} <ArrowRight className="size-5" aria-hidden />
          </Ligacao>
        </div>

        <div className="min-w-0 border-t border-linha pt-10 lg:col-span-12">
          <h3 className="text-legenda font-medium uppercase tracking-wide text-tinta-suave">{t("Inicio.parceirosRotulo")}</h3>
          {/* Cartões todos do mesmo tamanho, logótipo centrado; no telemóvel passam
              num carrossel (decisão do dono do projecto, 2026-10-05), no computador
              cabem todos e ficam parados. */}
          <Carrossel
            className="mt-6"
            rotulo={t("Inicio.parceirosRotulo")}
            textos={{
              anterior: t("Inicio.parceirosAnterior"),
              seguinte: t("Inicio.parceirosSeguinte"),
              parar: t("Inicio.parceirosParar"),
              retomar: t("Inicio.parceirosRetomar"),
            }}
            itens={PARCEIROS.map((p) => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex h-24 w-40 items-center justify-center rounded-controlo border border-linha px-4",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
                  p.fundoClaro && "bg-white",
                )}
              >
                <img src={p.logo} alt={t(p.nome)} loading="lazy" decoding="async" className="max-h-14 max-w-full object-contain" />
              </a>
            ))}
          />
        </div>
      </Contentor>
    </section>
  );
};

import { Instagram, Facebook, Linkedin, MapPin, Phone, Mail, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { IDIOMA_EN, IDIOMA_PT, inglesAtivo } from "@/i18n/idiomas";
import { caminhoNoIdioma } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import LogoMarca from "@/components/marca/LogoMarca";
import { localizar } from "@/i18n/rotas";

/**
 * Botão único de idioma: "EN" no site português, "PT" no inglês. Leva à mesma
 * página no outro idioma (ver `src/i18n/rotas.ts`). Só existe com
 * VITE_ENABLE_EN=true.
 */
const AlternarIdioma = () => {
  const { t } = useTranslation();
  const { pathname, search, hash } = useLocation();
  const destino = useIdioma() === IDIOMA_PT ? IDIOMA_EN : IDIOMA_PT;

  return (
    <Link
      to={caminhoNoIdioma(pathname + search + hash, destino)}
      hrefLang={destino}
      lang={destino === IDIOMA_EN ? "en" : "pt"}
      aria-label={t("idioma.alternarRotulo")}
      className="font-medium transition-colors hover:text-marca-marfim"
    >
      {t("idioma.alternar")}
    </Link>
  );
};

const REDES = [
  {
    nome: "Instagram",
    href: "https://www.instagram.com/janelas_para_alma?igsh=MTI5eXFxa3M0a3FpbA==",
    icone: Instagram,
  },
  { nome: "Facebook", href: "https://www.facebook.com", icone: Facebook },
  { nome: "LinkedIn", href: "https://www.linkedin.com", icone: Linkedin },
] as const;

/** G. Rodapé institucional escuro: marca, nota legal, redes, contactos e links rápidos. */
const Footer = () => {
  const { t } = useTranslation();
  const linksRapidos = [
    { label: t("Footer.inicio"), to: localizar("/") },
    { label: t("Cabecalho.aNossaEquipa"), to: localizar("/equipa") },
    { label: t("Cabecalho.cienciaTerapia"), to: localizar("/exercicios") },
    { label: t("Footer.scannerDeEstrabismo"), to: localizar("/scanner") },
    { label: t("Cabecalho.clinicasParceiras"), to: localizar("/parceiros") },
    { label: t("Cabecalho.blog"), to: localizar("/publicacoes") },
  ];
  const apoiar = [
    { label: t("Cabecalho.doarUmaVez"), to: localizar("/apoiar?modo=unica") },
    { label: t("Cabecalho.doarMensalmente"), to: localizar("/apoiar?modo=mensal") },
    { label: t("Cabecalho.voluntario"), to: localizar("/kamba#voluntariado") },
    { label: t("Footer.doacaoDeOculos"), to: localizar("/circular") },
  ];

  return (
    <footer className="bg-marca-marinho text-marca-marfim/85">
      <div className="container py-14 md:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-12">
          <div className="flex flex-col gap-5">
            <Link to={localizar("/")} className="flex items-center gap-2" aria-label={t("Cabecalho.irParaInicio")}>
              <LogoMarca variante="escuro" className="h-10 w-auto" />
              <span className="flex flex-col text-[15px] font-bold uppercase leading-[1.1] tracking-[0.12em] text-marca-marfim">
                <span>Janelas Para</span>
                <span>a Alma</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-marca-marfim/70">{t("Footer.umaInstituicaoAngolanaQue")}</p>
            <p className="text-xs leading-relaxed text-marca-marinho/60">{t("Footer.notaLegal")}</p>
            <div className="flex items-center gap-3">
              {REDES.map(({ nome, href, icone: Icone }) => (
                <a
                  key={nome}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={nome}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-marca-marfim/15 text-marca-marfim/85 transition-colors hover:border-marca-turquesa hover:bg-marca-turquesa hover:text-marca-marfim"
                >
                  <Icone className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-marca-marfim">{t("Footer.linksRapidos")}</h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {linksRapidos.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition-colors hover:text-marca-ouro">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-marca-marfim">{t("Cabecalho.formasDeApoiar")}</h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {apoiar.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="group inline-flex items-center gap-1.5 transition-colors hover:text-marca-ouro">
                    <ChevronRight className="h-3.5 w-3.5 text-marca-turquesa transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-marca-marfim">{t("Footer.contactos")}</h3>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Luanda%2C+Angola"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 transition-colors hover:text-marca-ouro"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-marca-turquesa" />
                  <span>{t("Footer.luandaAngola")}</span>
                </a>
              </li>
              <li>
                <a href="tel:+244926969819" className="flex items-start gap-3 transition-colors hover:text-marca-ouro">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-marca-turquesa" />
                  <span>+244 926 969 819</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:janelasparaalma18@gmail.com"
                  className="flex items-start gap-3 break-all transition-colors hover:text-marca-ouro"
                >
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-marca-turquesa" />
                  <span>janelasparaalma18@gmail.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-marca-marfim/15">
        <div className="container flex flex-col items-center justify-between gap-3 py-5 text-xs text-marca-marinho/60 sm:flex-row">
          <p><Trans i18nKey="Footer.janelasParaAAlma" values={{ valor: new Date().getFullYear() }} /></p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            {inglesAtivo() && <AlternarIdioma />}
            <Link to={localizar("/politica-de-privacidade")} className="transition-colors hover:text-marca-marfim">
              {t("Footer.politicaDePrivacidade")}
            </Link>
            <Link to={localizar("/termos-de-utilizacao")} className="transition-colors hover:text-marca-marfim">
              {t("Footer.termosDeUtilizacao")}
            </Link>
            <Link to={localizar("/faq")} className="transition-colors hover:text-marca-marfim">
              {t("Footer.faq")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

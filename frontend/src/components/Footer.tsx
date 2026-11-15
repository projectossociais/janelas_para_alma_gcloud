import { Instagram, Facebook, Linkedin, Youtube, MapPin, Phone, Mail, ChevronRight } from "lucide-react";
import type { ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { IDIOMA_EN, IDIOMA_PT, inglesAtivo } from "@/i18n/idiomas";
import { caminhoNoIdioma } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import logoIcon from "@/assets/logo-icon.png";
import { localizar } from "@/i18n/rotas";

/** Ícone do WhatsApp (Simple Icons, CC0): o lucide-react não tem marcas. */
const IconeWhatsApp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

/** Redes sociais do rodapé (YouTube e canal do WhatsApp pedidos pela coordenação, 2026-11-10). */
const REDES_SOCIAIS: readonly { nome: string; href: string; Icone: ComponentType<{ className?: string }> }[] = [
  { nome: "Instagram", href: "https://www.instagram.com/janelas_para_alma/", Icone: Instagram },
  { nome: "Facebook", href: "https://www.facebook.com", Icone: Facebook },
  { nome: "LinkedIn", href: "https://www.linkedin.com", Icone: Linkedin },
  { nome: "YouTube", href: "https://www.youtube.com/@JanelasParaaAlma", Icone: Youtube },
  { nome: "WhatsApp", href: "https://whatsapp.com/channel/0029VbCrusG6mYPRHF08dj33", Icone: IconeWhatsApp },
];

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
      className="font-medium hover:text-primary transition-colors"
    >
      {t("idioma.alternar")}
    </Link>
  );
};

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-slate-50 text-slate-700 border-t border-slate-200">
      <div className="container py-14 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Column 1: Brand & About */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-1.5">
              <img
                src={logoIcon}
                alt="Janelas Para a Alma"
                className="h-10 w-auto object-contain shrink-0"
              />
              <span className="font-bold text-base text-slate-900">
                Janelas Para a Alma
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 text-justify">
              {t("Footer.umaInstituicaoAngolanaQue")}
            </p>
            <div className="flex flex-nowrap items-center gap-1.5 pt-1">
              {REDES_SOCIAIS.map((rede) => (
                <a
                  key={rede.nome}
                  href={rede.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={rede.nome}
                  className="inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                >
                  <rede.Icone className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Links Rápidos */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-base text-slate-900">{t("Footer.linksRapidos")}</h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                { label: t("Footer.inicio"), to: localizar("/") },
                { label: t("Footer.sobreNos"), to: localizar("/impacto#sobre") },
                { label: t("Footer.doarAgora"), to: localizar("/apoiar?modo=unica#como-apoiar") },
                { label: t("Footer.contactos"), to: localizar("/junte-se#contacto") },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-slate-600 hover:text-primary hover:translate-x-0.5 inline-block transition-all"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Pilares */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-base text-slate-900">{t("Footer.nossosServicos")}</h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                { label: t("Footer.scannerDeEstrabismo"), to: localizar("/scanner") },
                { label: t("Footer.exerciciosVisuais"), to: localizar("/exercicios") },
                { label: t("Footer.inclusivamente"), to: localizar("/jogo-curiosidades") },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-1.5 text-slate-600 hover:text-primary transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contactos */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-base text-slate-900">{t("Footer.contactos")}</h3>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Luanda%2C+Angola"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-slate-600 hover:text-primary transition-colors"
                >
                  <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>{t("Footer.luandaAngola")}</span>
                </a>
              </li>

              <li>
                <a
                  href="tel:+244926969819"
                  className="flex items-start gap-3 text-slate-600 hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>+244 926 969 819</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:janelasparaalma18@gmail.com"
                  className="flex items-start gap-3 text-slate-600 hover:text-primary transition-colors break-all"
                >
                  <Mail className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>janelasparaalma18@gmail.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-200">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p><Trans i18nKey="Footer.janelasParaAAlma" values={{ valor: new Date().getFullYear() }} /></p>
          <div className="flex items-center gap-5">
            {inglesAtivo() && <AlternarIdioma />}
            <Link to={localizar("/politica-de-privacidade")} className="hover:text-primary transition-colors">
              {t("Footer.politicaDePrivacidade")}
            </Link>
            <Link to={localizar("/termos-de-utilizacao")} className="hover:text-primary transition-colors">
              {t("Footer.termosDeUtilizacao")}
            </Link>
            <Link to={localizar("/faq")} className="hover:text-primary transition-colors">
              {t("Footer.faq")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

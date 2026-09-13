import { Instagram, Facebook, Linkedin, MapPin, Phone, Mail, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import logoIcon from "@/assets/logo-icon.png";

const Footer = () => {
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
              Uma instituição angolana que promove a inclusão visual alinhada à
              economia circular e inovação tecnológica.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://www.instagram.com/janelas_para_alma?igsh=MTI5eXFxa3M0a3FpbA=="
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Links Rápidos */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-base text-slate-900">Links Rápidos</h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                { label: "Início", to: "/" },
                { label: "Sobre Nós", to: "/sobre" },
                { label: "Apoiar a Causa", to: "/apoiar" },
                { label: "Contactos", to: "/junte-se" },
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
            <h3 className="font-bold text-base text-slate-900">Nossos Serviços</h3>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                { label: "Scanner de Estrabismo", to: "/scanner" },
                { label: "Exercícios Visuais", to: "/exercicios" },
                { label: "Doação de Óculos", to: "/circular" },
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
            <h3 className="font-bold text-base text-slate-900">Contactos</h3>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Luanda%2C+Angola"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-slate-600 hover:text-primary transition-colors"
                >
                  <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>Luanda, Angola</span>
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
          <p>© {new Date().getFullYear()} Janelas Para a Alma. Todos os direitos reservados.</p>
          <div className="flex items-center gap-5">
            <Link to="/politicas" className="hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/politicas" className="hover:text-primary transition-colors">
              Termos de Utilização
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

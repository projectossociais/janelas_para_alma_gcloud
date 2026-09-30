import type { ReactNode } from "react";
import { cn } from "../cn";
import { Ligacao } from "../Ligacao";
import { Contentor } from "../layouts/Contentor";

/**
 * Rodapé do arquétipo Site (docs/ESTRUTURA_SITE.md §6).
 *
 * 1. **Faixa de contacto primeiro:** num serviço de saúde, poder falar com
 *    alguém é a maior prova de que há pessoas reais por trás.
 * 2. Três colunas (não cinco), abertas no telemóvel: nada escondido.
 * 3. O logótipo completo com assinatura (é onde há largura para ela se ler),
 *    o aviso clínico e as ligações legais.
 */
export interface Contacto {
  icone: ReactNode;
  rotulo: string;
  href: string;
}

export interface RodapeProps {
  ajuda: { titulo: string; texto?: string; contactos: Contacto[] };
  colunas: { titulo: string; ligacoes: { rotulo: string; href: string }[] }[];
  logotipo: ReactNode;
  local: string;
  avisoClinico: string;
  legais: { rotulo: string; href: string }[];
  direitos: string;
  idioma?: ReactNode;
  /** Nome acessível da navegação do rodapé. */
  rotuloNavegacao: string;
}

const estiloLigacao = cn(
  "rounded-controlo text-corpo text-tinta-suave underline-offset-4 transition-colors duration-feedback hover:text-tinta hover:underline",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
);

export const Rodape = ({
  ajuda,
  colunas,
  logotipo,
  local,
  avisoClinico,
  legais,
  direitos,
  idioma,
  rotuloNavegacao,
}: RodapeProps) => (
  <footer className="border-t border-linha bg-superficie">
    <div className="bg-superficie-alt">
      <Contentor className="flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-titulo-p text-tinta">{ajuda.titulo}</p>
          {ajuda.texto && <p className="mt-1 text-corpo text-tinta-suave">{ajuda.texto}</p>}
        </div>
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {ajuda.contactos.map((c) => (
            <li key={c.href}>
              <a
                href={c.href}
                className={cn(
                  "inline-flex min-h-alvo-app items-center gap-2 rounded-controlo text-corpo font-medium text-accao",
                  "underline-offset-4 hover:underline",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
                  "[&_svg]:size-5",
                )}
              >
                {c.icone}
                {c.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </Contentor>
    </div>

    <Contentor>
      <nav aria-label={rotuloNavegacao} className="grid gap-10 py-12 sm:grid-cols-3">
        {colunas.map((col) => (
          <div key={col.titulo}>
            <h2 className="text-corpo font-medium text-tinta">{col.titulo}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {col.ligacoes.map((l) => (
                <li key={l.href}>
                  <Ligacao href={l.href} className={estiloLigacao}>
                    {l.rotulo}
                  </Ligacao>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-6 border-t border-linha py-8 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <span className="block h-14 [&>img]:h-full [&>img]:w-auto">{logotipo}</span>
          <p className="text-legenda text-tinta-suave">{local}</p>
          <p className="max-w-md text-legenda text-tinta-suave">{avisoClinico}</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legais.map((l) => (
              <li key={l.href}>
                <Ligacao href={l.href} className={cn(estiloLigacao, "text-legenda")}>
                  {l.rotulo}
                </Ligacao>
              </li>
            ))}
          </ul>
          {idioma}
          <p className="text-legenda text-tinta-suave">{direitos}</p>
        </div>
      </div>
    </Contentor>
  </footer>
);

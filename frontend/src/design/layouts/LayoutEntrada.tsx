import type { ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Ligacao } from "../Ligacao";
import { Simbolo } from "../marca/Simbolo";
import { SaltarConteudo } from "./Contentor";

/**
 * Arquétipo Entrada (docs/LAYOUTS.md §2.2): entrar, criar conta, recuperar a
 * password. Um momento de confiança, não uma página de marketing.
 *
 * Computador: ecrã dividido. À esquerda, um painel marinho com o símbolo que se
 * alinha, uma frase e três factos de confiança; à direita, o formulário numa
 * coluna estreita. Sem cabeçalho nem rodapé do site.
 * Telemóvel: o painel encolhe a uma faixa curta no topo; o formulário ocupa o
 * resto e o teclado nunca o tapa.
 */
export interface LayoutEntradaProps {
  logotipo: ReactNode;
  inicio: { href: string; rotulo: string };
  voltar: { href: string; rotulo: string };
  frase: ReactNode;
  factos: string[];
  textoSaltar: string;
  children: ReactNode;
}

export const LayoutEntrada = ({ logotipo, inicio, voltar, frase, factos, textoSaltar, children }: LayoutEntradaProps) => (
  <div className="flex min-h-screen flex-col bg-superficie text-corpo text-tinta lg:grid lg:grid-cols-12">
    <SaltarConteudo rotulo={textoSaltar} />

    {/* Painel da marca: zona escura, mesmo com a página em tema claro. */}
    <aside className="tema-escuro flex flex-col bg-superficie px-4 py-5 text-tinta sm:px-6 lg:col-span-5 lg:px-12 lg:py-10 xl:col-span-4">
      <div className="flex items-center justify-between gap-4">
        <Ligacao
          href={inicio.href}
          aria-label={inicio.rotulo}
          className="block h-9 rounded-controlo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foco lg:h-10 [&>img]:h-full [&>img]:w-auto"
        >
          {logotipo}
        </Ligacao>
        <Ligacao
          href={voltar.href}
          className="inline-flex min-h-alvo-app items-center gap-1.5 rounded-controlo text-legenda font-medium text-accao underline-offset-4 hover:underline lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {voltar.rotulo}
        </Ligacao>
      </div>

      <div className="hidden flex-1 flex-col justify-center lg:flex">
        <div className="w-40">
          <Simbolo fundo="escuro" alinhar />
        </div>
        <p className="mt-10 text-titulo-m text-tinta">{frase}</p>
        <ul className="mt-8 flex flex-col gap-4">
          {factos.map((f) => (
            <li key={f} className="flex gap-3 text-corpo text-tinta-suave">
              <Check className="mt-1 size-5 shrink-0 text-acento" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <Ligacao
        href={voltar.href}
        className="hidden min-h-alvo-app items-center gap-1.5 self-start rounded-controlo text-legenda font-medium text-accao underline-offset-4 hover:underline lg:inline-flex"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {voltar.rotulo}
      </Ligacao>
    </aside>

    <main
      id="conteudo"
      tabIndex={-1}
      className="flex flex-1 justify-center px-4 py-10 outline-none sm:px-6 lg:col-span-7 lg:items-center lg:py-16 xl:col-span-8"
    >
      <div className="w-full max-w-sm">{children}</div>
    </main>
  </div>
);

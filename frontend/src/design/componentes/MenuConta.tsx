import type { ReactNode } from "react";
import * as Radix from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";
import { cn } from "../cn";
import { Ligacao } from "../Ligacao";

/**
 * Menu da conta (avatar com as acções da pessoa: perfil, definições, sair).
 * O Radix trata do que é difícil: abre com Enter, Espaço ou seta para baixo,
 * as setas percorrem os itens, Esc fecha e o foco volta ao avatar, e o menu
 * anuncia-se a leitores de ecrã como um menu.
 *
 * O avatar é uma foto, ou, sem ela, as iniciais da pessoa (o nome completo vem
 * no nome acessível do botão: "Conta de Ana Silva").
 */
export interface MenuContaProps {
  nome: string;
  avatarUrl?: string | null;
  /** Nome acessível do botão, traduzido e com o nome (ex.: "Conta de Ana Silva"). */
  rotulo: string;
  itens: readonly { rotulo: string; href: string; icone?: ReactNode }[];
  sair: { rotulo: string; aoSair: () => void };
}

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

const ITEM =
  "flex min-h-alvo-app cursor-pointer select-none items-center gap-3 rounded-controlo px-3 text-corpo text-tinta outline-none " +
  "data-[highlighted]:bg-accao-suave [&_svg]:size-5 [&_svg]:text-tinta-suave";

export const MenuConta = ({ nome, avatarUrl, rotulo, itens, sair }: MenuContaProps) => (
  <Radix.Root>
    <Radix.Trigger
      aria-label={rotulo}
      className={cn(
        "flex size-11 items-center justify-center overflow-hidden rounded-pilula bg-accao text-corpo font-medium text-sobre-accao",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
      )}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : <span aria-hidden>{iniciais(nome)}</span>}
    </Radix.Trigger>
    <Radix.Portal>
      <Radix.Content
        align="end"
        sideOffset={8}
        className="z-50 min-w-56 rounded-cartao border border-linha bg-superficie p-2 shadow-nivel-2"
      >
        <p className="truncate px-3 py-2 text-legenda text-tinta-suave">{nome}</p>
        {itens.map((i) => (
          <Radix.Item key={i.href} asChild>
            <Ligacao href={i.href} className={ITEM}>
              {i.icone}
              {i.rotulo}
            </Ligacao>
          </Radix.Item>
        ))}
        <Radix.Separator className="my-1 h-px bg-linha" />
        <Radix.Item className={ITEM} onSelect={sair.aoSair}>
          <LogOut aria-hidden />
          {sair.rotulo}
        </Radix.Item>
      </Radix.Content>
    </Radix.Portal>
  </Radix.Root>
);

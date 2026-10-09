import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Cartao } from "@/design/componentes/Cartao";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";
import { cn } from "@/design/cn";

/**
 * Peças comuns às duas lojas do jogo (Diamantes e Moedas): o cartão de cada
 * pacote e a janela de compra. Só apresentação -- quantidades e preços vêm
 * sempre da API, e quem compra é a página.
 */

export const CartaoPacote = ({
  testId,
  destaque,
  nome,
  icone,
  quantidade,
  bonus,
  children,
}: {
  testId: string;
  /** "Mais popular", "Melhor valor"... */
  destaque?: string;
  nome: string;
  icone: ReactNode;
  quantidade: string;
  bonus?: string;
  /** Preço e botões de compra. */
  children: ReactNode;
}) => (
  <Cartao data-testid={testId} className={cn("flex flex-col p-5", destaque && "border-2 border-accao")}>
    <div className="flex min-h-7 items-start justify-between gap-2">
      <p className="text-legenda font-medium text-tinta-suave">{nome}</p>
      {destaque && (
        <span className="whitespace-nowrap rounded-pilula bg-accao px-2.5 py-0.5 text-legenda font-medium text-sobre-accao">
          {destaque}
        </span>
      )}
    </div>
    <div className="mt-3 flex items-center gap-3">
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-pilula bg-superficie-alt [&_svg]:size-6">
        {icone}
      </span>
      <p className="text-titulo-m font-medium tabular-nums text-tinta">{quantidade}</p>
    </div>
    <p className={cn("mt-2 flex items-center gap-1 text-legenda text-sucesso", !bonus && "invisible")}>
      <Sparkles className="size-4" aria-hidden />
      {bonus ?? "—"}
    </p>
    <div className="mt-5 flex flex-1 flex-col justify-end gap-2">{children}</div>
  </Cartao>
);

/**
 * A janela de compra: o que se vai receber e por quanto, o pagamento (se for
 * por transferência) e o erro, escrito aqui dentro até a pessoa agir -- nunca
 * num aviso que desaparece sozinho a meio de um pagamento.
 */
export const DialogoCompra = ({
  aberto,
  aoFechar,
  titulo,
  descricao,
  erro,
  aConfirmar,
  podeConfirmar,
  rotuloConfirmar,
  aoConfirmar,
  textos,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao: string;
  erro: string | null;
  aConfirmar: boolean;
  podeConfirmar: boolean;
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  textos: { cancelar: string; fechar: string };
  children?: ReactNode;
}) => (
  <Dialogo open={aberto} onOpenChange={(open) => !open && aoFechar()}>
    <DialogoConteudo
      titulo={titulo}
      descricao={descricao}
      rotuloFechar={textos.fechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={aConfirmar}>
            {textos.cancelar}
          </Botao>
          <Botao onClick={aoConfirmar} disabled={!podeConfirmar} aCarregar={aConfirmar}>
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      {children}
      {erro && (
        <Aviso variante="erro" anunciar className={children ? "mt-6" : undefined}>
          {erro}
        </Aviso>
      )}
    </DialogoConteudo>
  </Dialogo>
);

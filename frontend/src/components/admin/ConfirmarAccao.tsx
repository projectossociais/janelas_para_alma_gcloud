import type { ReactNode } from "react";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo, DialogoFechar, DialogoGatilho } from "@/design/componentes/Dialogo";

/**
 * Uma acção que não se desfaz com um clique (tirar acesso, apagar): o botão
 * abre um diálogo que diz o que vai acontecer, e só "Confirmar" faz. Em vez
 * do `confirm()` do navegador, que não segue o sistema nem se traduz.
 */
export const ConfirmarAccao = ({
  rotulo,
  icone,
  titulo,
  descricao,
  confirmar,
  aoConfirmar,
  desactivado = false,
  aCarregar = false,
  soIcone = false,
}: {
  /** Texto do botão; com `soIcone`, fica só como nome acessível. */
  rotulo: string;
  icone?: ReactNode;
  titulo: string;
  descricao: ReactNode;
  /** Texto do botão que confirma (ex.: "Remover"). */
  confirmar: string;
  aoConfirmar: () => void;
  desactivado?: boolean;
  aCarregar?: boolean;
  soIcone?: boolean;
}) => (
  <Dialogo>
    <DialogoGatilho asChild>
      <Botao
        variante="fantasma"
        disabled={desactivado}
        aCarregar={aCarregar}
        aria-label={soIcone ? rotulo : undefined}
        className={soIcone ? "min-w-alvo-app px-2 text-erro hover:bg-erro-suave" : "text-erro hover:bg-erro-suave"}
      >
        {icone}
        {!soIcone && rotulo}
      </Botao>
    </DialogoGatilho>
    <DialogoConteudo
      titulo={titulo}
      descricao={descricao}
      rotuloFechar="Fechar"
      rodape={
        <>
          <DialogoFechar asChild>
            <Botao variante="secundario">Cancelar</Botao>
          </DialogoFechar>
          <DialogoFechar asChild>
            <Botao variante="perigo" onClick={aoConfirmar}>
              {confirmar}
            </Botao>
          </DialogoFechar>
        </>
      }
    />
  </Dialogo>
);

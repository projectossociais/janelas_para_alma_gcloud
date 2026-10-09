import type { ReactNode } from "react";
import { cn } from "@/design/cn";
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
  tom = "perigo",
  textos = { cancelar: "Cancelar", fechar: "Fechar" },
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
  /**
   * `perigo` (por omissão): tirar, apagar, revogar -- a vermelho.
   * `accao`: aprovar ou creditar -- não é destrutivo, mas também não se desfaz.
   */
  tom?: "perigo" | "accao";
  /** O admin só existe em português; o portal da clínica passa os textos traduzidos. */
  textos?: { cancelar: string; fechar: string };
}) => (
  <Dialogo>
    <DialogoGatilho asChild>
      <Botao
        variante={tom === "accao" ? "primario" : "fantasma"}
        disabled={desactivado}
        aCarregar={aCarregar}
        aria-label={soIcone ? rotulo : undefined}
        className={cn(
          soIcone && "min-w-alvo-app px-2",
          tom === "perigo" && "text-erro hover:bg-erro-suave",
        )}
      >
        {icone}
        {!soIcone && rotulo}
      </Botao>
    </DialogoGatilho>
    <DialogoConteudo
      titulo={titulo}
      descricao={descricao}
      rotuloFechar={textos.fechar}
      rodape={
        <>
          <DialogoFechar asChild>
            <Botao variante="secundario">{textos.cancelar}</Botao>
          </DialogoFechar>
          <DialogoFechar asChild>
            <Botao variante={tom === "accao" ? "primario" : "perigo"} onClick={aoConfirmar}>
              {confirmar}
            </Botao>
          </DialogoFechar>
        </>
      }
    />
  </Dialogo>
);

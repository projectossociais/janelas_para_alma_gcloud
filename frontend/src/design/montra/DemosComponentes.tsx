import { useState } from "react";
import { ArrowLeft, ArrowRight, Dumbbell } from "lucide-react";
import { Aviso } from "../componentes/Aviso";
import { Botao } from "../componentes/Botao";
import { Cartao, CartaoLigacao, CartaoTexto, CartaoTitulo } from "../componentes/Cartao";
import { Dialogo, DialogoConteudo, DialogoFechar, DialogoGatilho } from "../componentes/Dialogo";
import { EstadoVazio } from "../componentes/EstadoVazio";
import { Esqueleto, ZonaACarregar } from "../componentes/Esqueleto";
import { IndicadorPassos, TransicaoPasso } from "../componentes/Passos";
import { Campo } from "../componentes/Campo";

/** Demonstrações da montra (só em desenvolvimento). */

export const DemoAvisos = () => (
  <div className="grid max-w-3xl gap-4">
    <Aviso titulo="Isto não é um diagnóstico">Só um médico pode confirmar. O rastreio diz se vale a pena ir.</Aviso>
    <Aviso variante="sucesso" titulo="Consulta pedida">A Optioptika vai ligar-lhe até amanhã, às 17h.</Aviso>
    <Aviso variante="aviso" titulo="O seu teste de 7 dias termina amanhã">
      Veja a sua evolução antes de decidir.
    </Aviso>
    <Aviso
      variante="erro"
      titulo="Não foi possível guardar o resultado"
      accao={
        <Botao variante="secundario" tamanho="m">
          Tentar de novo
        </Botao>
      }
    >
      Verifique a ligação à internet. O que fez não se perdeu.
    </Aviso>
  </div>
);

export const DemoCartoes = () => (
  <div className="grid gap-6 md:grid-cols-3">
    <Cartao interactivo>
      <CartaoTitulo>
        <CartaoLigacao href="#cartoes">Treino de Anéis</CartaoLigacao>
      </CartaoTitulo>
      <CartaoTexto>6 minutos, um olho de cada vez. Incluído no teste de 7 dias.</CartaoTexto>
    </Cartao>
    <Cartao interactivo>
      <CartaoTitulo>
        <CartaoLigacao href="#cartoes">Teste de Acuidade</CartaoLigacao>
      </CartaoTitulo>
      <CartaoTexto>Até que tamanho de letra consegue ver, com cada olho.</CartaoTexto>
    </Cartao>
    <Cartao>
      <CartaoTitulo>Cartão sem acção</CartaoTitulo>
      <CartaoTexto>Só agrupa informação. Não reage ao rato.</CartaoTexto>
    </Cartao>
  </div>
);

export const DemoEstados = () => {
  const [aCarregar, setACarregar] = useState(false);
  const recarregar = () => {
    setACarregar(true);
    window.setTimeout(() => setACarregar(false), 2200);
  };
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <EstadoVazio
        imagem={<Dumbbell className="size-20" strokeWidth={1.5} />}
        titulo="Ainda não fez nenhum treino"
        descricao="Comece pelo de 3 minutos. Pode parar quando quiser."
        accao={<Botao>Começar o primeiro treino</Botao>}
        nivelTitulo="h3"
      />
      <div className="flex flex-col gap-4">
        <ZonaACarregar
          aCarregar={aCarregar}
          rotulo="A carregar os seus treinos"
          esqueleto={
            <div className="flex flex-col gap-3 rounded-cartao border border-linha bg-superficie p-6">
              <Esqueleto className="h-6 w-1/2" />
              <Esqueleto className="h-4 w-full" />
              <Esqueleto className="h-4 w-4/5" />
            </div>
          }
        >
          <Cartao>
            <CartaoTitulo>Treino de hoje</CartaoTitulo>
            <CartaoTexto>O olho esquerdo já lê 2 linhas mais pequenas do que há 3 semanas.</CartaoTexto>
          </Cartao>
        </ZonaACarregar>
        <div>
          <Botao variante="secundario" onClick={recarregar} aCarregar={aCarregar}>
            Simular carregamento (2,2 s)
          </Botao>
        </div>
      </div>
    </div>
  );
};

const ECRAS = [
  { titulo: "Antes de começar", texto: "Luz de frente, telemóvel à altura dos olhos, óculos tirados." },
  { titulo: "Vamos usar a câmara", texto: "Serve só para medir o alinhamento. A imagem é apagada logo a seguir." },
  { titulo: "Olhe para o ponto", texto: "Fique quieto 3 segundos." },
  { titulo: "Vale a pena ir ao oftalmologista", texto: "Isto não é um diagnóstico: só um médico pode confirmar." },
];

export const DemoPassos = () => {
  const [passo, setPasso] = useState(1);
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const ir = (n: number) => {
    setDireccao(n > passo ? 1 : -1);
    setPasso(n);
  };
  const ecra = ECRAS[passo - 1] ?? ECRAS[0]!;
  return (
    <div className="max-w-md rounded-cartao border border-linha bg-superficie p-6 shadow-nivel-1">
      <IndicadorPassos actual={passo} total={ECRAS.length} rotulo={`Passo ${passo} de ${ECRAS.length}`} />
      <TransicaoPasso chave={passo} direccao={direccao} className="mt-6 min-h-40">
        <h3 className="text-titulo-p text-tinta">{ecra.titulo}</h3>
        <p className="mt-2 text-corpo text-tinta-suave">{ecra.texto}</p>
      </TransicaoPasso>
      <div className="mt-6 flex justify-between gap-3">
        <Botao variante="fantasma" onClick={() => ir(passo - 1)} disabled={passo === 1}>
          <ArrowLeft /> Voltar
        </Botao>
        <Botao onClick={() => ir(passo === ECRAS.length ? 1 : passo + 1)}>
          {passo === ECRAS.length ? "Recomeçar" : "Continuar"} <ArrowRight />
        </Botao>
      </div>
    </div>
  );
};

export const DemoDialogo = () => (
  <Dialogo>
    <DialogoGatilho asChild>
      <Botao variante="secundario">Abrir diálogo de confirmação</Botao>
    </DialogoGatilho>
    <DialogoConteudo
      titulo="Retirar a autorização?"
      descricao="Deixamos de gravar resultados novos. Os que já existem ficam na sua conta."
      rotuloFechar="Fechar"
      rodape={
        <>
          <DialogoFechar asChild>
            <Botao variante="secundario">Cancelar</Botao>
          </DialogoFechar>
          <DialogoFechar asChild>
            <Botao variante="perigo">Retirar autorização</Botao>
          </DialogoFechar>
        </>
      }
    >
      <Campo rotulo="Escreva RETIRAR para confirmar" autoComplete="off" />
    </DialogoConteudo>
  </Dialogo>
);

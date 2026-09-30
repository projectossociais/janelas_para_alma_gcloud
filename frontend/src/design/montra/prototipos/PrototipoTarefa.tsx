import { useEffect, useState } from "react";
import { m } from "motion/react";
import { ArrowRight, CalendarCheck, Camera, Eye, Glasses, Ruler, ShieldCheck, Sun } from "lucide-react";
import { Aviso } from "../../componentes/Aviso";
import { Botao } from "../../componentes/Botao";
import { OpcaoConfirmar } from "../../componentes/OpcaoConfirmar";
import { TransicaoPasso } from "../../componentes/Passos";
import { LayoutTarefa } from "../../layouts/LayoutTarefa";
import type { TemaEfectivo } from "../../useTema";

/**
 * Arquétipo Tarefa: o rastreio repensado (docs/PESQUISA_UX.md §4.1).
 * Preparar (verificável) → explicar a câmara antes de a pedir → captar com o
 * ponto de fixação parado → um resultado que diz o que fazer a seguir.
 */
const PREPARACAO = [
  { chave: "luz", icone: <Sun />, rotulo: "Luz de frente", descricao: "Sem janela nem candeeiro atrás de si." },
  { chave: "altura", icone: <Ruler />, rotulo: "Telemóvel à altura dos olhos", descricao: "À distância de um braço." },
  { chave: "oculos", icone: <Glasses />, rotulo: "Sem óculos", descricao: "Se usar, tire-os só para o rastreio." },
] as const;

const TOTAL = 4;

export const PrototipoTarefa = ({ tema }: { tema: TemaEfectivo }) => {
  // ?passo=N no endereço abre directamente num passo (para rever e partilhar).
  const [passo, setPasso] = useState(() => {
    const n = Number(new URLSearchParams(window.location.search).get("passo"));
    return n >= 1 && n <= TOTAL ? n : 1;
  });
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const [prontos, setProntos] = useState<Record<string, boolean>>({});
  const [captado, setCaptado] = useState(false);

  const ir = (n: number) => {
    setDireccao(n > passo ? 1 : -1);
    setPasso(n);
  };

  // Protótipo: a captação "demora" 3 segundos.
  useEffect(() => {
    if (passo !== 3) return;
    setCaptado(false);
    const id = window.setTimeout(() => setCaptado(true), 3000);
    return () => window.clearTimeout(id);
  }, [passo]);

  const tudoPronto = PREPARACAO.every((p) => prontos[p.chave]);

  const accao =
    passo === 1 ? (
      <Botao tamanho="g" larguraTotal disabled={!tudoPronto} onClick={() => ir(2)}>
        Estou pronto <ArrowRight />
      </Botao>
    ) : passo === 2 ? (
      <Botao tamanho="g" larguraTotal onClick={() => ir(3)}>
        <Camera /> Permitir a câmara
      </Botao>
    ) : passo === 3 ? (
      <Botao tamanho="g" larguraTotal aCarregar={!captado} onClick={() => ir(4)}>
        Ver o resultado <ArrowRight />
      </Botao>
    ) : (
      <div className="flex flex-col gap-3">
        <Botao tamanho="g" larguraTotal>
          <CalendarCheck /> Marcar consulta
        </Botao>
        <Botao variante="fantasma" larguraTotal>
          Guardar e decidir depois
        </Botao>
      </div>
    );

  return (
    <LayoutTarefa
      tema={tema}
      passo={{ actual: passo, total: TOTAL, rotulo: `Passo ${passo} de ${TOTAL}` }}
      sair={{ rotulo: "Sair", aoSair: () => window.location.assign("/_montra/prototipos/site") }}
      confirmarSaida={
        passo > 1 && passo < 4
          ? {
              titulo: "Sair do rastreio?",
              descricao: "Ainda não tem resultado. Pode voltar a fazer o rastreio quando quiser.",
              ficar: "Continuar o rastreio",
              sair: "Sair",
              fechar: "Fechar",
            }
          : undefined
      }
      accao={accao}
      textoSaltar="Saltar para o conteúdo"
    >
      <TransicaoPasso chave={passo} direccao={direccao}>
        {passo === 1 && (
          <>
            <h1 className="text-titulo-m text-tinta">Antes de começar</h1>
            <p className="mt-3 text-corpo text-tinta-suave">Confirme estas três coisas. Demora 10 segundos.</p>
            <div className="mt-8 flex flex-col gap-3">
              {PREPARACAO.map((p) => (
                <OpcaoConfirmar
                  key={p.chave}
                  icone={p.icone}
                  rotulo={p.rotulo}
                  descricao={p.descricao}
                  marcada={!!prontos[p.chave]}
                  aoMudar={(v) => setProntos((s) => ({ ...s, [p.chave]: v }))}
                />
              ))}
            </div>
            {/* Um botão desactivado sem explicação frustra: diz-se o que falta. */}
            <p role="status" className="mt-4 text-legenda text-tinta-suave">
              {tudoPronto ? "Tudo pronto." : "Marque as três para continuar."}
            </p>
          </>
        )}

        {passo === 2 && (
          <>
            <h1 className="text-titulo-m text-tinta">Vamos usar a câmara</h1>
            <p className="mt-3 text-corpo text-tinta-suave">A seguir, o telemóvel pede autorização.</p>
            <ul className="mt-8 flex flex-col gap-5">
              <li className="flex gap-4">
                <Eye className="mt-0.5 size-6 shrink-0 text-accao" aria-hidden />
                <span className="text-corpo text-tinta">Serve só para medir se os olhos estão alinhados.</span>
              </li>
              <li className="flex gap-4">
                <ShieldCheck className="mt-0.5 size-6 shrink-0 text-accao" aria-hidden />
                <span className="text-corpo text-tinta">A imagem é apagada logo a seguir. Nunca guardamos fotografias.</span>
              </li>
            </ul>
          </>
        )}

        {passo === 3 && (
          <>
            <h1 className="text-titulo-m text-tinta">Olhe para o ponto</h1>
            <p className="mt-3 text-corpo text-tinta-suave">Fique quieto durante 3 segundos.</p>
            <div className="mt-8 flex aspect-[3/4] w-full items-center justify-center rounded-cartao bg-superficie-alt">
              {/* O ponto de fixação não se mexe (PESQUISA_UX §3, Conforto visual). */}
              <div className="relative flex h-3/4 w-2/3 items-center justify-center rounded-pilula border-2 border-accao/60">
                <span className="size-5 rounded-pilula bg-acento ring-4 ring-superficie" />
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-pilula bg-linha" aria-hidden>
              <m.div
                className="h-full origin-left rounded-pilula bg-accao"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 3, ease: "linear" }}
              />
            </div>
            <p role="status" className="mt-2 text-legenda text-tinta-suave">
              {captado ? "Pronto." : "A medir…"}
            </p>
          </>
        )}

        {passo === 4 && (
          <>
            <h1 className="text-titulo-m text-tinta">Vale a pena ir ao oftalmologista</h1>
            <p className="mt-3 text-corpo text-tinta-suave">
              Encontrámos um sinal de que os olhos podem não estar alinhados.
            </p>
            <Aviso className="mt-6" titulo="Isto não é um diagnóstico">
              Só um médico pode confirmar. Quanto mais cedo, melhor.
            </Aviso>
            <section aria-labelledby="proximo-passo" className="mt-6 rounded-cartao border border-linha p-5">
              <h2 id="proximo-passo" className="text-legenda font-medium uppercase tracking-wide text-tinta-suave">
                Próximo passo
              </h2>
              <p className="mt-2 text-titulo-p text-tinta">Consulta na Óptica Optioptika</p>
              <p className="mt-1 text-corpo text-tinta-suave">Luanda · próxima vaga: quinta-feira, 10:30</p>
            </section>
          </>
        )}
      </TransicaoPasso>
    </LayoutTarefa>
  );
};

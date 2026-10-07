import { useRef } from "react";
import { ArrowDown, ArrowRight, Camera, CalendarCheck, Check, Eye, Plus, ShieldCheck, Video } from "lucide-react";
import { Botao } from "../../componentes/Botao";
import { TituloSeccao } from "../../componentes/TituloSeccao";
import { Contentor } from "../../layouts/Contentor";
import { LayoutSite } from "../../layouts/LayoutSite";
import { Ligacao } from "../../Ligacao";
import { Simbolo } from "../../marca/Simbolo";
import { useForaDoEcra } from "../../useForaDoEcra";
import type { TemaEfectivo } from "../../useTema";
import { cabecalhoSite, rodape } from "./dados";

/**
 * Arquétipo Site: a página inicial com a ordem de docs/ESTRUTURA_SITE.md §5.
 * Cada secção responde a uma pergunta do pai, e cada uma tem uma composição
 * própria (docs/LAYOUTS.md §2.1): abertura assimétrica, lista editorial,
 * linha do tempo, decisão em duas colunas, faixa marinho, perguntas.
 */

const Telemovel = () => (
  <div className="mx-auto w-full max-w-72 rounded-cartao lg:max-w-80 border-8 border-tinta bg-superficie p-5 shadow-nivel-2">
    <p className="text-legenda font-medium text-tinta-suave">Passo 2 de 4</p>
    <div className="mt-2 flex gap-1" aria-hidden>
      <span className="h-1 flex-1 rounded-pilula bg-accao" />
      <span className="h-1 flex-1 rounded-pilula bg-accao" />
      <span className="h-1 flex-1 rounded-pilula bg-linha" />
      <span className="h-1 flex-1 rounded-pilula bg-linha" />
    </div>
    <p className="mt-5 text-titulo-p text-tinta">Vamos usar a câmara</p>
    <div className="mt-5 flex size-16 items-center justify-center rounded-pilula bg-accao-suave text-accao">
      <Camera className="size-8" aria-hidden />
    </div>
    <ul className="mt-5 flex flex-col gap-3 text-legenda text-tinta-suave">
      <li className="flex gap-2">
        <Eye className="size-4 shrink-0 text-accao" aria-hidden /> Serve só para medir o alinhamento dos olhos.
      </li>
      <li className="flex gap-2">
        <ShieldCheck className="size-4 shrink-0 text-accao" aria-hidden /> A imagem é apagada logo a seguir.
      </li>
    </ul>
    <span className="mt-6 flex min-h-12 items-center justify-center rounded-controlo bg-accao text-corpo font-medium text-sobre-accao">
      Permitir a câmara
    </span>
  </div>
);

const SINAIS = [
  ["Um olho que desvia", "Para dentro, para fora, para cima ou para baixo, sempre ou só às vezes."],
  ["Inclinar ou rodar a cabeça", "Para ver melhor a televisão ou o quadro da escola."],
  ["Fechar um olho ao sol", "Ou tapar um olho com a mão para conseguir ler."],
  ["Tropeçar ou falhar coisas", "Como se as distâncias enganassem."],
  ["Queixas de ver a dobrar", "Mais comuns quando o desvio aparece depois dos 6 anos."],
] as const;

const PASSOS = [
  ["Faça o rastreio", "Dois minutos com a câmara do telemóvel. Grátis, sem criar conta."],
  ["Perceba o resultado", "Em palavras simples: está tudo bem, ou vale a pena ir ao médico."],
  ["Siga o próximo passo", "Marque a consulta numa clínica parceira ou treine a visão em casa."],
] as const;

const PERGUNTAS = [
  ["É um diagnóstico?", "Não. É uma triagem: diz se vale a pena ir ao oftalmologista. Só um médico pode diagnosticar."],
  ["Guardam a fotografia do meu filho?", "Não. A imagem é analisada e apagada logo a seguir. Guardamos só as medições, e só se tiver conta."],
  ["Quanto custa?", "O rastreio é grátis. Os treinos em casa têm 7 dias grátis; depois, 15.000 Kz por mês."],
  ["A partir de que idade?", "O rastreio funciona a partir dos 3 anos, com a ajuda de um adulto."],
] as const;

export const PrototipoSite = ({ tema }: { tema: TemaEfectivo }) => {
  const abertura = useRef<HTMLElement>(null);
  const passouAbertura = useForaDoEcra(abertura);

  return (
    <LayoutSite
      cabecalho={cabecalhoSite(tema)}
      rodape={rodape(tema)}
      textoSaltar="Saltar para o conteúdo"
      barraVisivel={passouAbertura}
      barraMovel={
        <Botao asChild tamanho="g" larguraTotal>
          <Ligacao href="/_montra/prototipos/tarefa">
            Fazer o rastreio grátis <ArrowRight />
          </Ligacao>
        </Botao>
      }
    >
      {/* 1. Abertura: assimétrica, o produto real à direita, a meio caminho da secção seguinte. */}
      <section ref={abertura} aria-labelledby="titulo-abertura" className="relative bg-fundo">
        <Contentor className="grid items-center gap-12 pb-16 pt-10 lg:grid-cols-12 lg:gap-8 lg:pb-0 lg:pt-20">
          <div className="lg:col-span-7 lg:pb-24">
            <h1 id="titulo-abertura" className="text-abertura text-tinta">
              Descubra em <span className="whitespace-nowrap text-destaque">2 minutos</span> se o seu filho precisa de ir ao
              oftalmologista.
            </h1>
            <p className="mt-6 max-w-xl text-corpo-g text-tinta-suave">
              Um rastreio de estrabismo no telemóvel. Grátis, sem criar conta, e sem guardar nenhuma fotografia.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Botao asChild tamanho="g">
                <Ligacao href="/_montra/prototipos/tarefa">
                  Fazer o rastreio <ArrowRight />
                </Ligacao>
              </Botao>
              <Botao asChild variante="fantasma" tamanho="g">
                <a href="#como-funciona">
                  Como funciona <ArrowDown />
                </a>
              </Botao>
            </div>
          </div>
          <div className="lg:col-span-5 lg:translate-y-16">
            <Telemovel />
          </div>
        </Contentor>
      </section>

      {/* 2. Sinais: título fixo à esquerda, lista editorial numerada à direita. */}
      <section aria-labelledby="titulo-sinais" className="border-t border-linha bg-superficie py-16 lg:py-24">
        <Contentor className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <TituloSeccao id="titulo-sinais">
                Sinais a que estar atento
              </TituloSeccao>
              <p className="mt-4 text-corpo text-tinta-suave">
                Quanto mais cedo se trata, melhor: idealmente antes dos 7 anos. Se reconhece algum destes sinais, faça o
                rastreio.
              </p>
              <Ligacao
                href="#estrabismo"
                className="mt-6 inline-flex min-h-alvo-app items-center gap-2 rounded-controlo font-medium text-accao underline-offset-4 hover:underline"
              >
                O que é o estrabismo <ArrowRight className="size-5" aria-hidden />
              </Ligacao>
            </div>
          </div>
          <ol className="lg:col-span-7 lg:col-start-6">
            {SINAIS.map(([titulo, texto], i) => (
              <li key={titulo} className="grid grid-cols-[auto_1fr] gap-x-6 border-b border-linha py-6 first:pt-0 last:border-0">
                <span className="text-titulo-m text-destaque" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-titulo-p text-tinta">{titulo}</h3>
                  <p className="mt-1 text-corpo text-tinta-suave">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </Contentor>
      </section>

      {/* 3. Como funciona: linha do tempo, não três cartões. */}
      <section id="como-funciona" aria-labelledby="titulo-como" className="scroll-mt-24 bg-fundo py-16 lg:py-24">
        <Contentor>
          <TituloSeccao id="titulo-como" className="max-w-2xl">
            Do telemóvel ao médico, em três passos.
          </TituloSeccao>
          <ol className="relative mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
            <span aria-hidden className="absolute left-5 top-5 hidden h-px w-2/3 bg-linha-forte lg:block" />
            {PASSOS.map(([titulo, texto], i) => (
              <li
                key={titulo}
                className="relative flex gap-5 before:absolute before:-bottom-10 before:left-5 before:top-10 before:w-px before:bg-linha-forte last:before:hidden lg:flex-col lg:before:hidden"
              >
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-pilula bg-accao text-corpo font-medium text-sobre-accao">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-titulo-p text-tinta">{titulo}</h3>
                  <p className="mt-2 max-w-xs text-corpo text-tinta-suave">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </Contentor>
      </section>

      {/* 4. Depois do rastreio: a decisão em duas colunas, com o preço dito às claras. */}
      <section aria-labelledby="titulo-depois" className="bg-superficie-alt py-16 lg:py-24">
        <Contentor>
          <TituloSeccao id="titulo-depois">
            E depois do rastreio?
          </TituloSeccao>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <article className="flex flex-col rounded-cartao bg-superficie p-8 shadow-nivel-1">
              <CalendarCheck className="size-8 text-accao" aria-hidden />
              <h3 className="mt-6 text-titulo-m text-tinta">Uma consulta a sério</h3>
              <p className="mt-3 text-corpo text-tinta-suave">
                Numa clínica parceira em Luanda, presencial ou por vídeo. Escolhe um horário real e a clínica confirma.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-linha pt-6 text-legenda">
                <div>
                  <dt className="text-tinta-suave">Clínica</dt>
                  <dd className="mt-1 font-medium text-tinta">Óptica Optioptika</dd>
                </div>
                <div>
                  <dt className="text-tinta-suave">Como</dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-medium text-tinta">
                    <Video className="size-4" aria-hidden /> Presencial ou vídeo
                  </dd>
                </div>
              </dl>
              <div className="mt-auto pt-8">
                <Botao variante="secundario">Ver horários</Botao>
              </div>
            </article>
            <article className="flex flex-col rounded-cartao bg-superficie p-8 shadow-nivel-1">
              <Eye className="size-8 text-accao" aria-hidden />
              <h3 className="mt-6 text-titulo-m text-tinta">Treinos em casa</h3>
              <p className="mt-3 text-corpo text-tinta-suave">
                Testes e treinos de poucos minutos, sem câmara, com a evolução explicada em frases simples.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-linha pt-6 text-legenda">
                <div>
                  <dt className="text-tinta-suave">Para experimentar</dt>
                  <dd className="mt-1 font-medium text-tinta">7 dias grátis</dd>
                </div>
                <div>
                  <dt className="text-tinta-suave">Depois</dt>
                  <dd className="mt-1 font-medium text-tinta">15.000 Kz por mês</dd>
                </div>
              </dl>
              <div className="mt-auto pt-8">
                <Botao variante="secundario">Conhecer os treinos</Botao>
              </div>
            </article>
          </div>
        </Contentor>
      </section>

      {/* 5. Porque confiar: faixa marinho a toda a largura, a voz de uma pessoa real. */}
      <section aria-labelledby="titulo-confiar" className="tema-escuro bg-superficie py-16 text-tinta lg:py-24">
        <Contentor className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <h2 id="titulo-confiar" className="text-legenda font-medium uppercase tracking-wide text-accao">
              Porque confiar
            </h2>
            <blockquote className="mt-6">
              <p className="text-titulo-m text-tinta">
                “O Janelas para a Alma nasceu da necessidade de dar visibilidade ao que muitas vezes é ignorado.”
              </p>
              <footer className="mt-6 text-corpo text-tinta-suave">Dalva Filipe, coordenação geral</footer>
            </blockquote>
          </div>
          <ul className="flex flex-col gap-5 lg:col-span-4 lg:col-start-9">
            {[
              "Uma instituição angolana, feita por jovens angolanos.",
              "Clínica parceira real, em Luanda.",
              "Triagem honesta: dizemos o que não somos.",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-corpo text-tinta">
                <Check className="mt-1 size-5 shrink-0 text-acento" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Contentor>
      </section>

      {/* 6. Apoiar: o doador tem o seu lugar, sem disputar a abertura. */}
      <section aria-labelledby="titulo-apoiar" className="bg-fundo py-16 lg:py-24">
        <Contentor className="grid items-center gap-10 lg:grid-cols-12">
          <div className="w-40 lg:col-span-3">
            <Simbolo fundo={tema} />
          </div>
          <div className="lg:col-span-7 lg:col-start-5">
            <TituloSeccao id="titulo-apoiar">Ajude a chegar a mais famílias.</TituloSeccao>
            <p className="mt-4 max-w-xl text-corpo text-tinta-suave">
              Doe dinheiro ou óculos que já não usa, ou junte-se às acções no terreno da comunidade Meu Kamba Estrábico.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Botao variante="secundario">Doar</Botao>
              <Botao variante="fantasma">Ser voluntário</Botao>
            </div>
          </div>
        </Contentor>
      </section>

      {/* 7. Perguntas rápidas: as dúvidas que travam, respondidas sem sair da página. */}
      <section aria-labelledby="titulo-perguntas" className="border-t border-linha bg-superficie py-16 lg:py-24">
        <Contentor largura="texto">
          <TituloSeccao id="titulo-perguntas">
            Perguntas rápidas
          </TituloSeccao>
          <div className="mt-8 divide-y divide-linha border-y border-linha">
            {PERGUNTAS.map(([pergunta, resposta]) => (
              <details key={pergunta} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-corpo-g font-medium text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco [&::-webkit-details-marker]:hidden">
                  {pergunta}
                  <Plus
                    aria-hidden
                    className="size-5 shrink-0 text-accao transition-transform duration-transicao group-open:rotate-45 motion-reduce:transition-none"
                  />
                </summary>
                <p className="pb-6 text-corpo text-tinta-suave">{resposta}</p>
              </details>
            ))}
          </div>
        </Contentor>
      </section>
    </LayoutSite>
  );
};

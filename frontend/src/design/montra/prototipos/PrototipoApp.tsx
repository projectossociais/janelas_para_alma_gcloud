import { Bell, CalendarCheck, Dumbbell, Gamepad2, Gem, Home, Play, Stethoscope, UserRound } from "lucide-react";
import { Botao } from "../../componentes/Botao";
import { Cartao, CartaoLigacao } from "../../componentes/Cartao";
import { LayoutApp } from "../../layouts/LayoutApp";
import { Simbolo } from "../../marca/Simbolo";
import { cn } from "../../cn";
import type { TemaEfectivo } from "../../useTema";

/**
 * Arquétipo App: "Hoje" (docs/LAYOUTS.md §2.4; PESQUISA_UX §4.3 e §6).
 * Um só próximo passo em destaque; depois a evolução em frase simples, a
 * sequência que perdoa, a consulta e o jogo. É da pessoa: pouca marca.
 */

// Protótipo: evolução de 8 semanas (linhas lidas no Teste de Acuidade).
const EVOLUCAO = [2, 2, 3, 3, 3, 4, 4, 5];
const SEMANA = [true, true, false, true, true, true, true];
const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

export const PrototipoApp = ({ tema }: { tema: TemaEfectivo }) => (
  <LayoutApp
    destinos={[
      { rotulo: "Hoje", href: "#hoje", icone: <Home />, activo: true },
      { rotulo: "Treinos", href: "#treinos", icone: <Dumbbell /> },
      { rotulo: "Jogo", href: "#jogo", icone: <Gamepad2 /> },
      { rotulo: "Consultas", href: "#consultas", icone: <Stethoscope /> },
      { rotulo: "Perfil", href: "#perfil", icone: <UserRound /> },
    ]}
    rotuloNavegacao="Navegação da app"
    simbolo={<Simbolo fundo={tema} />}
    saudacao="Olá, Ana"
    subtitulo="Terça-feira, 30 de Setembro"
    conta={
      <>
        <Botao variante="fantasma" className="px-3" aria-label="Notificações">
          <Bell />
        </Botao>
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-pilula bg-accao-suave text-corpo font-medium text-accao"
        >
          A
        </span>
      </>
    }
    textoSaltar="Saltar para o conteúdo"
  >
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Próximo passo: o único destaque do ecrã. */}
      <section
        aria-labelledby="proximo"
        className="tema-escuro flex flex-col gap-6 rounded-cartao bg-superficie-alt p-6 text-tinta sm:flex-row sm:items-center sm:justify-between lg:col-span-12 lg:p-8"
      >
        <div>
          <h2 id="proximo" className="text-legenda font-medium uppercase tracking-wide text-accao">
            Treino de hoje
          </h2>
          <p className="mt-2 text-titulo-m text-tinta">Treino de Anéis, olho esquerdo</p>
          <p className="mt-1 text-corpo text-tinta-suave">6 minutos. Pode parar quando quiser.</p>
        </div>
        <Botao tamanho="g" className="shrink-0">
          <Play /> Começar
        </Botao>
      </section>

      {/* Evolução: a frase primeiro, o gráfico a confirmar. */}
      <section aria-labelledby="evolucao" className="rounded-cartao border border-linha bg-superficie p-6 lg:col-span-7">
        <h2 id="evolucao" className="text-titulo-p text-tinta">
          Evolução
        </h2>
        <p className="mt-2 text-corpo text-tinta-suave">
          <strong className="font-medium text-tinta">O olho esquerdo já lê 3 linhas mais pequenas</strong> do que há 8
          semanas.
        </p>
        <div className="mt-6 flex h-32 items-end gap-2" aria-hidden>
          {EVOLUCAO.map((v, i) => (
            <span
              key={i}
              className={cn("flex-1 rounded-pequeno", i === EVOLUCAO.length - 1 ? "bg-accao" : "bg-accao-suave")}
              style={{ height: `${(v / 5) * 100}%` }}
            />
          ))}
        </div>
        <p className="mt-2 flex justify-between text-legenda text-tinta-suave" aria-hidden>
          <span>há 8 semanas</span>
          <span>esta semana</span>
        </p>
      </section>

      {/* Sequência que perdoa: um dia falhado não apaga nada. */}
      <section aria-labelledby="sequencia" className="rounded-cartao border border-linha bg-superficie p-6 lg:col-span-5">
        <h2 id="sequencia" className="text-titulo-p text-tinta">
          Esta semana
        </h2>
        <p className="mt-2 text-corpo text-tinta-suave">6 dias de treino. Falhar um dia não apaga a sequência.</p>
        <ol className="mt-6 grid grid-cols-7 gap-2">
          {SEMANA.map((feito, i) => (
            <li key={i} className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-pilula text-legenda font-medium",
                  feito ? "bg-accao text-sobre-accao" : "border border-linha-forte text-tinta-suave",
                )}
              >
                {DIAS[i]}
                <span className="sr-only">{feito ? ": treinou" : ": não treinou"}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-linha pt-4 text-corpo text-tinta-suave">
          Mais <strong className="font-medium text-tinta">1 dia</strong> para ganhar os 5 diamantes da semana.
        </p>
      </section>

      <Cartao interactivo className="lg:col-span-6">
        <CalendarCheck className="size-6 text-accao" aria-hidden />
        <h2 className="mt-4 text-titulo-p text-tinta">
          <CartaoLigacao href="#consultas">Consulta na quinta, às 10:30</CartaoLigacao>
        </h2>
        <p className="mt-1 text-corpo text-tinta-suave">Óptica Optioptika · presencial</p>
      </Cartao>

      <Cartao interactivo className="lg:col-span-6">
        <Gem className="size-6 text-accao" aria-hidden />
        <h2 className="mt-4 text-titulo-p text-tinta">
          <CartaoLigacao href="#jogo">Inclusivamente: 1.240 moedas</CartaoLigacao>
        </h2>
        <p className="mt-1 text-corpo text-tinta-suave">+100 moedas pelo treino de hoje.</p>
      </Cartao>
    </div>
  </LayoutApp>
);

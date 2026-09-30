import { useState, type ReactNode } from "react";
import { ArrowRight, CalendarCheck, RotateCcw } from "lucide-react";
import { ProvedorMovimento } from "../ProvedorMovimento";
import { cn } from "../cn";
import { contraste } from "../contraste";
import { CORES, ESCALA_TIPO, RAIO, type NomeCor } from "../tokens";
import { useTema, type PreferenciaTema } from "../useTema";
import { Botao } from "../componentes/Botao";
import { Campo } from "../componentes/Campo";
import { Simbolo } from "../marca/Simbolo";
import logotipo from "../marca/logotipo-horizontal-sem-assinatura.svg";
import logotipoNegativo from "../marca/logotipo-horizontal-negativo-sem-assinatura.svg";

/**
 * Montra do sistema de design (docs/SISTEMA_DESIGN.md §7): cada token e cada
 * componente em todos os estados, nos dois temas. É a documentação viva: se
 * não está aqui, não existe. Só em desenvolvimento (`/_montra`).
 */

const GRUPOS_COR: { titulo: string; cores: NomeCor[] }[] = [
  { titulo: "Fundos", cores: ["fundo", "superficie", "superficie-alt", "superficie-elevada"] },
  { titulo: "Texto", cores: ["tinta", "tinta-suave"] },
  { titulo: "Linhas", cores: ["linha", "linha-forte"] },
  { titulo: "Acção", cores: ["accao", "accao-forte", "accao-suave", "sobre-accao"] },
  { titulo: "Acento e destaque", cores: ["acento", "sobre-acento", "destaque"] },
  {
    titulo: "Estados",
    cores: ["sucesso", "sucesso-suave", "aviso", "aviso-suave", "erro", "erro-suave", "sobre-erro"],
  },
  { titulo: "Foco", cores: ["foco"] },
];

// Classes escritas por inteiro: o Tailwind só gera as que encontra no código
// (uma classe montada com `text-${nome}` nunca chegaria ao CSS).
const CLASSE_TIPO: Record<keyof typeof ESCALA_TIPO, string> = {
  legenda: "text-legenda",
  corpo: "text-corpo",
  "corpo-g": "text-corpo-g",
  "titulo-p": "text-titulo-p",
  "titulo-m": "text-titulo-m",
  "titulo-g": "text-titulo-g",
  abertura: "text-abertura",
};
const CLASSE_RAIO: Record<keyof typeof RAIO, string> = {
  controlo: "rounded-controlo",
  cartao: "rounded-cartao",
  pilula: "rounded-pilula",
};

// Com que cor se mede cada contraste: o texto sobre os fundos, e cada cor
// "sobre-" ou "-suave" com a cor com que faz par.
const PAR: Partial<Record<NomeCor, NomeCor>> = {
  fundo: "tinta",
  superficie: "tinta",
  "superficie-alt": "tinta",
  "superficie-elevada": "tinta",
  "sobre-accao": "accao",
  "accao-suave": "accao",
  "sobre-acento": "acento",
  "sucesso-suave": "sucesso",
  "aviso-suave": "aviso",
  "erro-suave": "erro",
  "sobre-erro": "erro",
};

const SECCOES = [
  ["cor", "Cor"],
  ["tipo", "Tipo"],
  ["forma", "Forma"],
  ["botoes", "Botões"],
  ["campos", "Campos"],
  ["simbolo", "Símbolo"],
] as const;

const Seccao = ({ id, titulo, descricao, children }: { id: string; titulo: string; descricao: string; children: ReactNode }) => (
  <section id={id} className="scroll-mt-28 border-t border-linha py-16">
    <h2 className="text-titulo-m text-tinta">{titulo}</h2>
    <p className="mt-2 max-w-2xl text-corpo text-tinta-suave">{descricao}</p>
    <div className="mt-10">{children}</div>
  </section>
);

const Amostra = ({ nome, cores }: { nome: NomeCor; cores: Record<NomeCor, string> }) => {
  const par = PAR[nome] ?? "superficie";
  const r = contraste(cores[nome], cores[par]);
  return (
    <div className="overflow-hidden rounded-cartao border border-linha bg-superficie">
      <div className="h-20 border-b border-linha" style={{ backgroundColor: `rgb(var(--cor-${nome}))` }} />
      <div className="p-4">
        <p className="text-corpo font-medium text-tinta">{nome}</p>
        <p className="mt-1 font-mono text-legenda text-tinta-suave">
          {cores[nome]} · {r.toFixed(2)}:1 com {par}
        </p>
      </div>
    </div>
  );
};

const EscolhaTema = ({ valor, onMudar }: { valor: PreferenciaTema; onMudar: (p: PreferenciaTema) => void }) => (
  <div role="radiogroup" aria-label="Tema" className="flex rounded-pilula border border-linha bg-superficie-alt p-1">
    {(["sistema", "claro", "escuro"] as const).map((p) => (
      <button
        key={p}
        type="button"
        role="radio"
        aria-checked={valor === p}
        onClick={() => onMudar(p)}
        className={cn(
          "min-h-9 rounded-pilula px-4 text-legenda font-medium capitalize text-tinta-suave transition-colors duration-feedback",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
          valor === p && "bg-superficie text-tinta shadow-nivel-1",
        )}
      >
        {p}
      </button>
    ))}
  </div>
);

const Montra = () => {
  const { preferencia, efectivo, definir } = useTema();
  const [repeticao, setRepeticao] = useState(0);
  const cores = CORES[efectivo];

  return (
    <ProvedorMovimento>
      <div className="min-h-screen bg-fundo text-corpo text-tinta">
        <header className="sticky top-0 z-40 border-b border-linha bg-superficie/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
            <img
              src={efectivo === "claro" ? logotipo : logotipoNegativo}
              alt="Janelas Para Alma"
              className="h-10 w-auto"
            />
            <p className="text-titulo-p text-tinta">Montra</p>
            <nav aria-label="Secções da montra" className="flex flex-wrap gap-x-5 gap-y-1 text-legenda font-medium">
              {SECCOES.map(([id, nome]) => (
                <a key={id} href={`#${id}`} className="text-accao underline-offset-4 hover:underline">
                  {nome}
                </a>
              ))}
            </nav>
            <div className="ml-auto">
              <EscolhaTema valor={preferencia} onMudar={definir} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6">
          <div className="py-16">
            <p className="text-legenda font-medium uppercase tracking-wide text-accao">Direcção A · Clínica</p>
            <h1 className="mt-3 max-w-3xl text-abertura text-tinta">
              O sistema de design do <span className="text-destaque">Janelas Para a Alma</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-corpo-g text-tinta-suave">
              Tokens, letra e componentes em todos os estados, nos dois temas. Os números de contraste são calculados, e os
              testes impedem que desçam abaixo das regras.
            </p>
          </div>

          <Seccao id="cor" titulo="Cor" descricao="Só nomes com significado. Cada contraste é medido com a cor com que faz par (os fundos, com o texto).">
            <div className="space-y-10">
              {GRUPOS_COR.map((g) => (
                <div key={g.titulo}>
                  <h3 className="text-titulo-p text-tinta">{g.titulo}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {g.cores.map((c) => (
                      <Amostra key={c} nome={c} cores={cores} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Seccao>

          <Seccao id="tipo" titulo="Tipo" descricao="Ubuntu, seis tamanhos e uma abertura fluida. Texto corrido nunca abaixo de 17 px.">
            <div className="divide-y divide-linha rounded-cartao border border-linha bg-superficie">
              {Object.entries(ESCALA_TIPO).map(([nome, [tamanho, entrelinha, , peso]]) => (
                <div key={nome} className="grid gap-2 p-6 md:grid-cols-[12rem_1fr] md:items-baseline">
                  <p className="font-mono text-legenda text-tinta-suave">
                    {nome}
                    <br />
                    {tamanho} · {entrelinha} · {peso}
                  </p>
                  <p className={cn("text-tinta", CLASSE_TIPO[nome as keyof typeof ESCALA_TIPO])}>Ver bem começa por saber.</p>
                </div>
              ))}
            </div>
          </Seccao>

          <Seccao id="forma" titulo="Forma" descricao="Três raios, duas sombras (só no claro; no escuro a elevação é a cor) e os alvos de toque mínimos.">
            <div className="grid gap-6 md:grid-cols-3">
              {Object.entries(RAIO).map(([nome, valor]) => (
                <div key={nome} className={cn("border border-linha bg-superficie p-6", CLASSE_RAIO[nome as keyof typeof RAIO])}>
                  <p className="font-medium text-tinta">rounded-{nome}</p>
                  <p className="font-mono text-legenda text-tinta-suave">{valor}</p>
                </div>
              ))}
              <div className="rounded-cartao bg-superficie p-6 shadow-nivel-1">
                <p className="font-medium text-tinta">shadow-nivel-1</p>
                <p className="text-legenda text-tinta-suave">Cartões</p>
              </div>
              <div className="rounded-cartao bg-superficie-elevada p-6 shadow-nivel-2">
                <p className="font-medium text-tinta">shadow-nivel-2</p>
                <p className="text-legenda text-tinta-suave">Diálogos e menus</p>
              </div>
              <div className="flex items-end gap-4 rounded-cartao border border-linha bg-superficie p-6">
                <span className="flex min-h-alvo-consola min-w-alvo-consola items-center justify-center rounded-controlo bg-accao-suave text-legenda text-accao">32</span>
                <span className="flex min-h-alvo-app min-w-alvo-app items-center justify-center rounded-controlo bg-accao-suave text-legenda text-accao">44</span>
                <span className="flex min-h-alvo-crianca min-w-alvo-crianca items-center justify-center rounded-controlo bg-accao-suave text-legenda text-accao">72</span>
              </div>
            </div>
          </Seccao>

          <Seccao id="botoes" titulo="Botões" descricao="Quatro variantes, dois tamanhos. A carregar, o texto continua a ser lido e a largura não muda.">
            <div className="overflow-x-auto rounded-cartao border border-linha bg-superficie">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-linha text-legenda text-tinta-suave">
                    <th scope="col" className="p-4 font-medium">Variante</th>
                    <th scope="col" className="p-4 font-medium">Normal</th>
                    <th scope="col" className="p-4 font-medium">A carregar</th>
                    <th scope="col" className="p-4 font-medium">Desactivado</th>
                  </tr>
                </thead>
                <tbody>
                  {(["primario", "secundario", "fantasma", "perigo"] as const).map((v) => (
                    <tr key={v} className="border-b border-linha last:border-0">
                      <th scope="row" className="p-4 font-mono text-legenda font-normal text-tinta-suave">{v}</th>
                      <td className="p-4"><Botao variante={v}>Marcar consulta</Botao></td>
                      <td className="p-4"><Botao variante={v} aCarregar>Marcar consulta</Botao></td>
                      <td className="p-4"><Botao variante={v} disabled>Marcar consulta</Botao></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Botao tamanho="g">
                Fazer o rastreio <ArrowRight />
              </Botao>
              <Botao tamanho="g" variante="secundario">
                <CalendarCheck /> Ver vagas
              </Botao>
              <Botao asChild variante="fantasma">
                <a href="#botoes">Uma ligação com aspecto de botão</a>
              </Botao>
            </div>
          </Seccao>

          <Seccao id="campos" titulo="Campos" descricao="Rótulo por cima, ajuda antes do campo, erro com ícone e texto. Teclado certo no telemóvel.">
            <div className="grid max-w-3xl gap-8 md:grid-cols-2">
              <Campo rotulo="Nome da criança" autoComplete="off" />
              <Campo rotulo="Telefone" ajuda="9 números, começa por 9" type="tel" inputMode="numeric" autoComplete="tel-national" />
              <Campo
                rotulo="Telefone"
                ajuda="9 números, começa por 9"
                erro="Faltam números: um telemóvel angolano tem 9."
                type="tel"
                inputMode="numeric"
                defaultValue="92"
              />
              <Campo rotulo="Província" defaultValue="Luanda" disabled />
            </div>
          </Seccao>

          <Seccao id="simbolo" titulo="Símbolo" descricao="O olhar alinha-se uma vez. Com movimento reduzido aparece logo alinhado.">
            <div className="flex flex-wrap items-center gap-8">
              <div className="w-64 rounded-cartao bg-superficie-alt p-8">
                <Simbolo key={repeticao} fundo={efectivo} alinhar titulo="Símbolo do Janelas Para a Alma" />
              </div>
              <Botao variante="secundario" onClick={() => setRepeticao((n) => n + 1)}>
                <RotateCcw /> Repetir
              </Botao>
            </div>
          </Seccao>
        </main>
      </div>
    </ProvedorMovimento>
  );
};

export default Montra;

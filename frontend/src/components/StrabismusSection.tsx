import { Eye, Dna, Layers, AlertTriangle, Stethoscope, BookOpen, ExternalLink } from "lucide-react";

const references = [
  {
    label:
      "Bicas, H. E. A. \"Estrabismos: da teoria à prática, dos conceitos às suas operacionalizações\". Arquivos Brasileiros de Oftalmologia (SciELO), 2009 ↗",
    href: "https://www.scielo.br/j/abo/a/9KXCHZM4pZ5jfTvVyKrpNPQ/?lang=pt",
  },
  {
    label:
      "Machado, I. S. & Gama, R. \"Estrabismo para Totós\". Sociedade Portuguesa de Oftalmologia, 2012 ↗",
    href: "https://spoftalmologia.pt/wp-content/uploads/2016/10/estrabismo-para-totos-pdf.pdf",
  },
  {
    label:
      "\"Breves Considerações sobre o Estrabismo\", Repositório Aberto da Universidade do Porto ↗",
    href: "https://repositorio-aberto.up.pt/bitstream/10216/16622/2/31_5_EMC_I_01_C.pdf",
  },
];

const StrabismusSection = () => {
  return (
    <section id="estrabismo" className="py-20 md:py-28 bg-muted/50">
      <div className="container">
        <div className="text-center mb-16 space-y-4">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            Compreender o Estrabismo
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground">
            O que é o Estrabismo?
          </h2>
          <p className="max-w-2xl mx-auto text-muted-foreground leading-relaxed">
            Desmistificar a condição para promover a inclusão e o tratamento atempado.
          </p>
        </div>

        <article className="max-w-4xl mx-auto text-lg text-muted-foreground leading-relaxed space-y-6">
          <p>
            O estrabismo é uma das condições oftalmológicas mais comuns a nível
            global, afectando cerca de 2 a 4% da população. Apesar da sua
            prevalência, continua a ser frequentemente mal compreendido e
            envolto em estigma social, sobretudo quando visível desde a
            infância. Este artigo reúne, de forma acessível, a evidência
            científica sobre as suas causas, tipos, consequências e opções de
            tratamento.
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Eye className="w-6 h-6 text-teal shrink-0" />
            O que é o estrabismo?
          </h3>
          <p>
            O estrabismo consiste no desalinhamento dos eixos visuais: os dois
            olhos não fixam o mesmo ponto em simultâneo. Um dos olhos pode
            desviar-se para dentro, para fora, para cima ou para baixo,
            enquanto o outro mantém a fixação correcta. Este desvio pode ser
            constante ou intermitente, e pode alternar entre os dois olhos.
          </p>
          <p>
            A condição pode manifestar-se desde o nascimento ou desenvolver-se
            mais tarde, na infância ou já na idade adulta. O diagnóstico
            precoce, idealmente antes dos 6 anos, período crítico do
            desenvolvimento visual, é decisivo para evitar complicações que,
            passada essa janela, se tornam muito mais difíceis de reverter.
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Dna className="w-6 h-6 text-teal shrink-0" />
            Causas e Factores de Risco
          </h3>
          <p>
            As causas do estrabismo são variadas e, frequentemente,
            multifactoriais. Entre os factores mais determinantes destacam-se a
            predisposição genética e a história familiar da condição; os erros
            refractivos não corrigidos, em particular a hipermetropia
            acentuada, que obriga o sistema visual a um esforço de
            focagem (acomodação) capaz de desencadear o desvio; anomalias
            anatómicas ou funcionais dos músculos extraoculares; e lesões
            neurológicas que afectam os nervos cranianos responsáveis pela
            motricidade ocular.
          </p>
          <p>
            A prematuridade, o baixo peso à nascença e determinadas síndromes
            genéticas, como a Síndrome de Down, associam-se igualmente a um
            risco acrescido. Em alguns casos, o estrabismo surge como
            consequência de outras patologias oculares, como cataratas congénitas
            ou tumores intraoculares, por exemplo, que impedem a formação de
            uma imagem nítida e desencadeiam o desalinhamento como mecanismo
            compensatório.
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Layers className="w-6 h-6 text-teal shrink-0" />
            Tipos de Estrabismo
          </h3>
          <p>
            A classificação mais comum do estrabismo assenta na direcção do
            desvio ocular:
          </p>
          <ul className="list-disc pl-6 space-y-2 marker:text-teal">
            <li>
              <strong className="text-foreground">Esotropia</strong>: desvio
              do olho para dentro (convergente). É o tipo mais frequente na
              infância, representando cerca de 90% dos estrabismos infantis,
              e engloba formas precoces, tardias e acomodativas (associadas à
              hipermetropia).
            </li>
            <li>
              <strong className="text-foreground">Exotropia</strong>: desvio
              do olho para fora (divergente), frequentemente intermitente e
              agravado pela luz solar ou pelo cansaço.
            </li>
            <li>
              <strong className="text-foreground">Hipertropia</strong>:
              desvio do olho para cima.
            </li>
            <li>
              <strong className="text-foreground">Hipotropia</strong>: desvio
              do olho para baixo.
            </li>
          </ul>
          <p>
            Para além da direcção, o estrabismo classifica-se ainda quanto à
            frequência (constante ou intermitente), à lateralidade (unilateral
            ou alternante) e à idade de início (congénito ou adquirido). Cada
            subtipo exige uma avaliação específica, que influencia directamente
            o prognóstico e a abordagem terapêutica escolhida.
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <AlertTriangle className="w-6 h-6 text-teal shrink-0" />
            Consequências Clínicas e Psicossociais
          </h3>
          <p>
            A consequência clínica mais grave do estrabismo não tratado é a{" "}
            <strong className="text-foreground">ambliopia</strong>,
            popularmente conhecida como "olho preguiçoso". Perante duas
            imagens distintas e impossíveis de fundir, o cérebro suprime
            progressivamente a informação proveniente do olho desviado. Se
            esta supressão persistir durante o período crítico do
            desenvolvimento visual, que vai sensivelmente até aos 7-8
            anos, a perda de acuidade nesse olho pode tornar-se
            permanente, mesmo com correcção óptica adequada mais tarde.
          </p>
          <p>
            O desalinhamento impede ainda a fusão correcta das duas imagens
            retinianas, comprometendo o desenvolvimento da visão binocular e
            da estereopsia (a percepção de profundidade), com impacto em
            tarefas do quotidiano como a condução, a prática desportiva ou
            certas actividades profissionais.
          </p>
          <p>
            Para além da componente funcional, o impacto psicossocial é
            profundo e frequentemente subestimado. A literatura científica
            documenta de forma consistente que crianças com estrabismo
            visível são mais suscetíveis a bullying escolar e a dificuldades
            de integração social, enquanto adultos reportam desvantagens em
            entrevistas de emprego e nas interacções sociais do dia-a-dia. A
            auto-estima e a saúde mental são, com frequência, gravemente
            afectadas, uma vez que o desalinhamento ocular influencia
            negativamente a forma como terceiros percecionam competência,
            confiabilidade e atratividade.
          </p>

          <h3 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground !mt-12">
            <Stethoscope className="w-6 h-6 text-teal shrink-0" />
            Tratamento e Correcção
          </h3>
          <p>
            O tratamento do estrabismo é individualizado e combina, com
            frequência, mais do que uma abordagem, em função do tipo, do grau
            e da idade do doente:
          </p>
          <ul className="list-disc pl-6 space-y-2 marker:text-teal">
            <li>
              <strong className="text-foreground">Correcção óptica</strong> —
              óculos ou lentes de contacto para corrigir erros refractivos
              subjacentes, essencial sobretudo nas formas acomodativas,
              associadas à hipermetropia.
            </li>
            <li>
              <strong className="text-foreground">Oclusão (penso)</strong> —
              tapar o olho dominante para forçar o cérebro a utilizar e a
              desenvolver o olho mais fraco, tratando a ambliopia associada.
            </li>
            <li>
              <strong className="text-foreground">
                Toxina botulínica (Botox®)
              </strong>:{" "}
              injectada nos músculos extraoculares, enfraquece
              temporariamente a sua acção e permite corrigir determinados
              desvios horizontais, sobretudo em idades precoces.
            </li>
            <li>
              <strong className="text-foreground">
                Exercícios visuais (ortóptica)
              </strong>:{" "}
              terapia de reeducação para melhorar a coordenação binocular
              em casos seleccionados, nomeadamente na insuficiência de
              convergência.
            </li>
            <li>
              <strong className="text-foreground">Cirurgia</strong>: nos
              casos que não respondem ao tratamento conservador, o
              reposicionamento dos músculos extraoculares permite realinhar
              os eixos visuais, com taxas de sucesso mais elevadas quanto mais
              precoce for a intervenção.
            </li>
          </ul>
          <p>
            O tratamento da ambliopia deve, sempre que possível, ser iniciado
            antes dos 10 anos de idade, uma vez que a capacidade de
            recuperação da acuidade visual diminui significativamente após
            esta janela. Por isso, a vigilância oftalmológica regular na
            infância é a medida mais eficaz de prevenção das complicações a
            longo prazo.
          </p>

          <section className="!mt-16 pt-8 border-t border-border space-y-4 text-base">
            <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <BookOpen className="w-5 h-5 text-teal shrink-0" />
              Referências Bibliográficas
            </h3>
            <ul className="space-y-3">
              {references.map((ref, idx) => (
                <li key={idx}>
                  <a
                    href={ref.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2 text-teal hover:underline text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{ref.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </section>
  );
};

export default StrabismusSection;

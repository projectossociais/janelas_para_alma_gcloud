"""Reserva de perguntas do jogo "Inclusivamente" -- os dados e o seed.

Fonte única das 225 perguntas (15 patamares, 3 níveis, 6 categorias), usada
por três caminhos, todos idempotentes:

- a migração Alembic `e5b1c8d2a4f7` -- o deploy automático (`alembic
  upgrade head`) deixa a base de dados semeada e categorizada sozinho;
- `JogoService.nova_pergunta` -- rede de segurança em runtime: se um nível
  estiver vazio, semeia antes de desistir (ver `semear_perguntas` abaixo);
- `scripts/seed_maciço_perguntas.py` -- à mão, para quem preferir.

As perguntas vêm da documentação científica sobre estrabismo do projeto --
"Estrabismo para totós" (Machado & Gama, 2012), a dissertação histórica
"Breves considerações sobre o estrabismo" (1882) e o artigo "Estrabismos:
da teoria à prática" (Arq. Bras. Oftalmol., CBO 2009) -- reescritas aqui
como perguntas de escolha múltipla, não copiadas literalmente. As quatro
opções de cada pergunta são deliberadamente niveladas em comprimento e
estrutura gramatical -- nunca deve ser possível adivinhar a resposta certa
só por ser a única frase desenvolvida do conjunto.

Sem ORM de propósito (só SQLAlchemy Core, com a forma da tabela declarada
aqui): uma migração não pode depender de `orm_models.py`, que continua a
mudar depois dela. Acrescentar perguntas a `PERGUNTAS` mais tarde chega à
produção pela rede de segurança só se um nível ficar vazio -- para as
publicar a sério, uma migração nova que volte a chamar `semear_perguntas`.
"""

from dataclasses import dataclass

import sqlalchemy as sa
from sqlalchemy.engine import Connection

# Espelho de `CATEGORIAS_PERGUNTA_JOGO` / `CATEGORIA_PERGUNTA_POR_OMISSAO` em
# `orm_models.py` (e do CHECK `ck_perguntas_jogo_categoria`) -- um teste
# garante que não divergem.
CATEGORIAS = (
    "anatomia_ocular",
    "doencas_estrabismo",
    "prevencao_cuidados",
    "estilo_vida_visao",
    "ciencia_ocular",
    "curiosidades_visuais",
)
CATEGORIA_POR_OMISSAO = "curiosidades_visuais"

# Chave do `pg_advisory_xact_lock` que serializa seeds simultâneos (dois
# pedidos a cair na rede de segurança ao mesmo tempo, ou pedido + migração)
# -- sem isto, os dois viam a tabela vazia e inseriam as 225 duas vezes.
_CHAVE_BLOQUEIO_SEED = 7_310_225

_perguntas_jogo = sa.table(
    "perguntas_jogo",
    sa.column("texto_pergunta", sa.Text),
    sa.column("opcao_a", sa.Text),
    sa.column("opcao_b", sa.Text),
    sa.column("opcao_c", sa.Text),
    sa.column("opcao_d", sa.Text),
    sa.column("resposta_correta", sa.Enum("A", "B", "C", "D", name="resposta_opcao", create_type=False)),
    sa.column("nivel_dificuldade", sa.Integer),
    sa.column("explicacao", sa.Text),
    sa.column("categoria", sa.Text),
)


@dataclass(frozen=True)
class PerguntaSeed:
    texto_pergunta: str
    opcao_a: str
    opcao_b: str
    opcao_c: str
    opcao_d: str
    resposta_correta: str
    nivel_dificuldade: int
    explicacao: str
    # Uma das 6 categorias oficiais (`CATEGORIAS_PERGUNTA_JOGO`).
    categoria: str = CATEGORIA_POR_OMISSAO


PERGUNTAS: list[PerguntaSeed] = [
    # === Nível 1 (patamares 1-5, 500 Kz a 5.000 Kz) ==========================
    # Conceitos básicos, definições simples de estrabismo, óculos e saúde
    # visual geral -- fonte principal: "Estrabismo para totós".
    PerguntaSeed(
        "O que é o estrabismo, em termos simples?",
        "Uma alteração na cor da íris causada pela idade",
        "Uma infeção da conjuntiva transmitida por contacto",
        "Um desalinhamento dos eixos visuais dos dois olhos",
        "Um aumento sustentado da pressão intraocular",
        "C",
        1,
        "Classicamente definido como uma rutura no equilíbrio das forças musculares que "
        "sustentam a visão binocular, traduzida numa desarmonia do alinhamento dos eixos visuais.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Como se chama o desvio ocular que só aparece quando se rompe a fusão binocular "
        "(por exemplo, ao tapar um dos olhos), não estando presente com os dois olhos abertos?",
        "Tropia, um desvio sempre manifesto e visível",
        "Ambliopia, uma redução da visão num só olho",
        "Foria, um desvio latente controlado pela fusão",
        "Ptose, a queda da pálpebra superior do olho",
        "C",
        1,
        "A foria é um desvio latente, só visível quando a binocularidade é rompida (teste do "
        "'uncover'); a tropia é um desvio manifesto, presente mesmo com os dois olhos a par.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Até aos 3 anos de idade, qual é um dos principais motivos de consulta em oftalmologia "
        "pediátrica que, afinal, não é um verdadeiro estrabismo?",
        "Ambliopia profunda de um dos dois olhos",
        "A síndrome de Duane, de origem congénita",
        "Pseudoestrabismo, por exemplo por pregas largas do epicanto",
        "Catarata congénita presente desde o nascimento",
        "C",
        1,
        "As pregas de epicanto podem dar a falsa impressão de um olho desviado; o teste de "
        "Hirschberg confirma que o alinhamento ocular está, na realidade, normal.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "As dores de cabeça (cefaleias) numa criança são, segundo a evidência disponível:",
        "O sintoma mais fiável de que a criança precisa de óculos",
        "Sempre e inequivocamente um sinal claro de estrabismo",
        "Raramente causadas por erros refractivos, apesar da crença popular",
        "Um sinal exclusivo e específico da presença de miopia",
        "C",
        1,
        "Os estudos que tentam ligar cefaleias a erros refractivos são inconclusivos; cefaleias "
        "matinais, progressivas e com náuseas justificam observação por suspeita de outra causa.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Ver filmes em 3D faz mal à visão de uma criança?",
        "Sim, provoca sempre lesões irreversíveis na retina",
        "Sim, porque aumenta de forma sustentada a pressão intraocular",
        "Não; no máximo pode cansar quem tem pouca amplitude de fusão binocular",
        "Não tem absolutamente qualquer relação com a visão binocular",
        "C",
        1,
        "Os óculos 3D usam lentes polarizadas que enviam imagens diferentes a cada olho; isso "
        "pode cansar quem tem baixa amplitude de fusão, mas não causa dano ocular.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Por que é que a hipermetropia é considerada 'fisiológica' numa criança pequena?",
        "Porque todas as crianças acabam inevitavelmente por ficar cegas",
        "Porque, ao contrário do que se pensa, não tem qualquer tratamento possível",
        "Porque é o estado refractivo mais comum nessa idade e tende a reduzir-se com o "
        "crescimento (emetropização)",
        "Porque é sempre e sem exceção sinal de doença ocular grave",
        "C",
        1,
        "A refração média nas crianças anda à volta de +2,00D; com o crescimento do olho "
        "(aumento do comprimento axial), a refração tende para a emetropia.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é a emetropização?",
        "A cirurgia usada especificamente para corrigir o estrabismo",
        "A perda de visão causada por privação sensorial prolongada",
        "O processo natural pelo qual a refração do olho evolui em direção à emetropia com o "
        "crescimento",
        "O uso terapêutico de toxina botulínica no músculo ocular",
        "C",
        1,
        "Ocorre por mudanças estruturais do olho ao longo do crescimento: o comprimento axial "
        "aumenta e as curvaturas da córnea e do cristalino diminuem.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Um pai conta que o filho 'se debruça sobre os cadernos' para ler. Isso deve-se, "
        "sobretudo, a:",
        "Um estrabismo já numa fase considerada grave",
        "Uma cegueira noturna presente desde a infância",
        "O exercício normal da acomodação, um hábito que tende a desaparecer com a idade",
        "Uma reação alérgica ocular de origem sazonal",
        "C",
        1,
        "É uma competência (a acomodação) que todos exercitámos nessa fase; não deixa de ser "
        "boa ideia corrigir a postura, mas não é sinal de doença ocular.",
        categoria="estilo_vida_visao",
    ),
    PerguntaSeed(
        "Que estrutura do olho é responsável pela acomodação (focar objectos próximos)?",
        "A íris, através da regulação do tamanho da pupila",
        "A esclera, através do seu revestimento resistente",
        "O músculo ciliar, que altera a curvatura do cristalino",
        "O nervo óptico, através da transmissão do sinal visual",
        "C",
        1,
        "A contração do músculo ciliar, do tipo esfíncter, relaxa as fibras da zónula e permite "
        "ao cristalino aumentar a sua curvatura.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Quando os dois pais são míopes, qual é a percentagem aproximada de filhos que também "
        "podem vir a ser míopes, citada na avaliação da história familiar?",
        "Até cerca de 10% dos filhos, segundo esta avaliação",
        "Praticamente 100% dos filhos, sem qualquer exceção",
        "Até cerca de 50% dos filhos, segundo esta avaliação",
        "Praticamente 0% dos filhos, independentemente do contexto",
        "C",
        1,
        "A história familiar de miopia é um dos itens recolhidos na consulta, precisamente por "
        "este peso hereditário relatado.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Até que idade aproximada costuma ser possível recuperar a acuidade visual perdida por "
        "ambliopia (o chamado 'olho preguiçoso')?",
        "Até aos 2 anos de idade, apenas nesse curto período",
        "Só é possível tratar já na idade adulta da pessoa",
        "Até aos 10 anos, altura a partir da qual a capacidade de recuperação diminui muito",
        "Não há, segundo esta visão, qualquer limite de idade",
        "C",
        1,
        "O tratamento da ambliopia deve começar o mais cedo possível; passada essa janela, a "
        "resposta ao tratamento piora significativamente.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Qual é o tratamento da ambliopia considerado mais eficaz, apesar de ser mal tolerado "
        "por algumas crianças (e alguns pais)?",
        "Colírios anti-inflamatórios aplicados de forma regular",
        "Exercícios de leitura em voz alta feitos diariamente",
        "O penso oclusivo, tapando o olho com melhor visão",
        "Óculos de sol escuros usados durante o dia inteiro",
        "C",
        1,
        "Ao forçar o uso do olho amblíope, o penso oclusivo é o método com melhor eficácia "
        "demonstrada, embora a adesão nem sempre seja fácil.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que distingue, de forma simples, a miopia da hipermetropia quanto à visão de perto?",
        "A hipermetropia, segundo esta ideia, só existe em pessoas já bastante idosas",
        "São, na prática, exactamente a mesma condição visual, apenas com nomes diferentes",
        "A miopia costuma permitir alguma visão nítida de perto; a hipermetropia acentuada "
        "dificulta a nitidez tanto de perto como ao longe",
        "A miopia nunca está, em qualquer circunstância possível, associada a ambliopia",
        "C",
        1,
        "Por isso a hipermetropia bilateral acentuada é uma causa mais frequente de ambliopia "
        "refractiva do que a miopia.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual destas NÃO consta entre as causas clássicas de ambliopia?",
        "Ambliopia estrábica, causada pelo próprio desvio ocular",
        "Ambliopia refractiva, causada por ametropia ou anisometropia",
        "Ambliopia de privação, causada por exemplo por catarata congénita",
        "Ambliopia causada pelo uso excessivo e prolongado de ecrãs",
        "D",
        1,
        "As categorias clássicas são estrábica, refractiva, de privação e idiopática; passar "
        "horas em frente a um ecrã não é, por si só, causa de ambliopia.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Por que motivo se pergunta, na história clínica de uma criança com desvio ocular, se "
        "houve complicações peri-parto como hemorragias intracranianas?",
        "Porque essas complicações são, na verdade, irrelevantes para o estrabismo",
        "Porque só interessam ao pediatra, e nunca ao oftalmologista",
        "Porque essas patologias podem estar associadas a miopia, estrabismo e atraso de "
        "desenvolvimento",
        "Porque causam sempre, de forma inevitável, cegueira total e imediata",
        "C",
        1,
        "Antecedentes peri-parto e sinais neurológicos associados podem ajudar a guiar o "
        "diagnóstico de fundo por trás de um estrabismo.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Numa criança com visão binocular normal, por volta de que idade se espera já haver um "
        "bom alinhamento ocular?",
        "Logo ao nascimento, de forma já plenamente madura",
        "Apenas entre os 4 e os 6 anos de idade",
        "Por volta dos 4 a 6 meses de idade",
        "Só já na fase da adolescência da criança",
        "C",
        1,
        "É também a partir daqui que se desenvolve a fusão e a estereopsia, num período crítico "
        "que se estende até aos dois anos de idade.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O que avalia, na prática, o 'teste do olhar preferencial' com cartões de Teller, usado "
        "em bebés?",
        "A pressão intraocular registada em cada um dos olhos",
        "A tonalidade de cor apresentada pela retina do bebé",
        "Uma estimativa comparativa da acuidade visual entre os dois olhos",
        "O reflexo pupilar direto do bebé perante a luz",
        "C",
        1,
        "É mais útil para comparar os dois olhos entre si do que para obter um valor absoluto "
        "de acuidade visual equivalente ao Snellen.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Para além da história clínica e do exame dos movimentos oculares, qual exame nunca "
        "deve ser esquecido numa consulta de estrabismo pediátrico, por poder revelar doenças "
        "graves do fundo do olho?",
        "O teste de audição feito em contexto pediátrico",
        "A medição simples da temperatura corporal da criança",
        "A fundoscopia, observando o disco óptico e a mácula",
        "A pesagem de rotina da criança durante a consulta",
        "C",
        1,
        "Há relatos de ambliopias 'tratadas' sem nunca se ter visualizado o fundo ocular, "
        "atrasando o diagnóstico de uma doença ocular verdadeira.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual destas estruturas do olho é responsável por dar cor à íris e regular, através da "
        "pupila, a quantidade de luz que entra?",
        "A córnea, na parte frontal e transparente do olho",
        "A esclera, na parte externa e resistente do olho",
        "A íris, com os seus músculos esfíncter e dilatador",
        "A retina, na parte interna e sensível do olho",
        "C",
        1,
        "A íris contém os músculos esfíncter e dilatador que ajustam o diâmetro pupilar consoante a luz ambiente.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "O que é, em termos simples, a esclera?",
        "O nervo que liga o olho diretamente ao cérebro",
        "A camada mais interna do olho, sensível à luz",
        "A parte branca e resistente que reveste a maior parte do globo ocular",
        "A glândula responsável pela produção das lágrimas",
        "C",
        1,
        "A esclera dá forma e proteção mecânica ao olho, sendo contínua com a córnea na parte anterior.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Qual é a função do nervo óptico?",
        "Produzir as lágrimas que protegem o olho",
        "Focar diretamente a luz recebida na retina",
        "Dar cor à íris consoante o pigmento",
        "Transmitir a informação captada pela retina até ao cérebro",
        "D",
        1,
        "É este feixe de fibras nervosas que transporta o sinal visual da retina até ao córtex occipital.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Por que motivo se costuma recomendar que crianças façam pausas regulares ao usar "
        "tablets ou telemóveis durante muito tempo?",
        "Porque aumentam de forma definitiva a pressão intraocular",
        "Porque os ecrãs provocam sempre, inevitavelmente, cegueira",
        "Para prevenir fadiga ocular e reduzir o esforço continuado de acomodação",
        "Porque são a única e exclusiva causa da miopia",
        "C",
        1,
        "O uso contínuo e próximo de ecrãs está associado a fadiga ocular, ainda que a evidência sobre o seu papel causal na miopia seja debatida.",
        categoria="estilo_vida_visao",
    ),
    PerguntaSeed(
        "Que hábito simples ajuda a repor a lubrificação natural da superfície do olho durante "
        "tarefas visuais concentradas, como ler ou usar um ecrã?",
        "Esfregar os olhos com força quando estão cansados",
        "Reduzir deliberadamente ao mínimo a frequência do piscar",
        "Piscar conscientemente com mais frequência ao longo do dia",
        "Aumentar sempre o brilho do ecrã ao valor máximo",
        "C",
        1,
        "A concentração numa tarefa visual reduz naturalmente a frequência do piscar espontâneo, sendo útil compensar de forma consciente.",
        categoria="estilo_vida_visao",
    ),
    PerguntaSeed(
        "A chamada regra '20-20-20', popularmente usada para prevenir fadiga ocular associada a "
        "ecrãs, propõe o quê?",
        "Fazer vinte exercícios oculares diferentes logo ao acordar de manhã",
        "Usar óculos escuros durante vinte minutos seguidos por dia",
        "A cada vinte minutos, olhar vinte segundos para algo distante",
        "Piscar exatamente vinte vezes a cada minuto de trabalho",
        "C",
        1,
        "É uma regra prática, sem base numa evidência muito rigorosa, mas útil como lembrete para descansar o foco de perto.",
        categoria="estilo_vida_visao",
    ),
    PerguntaSeed(
        "O que distingue, de forma simples, a miopia da hipermetropia?",
        "São exatamente a mesma condição, apenas com nomes diferentes",
        "A miopia nunca é, em circunstância alguma, corrigível com óculos",
        "A hipermetropia só existe, segundo esta ideia, depois dos 60 anos",
        "A miopia é dificuldade em ver ao longe; a hipermetropia é, tipicamente, maior dificuldade em focar de perto",
        "D",
        1,
        "São os dois erros refrativos mais comuns, resultantes de uma desproporção entre o comprimento do olho e o seu poder refrativo.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é o astigmatismo, em termos simples?",
        "Uma reação alérgica ocular de carácter sazonal",
        "Uma infeção bacteriana localizada na córnea",
        "Uma curvatura irregular da córnea (ou do cristalino) que distorce a imagem formada na retina",
        "A perda total e definitiva da visão de cor",
        "C",
        1,
        "Por a córnea não ter a mesma curvatura em todas as direções, a luz não converge num único ponto focal.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que tipo de lentes são geralmente usadas para corrigir a miopia?",
        "Lentes convexas, que convergem a luz antes do olho",
        "Lentes exclusivamente coloridas, sem qualquer poder refrativo",
        "Lentes sem qualquer curvatura de correção associada",
        "Lentes côncavas, que divergem a luz antes de esta entrar no olho",
        "D",
        1,
        "As lentes côncavas (negativas) afastam o ponto de foco, compensando o alongamento típico do olho míope.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Que tipo de lentes são geralmente usadas para corrigir a hipermetropia?",
        "Lentes côncavas, que divergem a luz antes do olho",
        "Lentes sem qualquer curvatura de correção associada",
        "Lentes coloridas, usadas apenas por motivos estéticos",
        "Lentes convexas, que convergem a luz antes de esta entrar no olho",
        "D",
        1,
        "As lentes convexas (positivas) adiantam o ponto de foco, compensando o esforço de acomodação da hipermetropia.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, na prática, a ambliopia, popularmente chamada de 'olho preguiçoso'?",
        "Uma infeção contagiosa transmitida entre crianças",
        "Uma cor de olhos rara transmitida geneticamente",
        "Um tipo específico de armação usada em óculos",
        "Uma redução da visão num olho por falta de estímulo visual adequado durante o desenvolvimento",
        "D",
        1,
        "Sem um estímulo visual nítido na infância, a via visual desse olho pode nunca se desenvolver plenamente.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é o tratamento clássico mais eficaz da ambliopia, apesar de exigir boa adesão da "
        "criança?",
        "Antibióticos orais, administrados durante várias semanas seguidas",
        "Gotas usadas exclusivamente para dilatar a pupila do olho",
        "Cirurgia considerada obrigatória em absolutamente todos os casos",
        "O penso oclusivo, tapando o olho bom para forçar o uso do mais fraco",
        "D",
        1,
        "Ao obrigar o cérebro a usar o olho amblíope, o penso oclusivo continua a ser a base do tratamento na maioria dos casos.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Além da oclusão, que fármaco é por vezes usado para borrar temporariamente a visão do "
        "olho bom no tratamento da ambliopia?",
        "O paracetamol, usado normalmente para a dor",
        "A insulina, usada normalmente na diabetes",
        "A atropina, aplicada em colírio no olho bom",
        "A amoxicilina, usada normalmente em infeções",
        "C",
        1,
        "A atropina desfoca a visão de perto do olho bom, incentivando o cérebro a preferir o olho amblíope.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, em termos gerais, o pseudoestrabismo?",
        "Um estrabismo já numa fase grave e permanente",
        "Um tipo raro e pouco comum de catarata congénita",
        "Um sinónimo pouco rigoroso e impreciso de ambliopia",
        "A aparência de um desvio ocular quando, na realidade, o alinhamento dos eixos visuais está correto",
        "D",
        1,
        "É frequentemente causado por pregas largas de epicanto, que escondem parte da esclera nasal e dão uma falsa impressão de desvio.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Por que é importante um exame oftalmológico em idade pré-escolar, mesmo sem queixas "
        "aparentes da criança?",
        "Porque, na verdade, não tem qualquer utilidade prática",
        "Porque substitui totalmente a necessidade de vacinas",
        "Porque é apenas uma formalidade sem valor clínico real",
        "Porque muitos problemas visuais na infância, como a ambliopia, não causam queixas percetíveis pela própria criança",
        "D",
        1,
        "Crianças pequenas raramente se queixam de má visão, sobretudo quando o problema afeta apenas um dos olhos.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que avalia, de forma simples, um teste de acuidade visual com uma tabela de letras "
        "(como a de Snellen)?",
        "A pressão registada dentro do globo ocular",
        "A capacidade auditiva periférica da pessoa examinada",
        "A tonalidade de cor apresentada pela retina examinada",
        "A nitidez com que a pessoa consegue distinguir símbolos a uma distância padrão",
        "D",
        1,
        "É o teste mais clássico e difundido para quantificar a qualidade da visão central de cada olho.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Segundo a literatura de divulgação sobre saúde visual usada como base deste jogo, que "
        "fração aproximada da informação que recebemos do mundo chega até nós através da visão?",
        "Cerca de 10% de toda a informação recebida",
        "Cerca de 35% de toda a informação recebida",
        "Praticamente 0% de toda a informação recebida",
        "Cerca de 80% de toda a informação recebida",
        "D",
        1,
        "É por isso que qualquer problema visual não corrigido pode ter um impacto tão significativo na aprendizagem e no dia a dia.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "O que é a retina, em termos simples?",
        "A parte branca e resistente que reveste o olho por fora",
        "A abertura central da íris, chamada de pupila",
        "O músculo que move o olho lateralmente para os lados",
        "A camada na parte de trás do olho que capta a luz e a transforma em sinais nervosos",
        "D",
        1,
        "É na retina, sobretudo na zona da mácula, que se forma a imagem que depois é enviada ao cérebro.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Por que motivo a pupila fica mais pequena quando há muita luz ambiente?",
        "Para proteger o cristalino do calor emitido pela luz",
        "Para aumentar artificialmente a nitidez das cores percebidas",
        "Para reduzir a quantidade de luz que entra no olho, protegendo a retina",
        "Para ajudar na lubrificação geral da superfície do olho",
        "C",
        1,
        "Este reflexo pupilar à luz (miose) é uma resposta automática, mediada pelo sistema nervoso autónomo.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "O que é, basicamente, a acomodação visual?",
        "A produção contínua das lágrimas que protegem o olho",
        "A cirurgia usada especificamente para corrigir o estrabismo",
        "A capacidade do olho ajustar o foco para ver nitidamente a diferentes distâncias",
        "A perceção das cores captadas pelos cones da retina",
        "C",
        1,
        "A acomodação depende sobretudo da mudança de curvatura do cristalino, controlada pelo músculo ciliar.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Um pai refere que o filho aproxima muito o rosto do caderno para ler. Isto deve-se, na "
        "maioria das vezes, a:",
        "Um estrabismo já numa fase considerada grave e urgente",
        "Uma infeção ocular contagiosa e de fácil transmissão",
        "Uma cegueira noturna presente desde o próprio nascimento",
        "O exercício normal da acomodação, um hábito que tende a desaparecer com a idade",
        "D",
        1,
        "Ainda assim, vale a pena confirmar com um exame de rotina que não há nenhum erro refrativo por trás do hábito.",
        categoria="estilo_vida_visao",
    ),
    PerguntaSeed(
        "Até que idade aproximada é geralmente mais eficaz tratar a ambliopia?",
        "Só depois de completar dezoito anos de idade",
        "Apenas antes de a criança completar um ano",
        "Não há, segundo esta ideia, qualquer limite de idade",
        "Durante a infância, idealmente antes dos 7 a 10 anos",
        "D",
        1,
        "Existe um período crítico de desenvolvimento visual, findo o qual a capacidade de recuperação da visão diminui muito.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, em termos simples, a hipermetropia?",
        "A incapacidade quase total de ver qualquer cor",
        "Uma alteração considerada exclusiva da terceira idade",
        "Um tipo específico e pouco comum de estrabismo",
        "Uma dificuldade em focar objetos próximos, porque a imagem tende a formar-se atrás da retina",
        "D",
        1,
        "Sem esforço de acomodação, a imagem forma-se atrás da retina, tornando a visão de perto mais difícil.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual destas NÃO é uma boa prática recomendada para a saúde ocular no dia a dia?",
        "Fazer pausas regulares sempre que se usam ecrãs",
        "Ler sempre com uma iluminação ambiente adequada",
        "Consultar um oftalmologista com uma regularidade adequada",
        "Esfregar os olhos com força quando estão cansados",
        "D",
        1,
        "Esfregar os olhos com força pode irritar a superfície ocular e, em casos raros, lesar a córnea.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que faz, basicamente, a glândula lacrimal?",
        "Controla o movimento dos olhos em todas as direções",
        "Foca diretamente a luz recebida sobre a retina",
        "Produz as lágrimas que lubrificam e protegem a superfície do olho",
        "Dá cor à íris consoante o pigmento presente",
        "C",
        1,
        "As lágrimas produzidas pela glândula lacrimal lubrificam, nutrem e protegem a córnea e a conjuntiva.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Uma criança com estrabismo raramente se queixa de visão dupla, ao contrário do que "
        "acontece tipicamente num adulto com um desvio ocular recente. Por que motivo?",
        "Porque as crianças, de um modo geral, não sentem qualquer desconforto",
        "Porque o estrabismo infantil nunca chega a afetar a visão binocular",
        "Porque as crianças têm sempre e invariavelmente uma visão perfeita",
        "Porque o cérebro da criança tende a suprimir ativamente a imagem do olho desviado",
        "D",
        1,
        "Esta supressão é uma adaptação do cérebro ainda em desenvolvimento para evitar a confusão de duas imagens diferentes.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual destas causas de ambliopia resulta do próprio estrabismo, e não de um erro "
        "refrativo?",
        "A ambliopia dita refrativa, sem componente estrábico",
        "A ambliopia dita idiopática, de causa desconhecida",
        "A ambliopia de privação, por catarata congénita",
        "A ambliopia dita estrábica, causada pelo próprio desvio",
        "D",
        1,
        "Na ambliopia estrábica, é a supressão contínua da imagem do olho desviado que impede o seu desenvolvimento visual normal.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é uma causa clássica de ambliopia de privação numa criança pequena?",
        "Uma reação alérgica de carácter sazonal e ligeiro",
        "O uso apenas ocasional de óculos de sol escuros",
        "Uma catarata congénita que não chegou a ser tratada",
        "Uma dieta considerada pobre em vitamina C",
        "C",
        1,
        "Ao bloquear a entrada de uma imagem nítida durante o período crítico, a catarata congénita pode causar ambliopia grave.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, em termos simples, um exame de refração?",
        "Um exame que mede diretamente a pressão dentro do olho",
        "Um exame que observa diretamente o estado da retina",
        "Um exame reservado exclusivamente à avaliação da audição",
        "Um exame que determina o grau de óculos ou lentes necessário para uma visão nítida",
        "D",
        1,
        "É a partir deste exame que se prescreve a graduação correta de óculos ou lentes de contacto.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual destas estruturas NÃO faz parte da anatomia do olho?",
        "A córnea, na parte frontal e transparente do olho",
        "A retina, na parte interna e sensível do olho",
        "O tímpano, uma estrutura pertencente ao ouvido",
        "A íris, responsável pela cor característica do olho",
        "C",
        1,
        "O tímpano pertence ao ouvido, sem qualquer relação com a anatomia ocular.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "O que é, na prática, o 'campo visual'?",
        "A cor predominante presente no ambiente observado",
        "Um sinónimo pouco rigoroso do termo acuidade visual",
        "A área total que o olho consegue ver sem mover a cabeça nem os olhos",
        "A distância exata que separa o olho do objeto observado",
        "C",
        1,
        "Inclui tanto a visão central como toda a visão periférica captada numa única fixação do olhar.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Por que motivo os óculos de sol de má qualidade, sem proteção UV adequada, podem ser "
        "prejudiciais?",
        "Porque causam sempre uma catarata em apenas poucos dias",
        "Porque aumentam sempre, de forma sustentada, a pressão intraocular",
        "Porque escurecem a visão sem filtrar a radiação ultravioleta, levando a pupila a dilatar-se e a receber mais UV",
        "Porque não têm, na verdade, qualquer efeito, bom ou mau",
        "C",
        1,
        "A escuridão da lente dilata a pupila; sem filtro UV adequado, isso pode aumentar a exposição nociva à radiação ultravioleta.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, em termos simples, a presbiopia?",
        "Um tipo de estrabismo típico da primeira infância",
        "Exatamente o mesmo problema óptico que o astigmatismo",
        "Uma infeção viral que afeta diretamente o olho",
        "A perda gradual, com a idade, da capacidade de focar bem objetos próximos",
        "D",
        1,
        "Com a idade, o cristalino perde elasticidade e a acomodação para perto torna-se progressivamente mais difícil.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é, em geral, o erro refrativo fisiológico mais comum numa criança muito pequena?",
        "Uma miopia já bastante elevada nesta idade",
        "Um astigmatismo irregular já bastante grave",
        "Hipermetropia ligeira, considerada normal nesta idade",
        "Presbiopia, ainda invulgar em crianças pequenas",
        "C",
        1,
        "A maioria das crianças nasce com uma hipermetropia ligeira que tende a diminuir com o crescimento (emetropização).",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O que é a anisometropia, em termos simples?",
        "Uma reação alérgica associada ao uso de óculos",
        "A perda total e definitiva da visão de um olho",
        "Um tipo específico e pouco comum de daltonismo",
        "Uma diferença significativa de grau entre os dois olhos",
        "D",
        1,
        "Quando os dois olhos têm graus muito diferentes, o cérebro tende a favorecer o de melhor imagem, podendo causar ambliopia.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é a esclerótica, também chamada esclera?",
        "A camada colorida do olho, ao redor da pupila",
        "A abertura central da pupila, dentro da íris",
        "O músculo que controla o reflexo de piscar",
        "O invólucro externo, fibroso e resistente, que reveste e protege o globo ocular",
        "D",
        1,
        "A esclera dá forma e proteção mecânica ao olho, sendo visível como a 'parte branca' do olho.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "O que é, na prática, a conjuntiva?",
        "A camada mais profunda e sensível da retina",
        "O músculo responsável por mover o olho para cima",
        "A membrana fina e transparente que reveste a parte branca do olho e a face interna das pálpebras",
        "O canal responsável por drenar as lágrimas do olho",
        "C",
        1,
        "A conjuntivite, muito comum, é precisamente a inflamação desta membrana.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Qual é, na prática, o objetivo de um teste de rastreio visual feito na escola?",
        "Substituir totalmente a necessidade de consulta oftalmológica",
        "Avaliar apenas a altura e o peso corporal da criança",
        "Diagnosticar exclusivamente problemas relacionados com a audição",
        "Identificar precocemente crianças com sinais de alerta que devam ser encaminhadas para avaliação especializada",
        "D",
        1,
        "É um primeiro filtro simples e rápido, não um diagnóstico definitivo.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Segundo os princípios gerais de saúde visual pediátrica, a partir de que altura se "
        "recomenda a primeira avaliação oftalmológica de uma criança, mesmo sem sintomas?",
        "Só se houver, entretanto, queixas explicitamente relatadas",
        "Só depois de a criança completar dez anos de idade",
        "Ainda nos primeiros anos de vida da criança",
        "Só depois de a criança entrar na universidade",
        "C",
        1,
        "A deteção precoce de problemas visuais é essencial, dado o período crítico de desenvolvimento da visão nos primeiros anos.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, de forma simples, um erro refrativo?",
        "Um sinónimo pouco rigoroso e impreciso do termo estrabismo",
        "Uma infeção bacteriana que afeta diretamente o olho todo",
        "Uma alteração na forma como a luz é focada dentro do olho, impedindo uma imagem nítida",
        "Uma reação alérgica de carácter sazonal e bastante ligeiro",
        "C",
        1,
        "Miopia, hipermetropia e astigmatismo são as três formas mais comuns de erro refrativo.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Como se costuma chamar, popularmente, ao uso combinado de óculos para perto e para "
        "longe na mesma armação?",
        "Lentes de contacto rígidas, usadas em astigmatismo elevado",
        "Lentes fotocromáticas, que escurecem consoante a luz ambiente",
        "Óculos bifocais ou multifocais, com duas ou mais zonas de grau",
        "Lentes polarizadas, usadas sobretudo ao ar livre",
        "C",
        1,
        "São muito usados a partir da idade em que a presbiopia se soma a um erro refrativo já existente.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é a principal diferença prática entre óculos e lentes de contacto?",
        "As lentes de contacto nunca conseguem corrigir o astigmatismo",
        "Os óculos existem, na prática, apenas para uso estético",
        "As lentes de contacto corrigem a visão diretamente sobre a superfície do olho, sem armação",
        "Não existe, na verdade, qualquer diferença relevante entre os dois",
        "C",
        1,
        "Por ficarem em contacto direto com o olho, as lentes de contacto exigem mais cuidados de higiene do que os óculos.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Uma criança que estreita muito os olhos para ver ao longe pode estar a compensar, "
        "sobretudo, que erro refrativo?",
        "O daltonismo, uma alteração na perceção de cor",
        "A presbiopia, associada ao envelhecimento do cristalino",
        "A miopia, associada a um alongamento do olho",
        "A conjuntivite, uma inflamação comum da conjuntiva",
        "C",
        1,
        "Estreitar os olhos ('semicerrar as pálpebras') reduz ligeiramente a dispersão da luz, ajudando temporariamente a focar melhor um objeto distante quando há miopia.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual destas situações justifica encaminhamento urgente a um oftalmologista numa "
        "criança pequena?",
        "Um espirro ocasional, sem qualquer outro sintoma associado",
        "Uma assimetria no reflexo vermelho dos olhos, observada numa fotografia com flash",
        "Uma pequena mancha de sujidade visível na roupa da criança",
        "Um bocejo mais frequente do que o habitual na criança",
        "B",
        1,
        "Uma assimetria no reflexo vermelho pode indicar doenças oculares graves, como catarata congénita ou retinoblastoma.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, em termos simples, a diplopia?",
        "Ver tudo consistentemente desfocado apenas de perto",
        "Perder por completo a visão periférica de ambos os olhos",
        "Ver o mesmo objeto de forma duplicada, ou seja, visão dupla",
        "Deixar de conseguir distinguir corretamente as cores vivas",
        "C",
        1,
        "A diplopia surge quando as imagens dos dois olhos não caem em pontos retinianos correspondentes.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um estrabismo que aparece só de vez em quando, por exemplo quando a criança está "
        "cansada, chama-se:",
        "Estrabismo permanente, presente em todas as situações",
        "Estrabismo intermitente, que alterna com o alinhamento normal",
        "Estrabismo paralítico, causado por uma lesão nervosa",
        "Nistagmo, um movimento rítmico e involuntário dos olhos",
        "B",
        1,
        "O estrabismo intermitente alterna entre períodos de bom alinhamento e períodos de desvio manifesto.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, em termos simples, a esotropia?",
        "Um desvio ocular para fora, afastando-se do nariz",
        "Um desvio ocular vertical, com um olho mais alto",
        "Um desvio ocular para dentro, em direção ao nariz",
        "A ausência total de qualquer desvio ocular presente",
        "C",
        1,
        "Na esotropia, um ou ambos os olhos desviam-se para dentro, em direção ao nariz.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, em termos simples, a exotropia?",
        "Um desvio ocular para dentro, em direção ao nariz",
        "Um desvio ocular para fora, afastando-se do nariz",
        "Um desvio ocular puramente vertical, sem componente lateral",
        "Um sinónimo pouco preciso do termo ambliopia",
        "B",
        1,
        "Na exotropia, o olho desvia-se para fora, afastando-se do nariz.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um desvio vertical, em que um olho fica mais alto do que o outro, chama-se:",
        "Esotropia, um desvio para dentro em direção ao nariz",
        "Exotropia, um desvio para fora, afastando-se do nariz",
        "Hipertropia, um desvio vertical entre os dois olhos",
        "Ambliopia, uma redução da visão num só olho",
        "C",
        1,
        "Os desvios verticais (hipertropias/hipotropias) são menos frequentes do que os horizontais.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, na prática, o 'teste de cover' (tapar e destapar um olho)?",
        "Um exame de audição disfarçado de teste ocular",
        "Um teste que avalia se existe um desvio ocular, observando o olho destapado",
        "Uma medição direta e imediata da pressão intraocular",
        "Um teste simples que avalia a tonalidade de cor da retina",
        "B",
        1,
        "Ao tapar um olho e observar o outro, deteta-se um eventual desvio (tropia ou foria).",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual profissional está mais indicado para diagnosticar e tratar o estrabismo?",
        "Um dentista, especializado em saúde dentária",
        "Um fisioterapeuta, especializado em reabilitação física",
        "Um oftalmologista, especializado em saúde ocular",
        "Um nutricionista, especializado em alimentação",
        "C",
        1,
        "O oftalmologista é o médico especializado em diagnosticar e tratar doenças e desvios oculares.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que faz, tipicamente, um ortoptista, em articulação com o oftalmologista?",
        "Realiza sozinho cirurgias oculares consideradas complexas",
        "Prescreve medicamentos destinados a doenças sistémicas",
        "Fabrica lentes de contacto sob medida para o paciente",
        "Avalia e trata problemas de alinhamento ocular e de visão binocular",
        "D",
        1,
        "O ortoptista é um técnico especializado na avaliação da motilidade ocular e da visão binocular, trabalhando junto do oftalmologista.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, de forma simples, o daltonismo?",
        "Uma forma grave e completa de cegueira total",
        "Uma infeção ocular contagiosa e de fácil transmissão",
        "Um tipo específico de óculos usado sob luz forte",
        "Uma dificuldade em distinguir corretamente certas cores",
        "D",
        1,
        "É uma alteração, geralmente hereditária, na perceção de certas cores, que não afeta a nitidez da visão.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que tipo de células da retina são responsáveis pela visão das cores e pela visão "
        "detalhada em boas condições de luz?",
        "Os bastonetes, sensíveis sobretudo à pouca luz",
        "Os cones, sensíveis às diferentes cores da luz",
        "As células ganglionares, apenas, sem outra função",
        "As células da córnea, na parte frontal do olho",
        "B",
        1,
        "Os cones são responsáveis pela visão das cores e pela visão detalhada em boas condições de luz.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Os bastonetes da retina são sobretudo importantes para:",
        "Perceber cores vivas em pleno meio-dia",
        "Ler textos com letras muito pequenas",
        "A visão em condições de pouca luz ambiente",
        "Perceber a profundidade em visão binocular",
        "C",
        1,
        "Os bastonetes são muito sensíveis à luz mas não distinguem cores, sendo essenciais à visão noturna.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Qual é a forma mais comum de daltonismo?",
        "Incapacidade total de perceber qualquer cor existente",
        "Dificuldade em perceber apenas a cor azul",
        "Visão limitada exclusivamente ao preto e ao branco",
        "Dificuldade em distinguir entre o vermelho e o verde",
        "D",
        1,
        "A deficiência na perceção do vermelho-verde é, de longe, a forma mais frequente de daltonismo.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um bebé que ainda não fala pode ter a sua visão avaliada sobretudo através de que "
        "método?",
        "Análises de sangue realizadas em laboratório",
        "Um exame radiológico simples da cabeça",
        "Observação do comportamento de fixação e seguimento visual de um objeto",
        "Só é possível avaliar depois dos dez anos de idade",
        "C",
        1,
        "Em bebés, a avaliação é sobretudo qualitativa, com base no comportamento visual observado durante a consulta.",
        categoria="prevencao_cuidados",
    ),
    # === Nível 2 (patamares 6-10, 7.500 Kz a 50.000 Kz) ======================
    # Clínica intermédia: Hirschberg, cover test, ambliopia mais detalhada,
    # prismas e toxina botulínica.
    PerguntaSeed(
        "Em que se baseia o teste de Hirschberg?",
        "Na medição direta e imediata da pressão intraocular",
        "Na posição do reflexo luminoso corneano em relação à pupila",
        "Na velocidade de resposta da pupila perante a luz",
        "No tempo de reação da pessoa ao próprio pestanejo",
        "B",
        2,
        "O reflexo não é, na verdade, corneano, mas sim uma imagem virtual localizada atrás da "
        "pupila; a sua posição permite inferir o desvio ocular.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "No teste de Hirschberg, um reflexo luminoso localizado no bordo do limbo (cerca de "
        "45º) corresponde a um desvio aproximado de quantas dioptrias prismáticas?",
        "Cerca de dez dioptrias prismáticas, segundo a tabela clássica",
        "Cerca de cem dioptrias prismáticas, segundo a tabela clássica",
        "Cerca de cinco dioptrias prismáticas, segundo a tabela clássica",
        "Cerca de quinhentas dioptrias prismáticas, segundo a tabela clássica",
        "B",
        2,
        "A tabela clássica de conversão do teste de Hirschberg associa o limbo a cerca de 45º, "
        "equivalente a aproximadamente 100 dioptrias prismáticas.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O teste de Krimsky é especialmente útil em que situação?",
        "Quando se suspeita clinicamente de um glaucoma congénito",
        "Para medir diretamente a pressão dentro do olho",
        "Quando a criança não colabora com o cover test ou não tem fixação, como em ambliopia profunda",
        "Para avaliar especificamente a tonalidade de cor da íris",
        "C",
        2,
        "Coloca-se um prisma em frente ao olho fixador (não ao desviado), quantificando o "
        "desvio com base no reflexo de Hirschberg.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é a principal diferença entre o teste de 'cover' e o teste de 'uncover'?",
        "O cover deteta forias, enquanto o uncover deteta tropias",
        "O cover deteta tropias (desvios manifestos); o uncover deteta forias (desvios latentes)",
        "São, na prática clínica, exactamente o mesmo teste",
        "O cover só pode ser realizado em pacientes já adultos",
        "B",
        2,
        "No cover, observa-se o olho destapado à procura de movimento; no uncover, observa-se o "
        "olho que estava tapado ao retirar a oclusão.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "No cover test alternado, o que é essencial garantir durante a manobra?",
        "Que a criança feche voluntariamente os dois olhos ao mesmo tempo",
        "Que se oclua, durante todo o teste, apenas o olho direito",
        "Que a oclusão dure pelo menos 1 a 2 segundos em cada olho, para romper completamente "
        "a binocularidade",
        "Que se use, durante todo o teste, exclusivamente luz ultravioleta",
        "C",
        2,
        "É preciso rapidez na troca de olho, mas permanência suficiente em cada um para romper "
        "de facto a fusão binocular.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Para que serve, especificamente, o 'cover test prismático'?",
        "Para detetar especificamente cataratas de origem congénita",
        "Para quantificar o desvio, interpondo prismas progressivamente até o anular ou "
        "inverter",
        "Para medir diretamente a pressão registada dentro do olho",
        "Para diagnosticar especificamente um quadro de glaucoma",
        "B",
        2,
        "É a técnica mais precisa de quantificação do desvio entre as variantes do cover test.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é o mecanismo de ação da toxina botulínica tipo A quando injetada num músculo "
        "extraocular?",
        "Aumenta a libertação de acetilcolina na junção neuromuscular",
        "Inibe a libertação de acetilcolina, ao clivar proteínas do complexo SNARE (SNAP-25)",
        "Bloqueia diretamente os recetores de dopamina do músculo",
        "Destrói de forma permanente as fibras musculares do olho",
        "B",
        2,
        "Ao impedir a fusão das vesículas de acetilcolina com a membrana neuronal, a toxina "
        "impede a contração muscular, causando uma paralisia transitória.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Depois de uma injeção de toxina botulínica num músculo ocular, até quanto tempo se "
        "podem ainda detetar moléculas da toxina na fenda sináptica?",
        "Apenas durante alguns minutos após a injeção",
        "Até cerca de seis semanas após a injeção",
        "Durante vários anos após a injeção realizada",
        "Nunca chega, na prática, a ser detetável",
        "B",
        2,
        "Os mecanismos exactos de recuperação da função muscular não são totalmente "
        "conhecidos, apesar deste efeito ser transitório.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Que bactéria produz a toxina botulínica usada terapeuticamente em oftalmologia?",
        "A bactéria Staphylococcus aureus, comum na pele",
        "A bactéria Clostridium botulinum, anaeróbia e esporulada",
        "A bactéria Escherichia coli, comum no intestino",
        "A bactéria Streptococcus pneumoniae, respiratória",
        "B",
        2,
        "É um bacilo gram-negativo, esporulado e anaeróbio.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Dos sete serotipos conhecidos de toxina botulínica (A a G), qual é o usado com fins "
        "terapêuticos em oftalmologia?",
        "O serotipo F, sem qualquer aplicação oftalmológica",
        "O serotipo C, sem qualquer aplicação oftalmológica",
        "O serotipo A, o único com aplicação oftalmológica",
        "O serotipo G, sem qualquer aplicação oftalmológica",
        "C",
        2,
        "Apenas a toxina botulínica tipo A (TBA) tem aplicação terapêutica oftalmológica.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é a equivalência de dose aproximada entre as duas marcas comerciais de toxina "
        "botulínica mais usadas?",
        "Uma unidade de Botox equivale a uma de Dysport",
        "Uma unidade de Botox equivale a três de Dysport",
        "Uma unidade de Botox equivale a dez de Dysport",
        "Uma unidade de Botox equivale a meia de Dysport",
        "B",
        2,
        "Esta equivalência é importante para não haver erro de dosagem ao trocar de marca.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual erro refractivo é mais frequentemente associado a ambliopia bilateral quando "
        "acentuado nos dois olhos?",
        "A miopia, quando presente de forma acentuada",
        "A hipermetropia, quando presente de forma acentuada",
        "Um astigmatismo misto, apenas quando ligeiro",
        "A presbiopia, uma alteração típica já da idade adulta",
        "B",
        2,
        "A hipermetropia acentuada impede uma imagem nítida tanto de longe como de perto, ao "
        "contrário da miopia, que permite normalmente algum grau de visão de perto.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que instrumento é tipicamente usado, junto com uma fonte de luz, na realização dos "
        "testes do reflexo luminoso (Hirschberg e Krimsky)?",
        "Um tonómetro, usado normalmente para medir pressão",
        "Uma barra de prismas horizontais e verticais",
        "Um perímetro de Goldmann, usado normalmente no campo visual",
        "Apenas uma lâmpada de fenda, sem qualquer outro instrumento",
        "B",
        2,
        "É com a barra de prismas que se quantifica o desvio observado pelo reflexo luminoso.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Até que idade se recomenda, de forma sistemática, realizar a refração sob cicloplegia "
        "numa criança?",
        "Até cerca de um ano de idade da criança",
        "Até cerca dos cinco anos de idade da criança",
        "Até cerca dos quinze anos de idade da criança",
        "A cicloplegia nunca é, na verdade, necessária",
        "B",
        2,
        "Antes desta idade é muito difícil confirmar com testes subjectivos que a criança vê "
        "bem; depois, a maioria já colabora de forma fiável.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual fármaco cicloplégico tem o pico de ação mais rápido (30 minutos a 1 hora) e "
        "menor duração de efeito do que a atropina?",
        "A atropina, usada como referência de comparação",
        "O ciclopentolato, mais rápido e de efeito mais curto",
        "A pilocarpina, um fármaco de ação diferente",
        "O timolol, um fármaco de ação diferente",
        "B",
        2,
        "Por ser mais rápido e ter efeito mais curto, o ciclopentolato é preferido na prática "
        "diária face à atropina.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Por que motivo a atropina deve ser usada com particular cautela em crianças com "
        "Síndrome de Down?",
        "Porque, na verdade, não tem qualquer efeito nesses doentes",
        "Porque estas crianças são descritas como mais sensíveis aos seus efeitos",
        "Porque cura, segundo esta ideia, o estrabismo nesses casos",
        "Porque não existe, de facto, formulação pediátrica do fármaco",
        "B",
        2,
        "É uma das populações de risco assinaladas junto com prematuros de baixo peso e "
        "insuficientes cardíacos.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um ângulo kappa 'positivo' (reflexo desviado no sentido nasal) pode ser confundido, à "
        "primeira vista, com qual desvio verdadeiro?",
        "Uma esotropia, com o olho desviado para dentro",
        "Uma exotropia, com o olho desviado para fora",
        "Uma hipertropia, com um olho mais alto que o outro",
        "Um nistagmo, com um movimento rítmico e involuntário",
        "B",
        2,
        "O cover test distingue os dois quadros: no ângulo kappa a fixação mantém-se ao tapar "
        "o olho adelfo; na exotropia verdadeira, o olho desviado retoma o alinhamento.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "No pseudoestrabismo por pregas de epicanto, o que é característico observar-se no "
        "teste de Hirschberg?",
        "O reflexo luminoso mostra, de facto, um desalinhamento verdadeiro",
        "O reflexo confirma a manutenção do alinhamento ocular, apesar da aparência de "
        "estrabismo",
        "O teste, na verdade, não pode ser realizado nesses casos",
        "O reflexo luminoso desaparece por completo durante o teste",
        "B",
        2,
        "É precisamente essa manutenção do reflexo centrado que permite tranquilizar os pais "
        "de que não há, de facto, estrabismo.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é a esotropia acomodativa refrativa, um dos quadros mais comuns de estrabismo "
        "infantil?",
        "Uma paralisia isolada do nervo abducente do olho",
        "Um desvio para fora causado por uma miopia elevada",
        "Um desvio para dentro desencadeado pelo esforço de acomodação associado a uma "
        "hipermetropia não corrigida",
        "Um sinónimo pouco rigoroso de ambliopia de privação",
        "C",
        2,
        "Ao corrigir a hipermetropia com óculos, o esforço de acomodação (e a convergência associada) diminui, podendo reduzir ou eliminar o desvio.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é a relação neurológica entre acomodação e convergência que explica o estrabismo "
        "acomodativo?",
        "Não existe, na prática clínica, qualquer ligação entre os dois mecanismos",
        "A acomodação e a convergência estão ligadas por uma relação neural (AC/A), de modo que o foco arrasta a convergência",
        "A convergência controla, segundo esta ideia, apenas o tamanho da pupila",
        "A acomodação, segundo esta ideia, só ocorre durante o sono profundo",
        "B",
        2,
        "Uma relação AC/A anormalmente elevada é, em muitos casos, o mecanismo por trás do estrabismo acomodativo não puramente refrativo.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que distingue a esotropia acomodativa 'pura' da esotropia acomodativa com componente "
        "'não acomodativo' (parcialmente acomodativa)?",
        "A forma parcialmente acomodativa nunca chega a responder a óculos",
        "Na forma pura, a cirurgia é considerada sempre a primeira opção",
        "São, na prática clínica, exactamente a mesma entidade",
        "Na forma parcialmente acomodativa, os óculos não corrigem totalmente o desvio, restando algum ângulo residual",
        "D",
        2,
        "Distinguir estas formas é importante porque só a componente não acomodativa poderá necessitar de tratamento cirúrgico.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, na prática, a 'ambliopia por anisometropia'?",
        "Um sinónimo pouco rigoroso de estrabismo paralítico",
        "Uma ambliopia causada exclusivamente por uma catarata",
        "Uma ambliopia que, segundo esta ideia, só ocorre em adultos",
        "Uma ambliopia causada por diferença de grau significativa entre os dois olhos",
        "D",
        2,
        "O cérebro tende a favorecer o olho com a imagem mais nítida, negligenciando o olho com maior erro refrativo não corrigido.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que grau aproximado de diferença de astigmatismo entre os dois olhos já é, por si só, "
        "considerado clinicamente significativo como fator de risco de ambliopia?",
        "Apenas quando a diferença ultrapassa vinte dioptrias",
        "Apenas quando a diferença ultrapassa dez dioptrias",
        "Não existe, na prática clínica, qualquer valor de referência",
        "Cerca de uma dioptria e meia a duas dioptrias cilíndricas",
        "D",
        2,
        "Diferenças de astigmatismo relativamente pequenas entre os dois olhos já podem ser suficientes para gerar ambliopia se não corrigidas a tempo.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que avalia especificamente o 'teste de Bruckner', usando o oftalmoscópio direto a "
        "alguma distância da criança?",
        "A temperatura corporal registada durante todo o exame",
        "A pressão registada dentro de cada globo ocular",
        "A capacidade auditiva periférica da criança examinada",
        "A simetria do reflexo vermelho entre os dois olhos, útil para rastrear várias doenças",
        "D",
        2,
        "Uma assimetria no brilho ou na cor do reflexo entre os dois olhos é um sinal de alerta que orienta investigação adicional.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "No teste de Bruckner, um reflexo mais brilhante no olho desviado, comparado com o olho "
        "fixador, é compatível com que achado?",
        "Uma catarata presente de forma bilateral e simétrica",
        "Um estrabismo, já que o olho desviado não está a fixar corretamente o alvo luminoso",
        "Uma miopia muito ligeira, sem qualquer outro achado",
        "Uma conjuntivite de origem alérgica e sazonal",
        "B",
        2,
        "A assimetria de brilho no reflexo relaciona-se com a diferença de fixação entre os dois olhos.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que instrumento simples, além da barra de prismas, é habitualmente usado no cover test "
        "para captar a atenção de uma criança pequena?",
        "Um termómetro digital, usado noutro contexto clínico",
        "Um estetoscópio, usado noutro contexto clínico",
        "Um diapasão, usado noutro contexto clínico",
        "Um alvo de fixação acomodativo, como um brinquedo pequeno e apelativo",
        "D",
        2,
        "Um alvo acomodativo (que exige atenção e foco, e não apenas uma luz) obtém um resultado de cover test mais fiável.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Por que se prefere, sempre que possível, um alvo acomodativo (e não apenas uma luz) "
        "durante o cover test?",
        "Porque, na verdade, não há qualquer vantagem prática nisso",
        "Porque, segundo esta ideia, as luzes danificam a retina",
        "Porque um alvo acomodativo é, apenas, mais barato de obter",
        "Porque assim se avalia o desvio nas condições reais de esforço de acomodação do dia a dia",
        "D",
        2,
        "Um desvio acomodativo pode não se manifestar totalmente perante uma simples luz, que exige pouco esforço de foco.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Uma 'foria' descompensada, isto é, que deixa de ser controlável pela fusão binocular, "
        "pode evoluir clinicamente para:",
        "Uma presbiopia precoce, associada ao cristalino",
        "Uma catarata súbita, sem qualquer relação com a foria",
        "Um daltonismo adquirido já na idade adulta",
        "Uma tropia manifesta, com sintomas como diplopia intermitente ou fadiga visual",
        "D",
        2,
        "Quando o mecanismo de fusão já não consegue compensar o desvio latente, este pode tornar-se manifesto (tropia).",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, na prática clínica, a 'amplitude de fusão'?",
        "A duração média habitual de uma consulta oftalmológica",
        "A distância máxima considerada confortável para a leitura",
        "O tamanho que a pupila atinge em midríase máxima",
        "A capacidade do sistema visual compensar um certo grau de desvio latente para manter a "
        "visão binocular única",
        "D",
        2,
        "Uma amplitude de fusão reduzida torna mais provável que uma foria se descompense em tropia.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Qual é o principal objetivo dos exercícios ortópticos (terapia visual) em casos "
        "selecionados de insuficiência de convergência?",
        "Eliminar por completo a necessidade de exames futuros",
        "Substituir definitivamente o uso de óculos em qualquer erro refrativo",
        "Curar, segundo esta ideia, o daltonismo hereditário",
        "Melhorar a capacidade de convergência e a amplitude de fusão através de treino repetido",
        "D",
        2,
        "A terapia ortóptica é uma das abordagens de primeira linha para a insuficiência de convergência sintomática.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, na prática, um 'prisma de Fresnel', por vezes aplicado temporariamente sobre "
        "uma lente de óculos?",
        "Um instrumento cirúrgico usado apenas na cirurgia de catarata",
        "Um tipo de lente de contacto rígida usada em astigmatismo",
        "Um colírio anestésico usado antes de exames oculares",
        "Uma película fina, com sulcos prismáticos, que pode ser colada à lente para compensar um desvio ou uma diplopia",
        "D",
        2,
        "Por ser removível e ajustável, é útil para testar o efeito de uma correção prismática antes de a incorporar de forma permanente.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Em que situação clínica um prisma incorporado permanentemente nos óculos pode ser "
        "usado, em vez de cirurgia, para tratar um pequeno desvio ocular?",
        "Apenas em desvios que ultrapassem cinquenta dioptrias prismáticas",
        "Sempre, independentemente da magnitude real do desvio",
        "Nunca é usado, na verdade, com esse propósito clínico",
        "Quando o desvio é pequeno e estável, e o prisma consegue eliminar a diplopia associada",
        "D",
        2,
        "Prismas são particularmente úteis em pequenos desvios verticais ou em desvios de longa data já bem compensados sensorialmente.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é a síndrome de Duane, um exemplo clássico de estrabismo restritivo/inervacional "
        "congénito?",
        "Um sinónimo pouco rigoroso de presbiopia precoce e infantil",
        "Um tipo raro de catarata adquirida ao longo da vida",
        "Uma reação alérgica de carácter sazonal e recorrente",
        "Uma malformação congénita da inervação de certos músculos, com limitação da abdução",
        "D",
        2,
        "Resulta de uma inervação anómala dos músculos extraoculares, e não de uma verdadeira paralisia do nervo abducente.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O que caracteriza a síndrome de Brown, outro exemplo clássico de estrabismo restritivo?",
        "Um daltonismo hereditário ligado diretamente ao cromossoma X",
        "Uma paralisia total do nervo oculomotor do olho afetado",
        "Uma catarata bilateral presente desde o próprio nascimento",
        "Uma limitação da elevação do olho em adução, por restrição do tendão do oblíquo superior",
        "D",
        2,
        "Ao contrário de uma paralisia nervosa, a síndrome de Brown resulta de uma restrição mecânica do próprio tendão.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é a principal diferença entre um estrabismo 'restritivo' e um 'paralítico'?",
        "O paralítico, segundo esta ideia, nunca chega a causar diplopia",
        "São, na prática clínica, sinónimos exatos, sem qualquer diferença",
        "O restritivo, segundo esta ideia, só costuma ocorrer em adultos",
        "No restritivo há um impedimento mecânico ao músculo; no paralítico há falta de inervação",
        "D",
        2,
        "Esta distinção é essencial para decidir a abordagem cirúrgica mais adequada a cada caso.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um teste de 'ducção forçada', feito sob anestesia tópica ou geral, ajuda a distinguir "
        "que dois tipos de estrabismo?",
        "O estrabismo congénito, distinguindo-o do estrabismo adquirido mais tarde",
        "O estrabismo concomitante, distinguindo-o do estrabismo intermitente comum",
        "O estrabismo refrativo, distinguindo-o do estrabismo acomodativo típico",
        "O restritivo, com resistência mecânica ao movimento, do paralítico, sem essa resistência",
        "D",
        2,
        "Ao tentar mover passivamente o olho com uma pinça, a presença de resistência sugere uma causa restritiva, e não puramente paralítica.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que exame de imagem é por vezes solicitado perante um estrabismo paralítico de início "
        "súbito num adulto, para excluir causas neurológicas graves?",
        "Um eletrocardiograma, usado normalmente na avaliação cardíaca",
        "Uma radiografia do tórax, usada normalmente na avaliação pulmonar",
        "Uma ecografia abdominal, usada normalmente na avaliação digestiva",
        "Uma ressonância magnética ou tomografia computorizada cranianas",
        "D",
        2,
        "Um estrabismo paralítico súbito num adulto pode, nalguns casos, ser o primeiro sinal de uma lesão neurológica que exige investigação urgente.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Uma paralisia isolada do nervo abducente (VI par) causa tipicamente que desvio ocular?",
        "Nenhum desvio percetível ao exame clínico habitual",
        "Uma exotropia, com o olho desviado para fora",
        "Uma hipertropia isolada, sem componente horizontal associado",
        "Uma esotropia, por perda da função de abdução do olho afetado",
        "D",
        2,
        "Sem a ação do reto lateral, o olho não consegue abduzir normalmente, ficando relativamente desviado para dentro.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Uma paralisia isolada do nervo troclear (IV par) afeta principalmente que músculo?",
        "O oblíquo inferior, responsável pela elevação em adução",
        "O reto lateral, responsável pela abdução do olho",
        "O reto medial, responsável pela adução do olho",
        "O oblíquo superior, responsável pela depressão em adução",
        "D",
        2,
        "É a paralisia de nervo craniano mais comum na motilidade ocular, frequentemente de causa congénita ou traumática.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um doente com paralisia do oblíquo superior costuma adotar espontaneamente que posição "
        "compensatória da cabeça?",
        "Nenhuma posição compensatória costuma ser observada",
        "Uma extensão acentuada do pescoço, projetado para trás",
        "Uma rotação completa da cabeça para o mesmo lado, sem inclinação",
        "Inclinação da cabeça para o lado oposto ao músculo afetado",
        "D",
        2,
        "Esta inclinação compensatória (tilt de Bielschowsky) reduz a diplopia vertical/torcional associada à paralisia.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O 'teste de inclinação da cabeça de Bielschowsky' é usado sobretudo para localizar que "
        "tipo de paralisia?",
        "A paralisia do nervo trigémeo, responsável pela sensibilidade facial",
        "A paralisia do nervo facial, responsável pela mímica facial",
        "A paralisia do nervo abducente, responsável pela abdução do olho",
        "A paralisia do músculo oblíquo superior, através da inclinação da cabeça",
        "D",
        2,
        "Ao inclinar a cabeça para cada lado, observa-se em qual delas a hipertropia se agrava, ajudando a identificar o músculo parético.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Uma paralisia completa do nervo oculomotor (III par) tipicamente NÃO afeta qual destes "
        "músculos?",
        "O reto inferior, normalmente afetado nesta paralisia",
        "O reto medial, normalmente afetado nesta paralisia",
        "O reto superior, normalmente afetado nesta paralisia",
        "O reto lateral, poupado por depender do nervo abducente",
        "D",
        2,
        "O reto lateral (inervado pelo VI par) e o oblíquo superior (inervado pelo IV par) são poupados numa paralisia isolada do III par.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Além da limitação de vários movimentos oculares, uma paralisia completa do III par "
        "costuma incluir que outras duas manifestações características?",
        "Uma queda de cabelo localizada numa zona específica",
        "Uma surdez súbita acompanhada de vertigem intensa",
        "Uma perda total e súbita do sentido do olfato",
        "Ptose palpebral e midríase, ou seja, a pupila dilatada",
        "D",
        2,
        "A ptose resulta da paralisia do levantador da pálpebra; a midríase, da paralisia das fibras parassimpáticas que acompanham o III par.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Numa criança com estrabismo, a chamada 'posição compensatória da cabeça' (torcicolo "
        "ocular) serve tipicamente para quê?",
        "Compensar uma perda auditiva associada ao quadro clínico",
        "Melhorar exclusivamente a postura geral da coluna vertebral",
        "Não tem, na verdade, qualquer função visual associada",
        "Reduzir o desvio ou a diplopia, colocando os olhos numa posição de olhar mais confortável",
        "D",
        2,
        "É importante distinguir um torcicolo de causa ocular de um torcicolo de causa muscular ou ortopédica.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é o principal risco de não corrigir cirurgicamente uma síndrome de Duane com "
        "torcicolo compensatório muito acentuado e mantido na infância?",
        "Alterações posturais secundárias, como assimetrias faciais ou da coluna cervical",
        "Uma perda total e definitiva da audição da criança",
        "O aparecimento de um daltonismo adquirido na criança",
        "Não existe, segundo esta ideia, qualquer risco reconhecido",
        "A",
        2,
        "Um torcicolo mantido durante o crescimento pode, nalguns casos, contribuir para assimetrias faciais ou posturais.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Um estrabismo que surge subitamente numa criança mais velha ou num adulto, sem história "
        "prévia, deve sempre motivar a exclusão de que tipo de causa?",
        "Uma causa neurológica ou sistémica subjacente, como um tumor ou uma diabetes descompensada",
        "Uma simples reação alérgica de carácter sazonal",
        "Um excesso de tempo de ecrã, sem outra investigação necessária",
        "Uma dieta desequilibrada, sem necessidade de mais investigação",
        "A",
        2,
        "Ao contrário do estrabismo concomitante típico da infância, um início súbito de causa incomitante exige uma investigação mais cuidadosa.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que doença sistémica crónica é um fator de risco reconhecido para paralisias agudas de "
        "nervos cranianos que controlam os movimentos oculares?",
        "A diabetes mellitus, reconhecida como fator de risco",
        "Uma anemia ferropénica de carácter ligeiro",
        "Uma rinite alérgica de carácter sazonal",
        "Uma urticária de carácter crónico e recorrente",
        "A",
        2,
        "A diabetes é uma causa reconhecida de mononeuropatias cranianas isoladas, incluindo dos nervos III, IV e VI.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Uma paralisia do III par causada por diabetes tem, tipicamente, uma característica "
        "distintiva importante para o diagnóstico diferencial. Qual?",
        "Costuma poupar a função pupilar, ao contrário de causas compressivas como um aneurisma",
        "Afeta sempre e exclusivamente a pupila, nunca os músculos oculares",
        "Nunca causa, na verdade, qualquer limitação de movimento ocular",
        "Cura-se sempre, sem exceção, em menos de vinte e quatro horas",
        "A",
        2,
        "Esta distinção ('poupança pupilar') é clinicamente relevante para distinguir uma causa microvascular de uma causa compressiva mais urgente.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é, na prática clínica, o significado de uma paralisia do III par que afeta também "
        "a pupila (com midríase), num adulto?",
        "Aumenta a suspeita de uma causa compressiva, como um aneurisma, exigindo investigação urgente",
        "É, segundo esta ideia, sempre um sinal totalmente benigno",
        "Indica, segundo esta ideia, sempre uma simples fadiga ocular",
        "É, na prática clínica, irrelevante para a decisão a tomar",
        "A",
        2,
        "O envolvimento pupilar é um sinal de alarme clássico que orienta para investigação de imagem urgente.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é o 'nistagmo', em termos simples?",
        "Um movimento oscilatório, rítmico e involuntário dos olhos",
        "Um sinónimo exato e rigoroso do termo estrabismo",
        "Uma infeção crónica que afeta diretamente a córnea",
        "Um tipo raro e pouco comum de catarata precoce",
        "A",
        2,
        "O nistagmo pode ser congénito ou adquirido, e nem sempre está associado a estrabismo, ainda que possa coexistir com ele.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um nistagmo congénito costuma, em muitos casos, apresentar que característica "
        "particular quanto à visão do doente?",
        "Uma amplitude que diminui numa posição de olhar, a 'posição de bloqueio', usada para ver melhor",
        "Uma perda total e definitiva da visão do doente",
        "Uma ausência completa de qualquer sintoma visual associado",
        "Uma cura espontânea garantida antes de completar um ano",
        "A",
        2,
        "Muitas crianças com nistagmo congénito adotam uma posição de cabeça específica para colocar os olhos na 'zona de bloqueio' de menor oscilação.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Em que contexto pode a toxina botulínica ser usada no tratamento do nistagmo, para "
        "além do estrabismo?",
        "Em casos selecionados de nistagmo incapacitante, para reduzir a amplitude das oscilações",
        "Nunca é usada, na verdade, nesse contexto clínico",
        "Apenas em crianças com menos de um ano de idade",
        "Apenas como tratamento de carácter puramente estético",
        "A",
        2,
        "É um uso mais restrito e específico, reservado a casos selecionados, e não uma primeira linha de tratamento do nistagmo.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é a principal diferença entre um 'nistagmo sensorial' e um 'nistagmo motor "
        "congénito idiopático'?",
        "O sensorial resulta de uma doença ocular que reduz a visão; o motor idiopático não tem causa sensorial identificável",
        "São, na prática clínica, exatamente a mesma condição",
        "O nistagmo sensorial, segundo esta ideia, só ocorre em adultos",
        "O nistagmo motor idiopático é, segundo esta ideia, sempre causado por trauma",
        "A",
        2,
        "Esta distinção orienta a investigação: o nistagmo sensorial exige procurar ativamente uma doença ocular subjacente que explique a má visão.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que exame é fundamental realizar perante uma criança pequena com nistagmo de início "
        "recente, para excluir uma causa grave subjacente?",
        "Um exame oftalmológico completo, incluindo fundoscopia e avaliação neurológica",
        "Apenas uma análise de sangue feita por rotina",
        "Apenas uma radiografia simples do tórax da criança",
        "Nenhum exame é, na verdade, geralmente necessário",
        "A",
        2,
        "O nistagmo de início na infância pode, nalguns casos, ser o primeiro sinal de uma doença ocular ou neurológica que precisa de ser identificada.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que avalia, de forma simples, a 'estereopsia', testada por exemplo com o teste de "
        "Titmus ou de Lang?",
        "A pressão registada dentro do globo ocular",
        "A perceção de profundidade resultante da fusão binocular",
        "A tonalidade de cor apresentada pela íris examinada",
        "A capacidade de enxergar razoavelmente bem no escuro",
        "B",
        2,
        "A estereopsia é a forma mais fina de perceção de profundidade, exigindo boa visão e fusão binocular.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Por volta de que idade se espera já estar presente uma estereopsia mensurável numa "
        "criança com desenvolvimento visual normal?",
        "Só depois dos dez anos de idade da criança",
        "Por volta dos quatro a seis meses de idade",
        "Só já na idade adulta da pessoa em causa",
        "Logo ao nascimento, de forma já plenamente madura",
        "B",
        2,
        "É também nesta janela etária que se espera o alinhamento ocular normal e o início da fusão binocular.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Que teste simples de estereopsia, usado em consultório, usa óculos polarizados para "
        "ver imagens em relevo (como uma mosca)?",
        "O teste de Ishihara, usado para rastrear o daltonismo",
        "O teste de Titmus, usado para avaliar a estereopsia",
        "O teste de Snellen, usado para medir a acuidade visual",
        "O teste de Hirschberg, usado para avaliar o alinhamento",
        "B",
        2,
        "O teste de Titmus é um dos testes de estereopsia mais usados em consultório oftalmológico.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, na prática, a 'correspondência retiniana anómala', uma adaptação sensorial do "
        "estrabismo de longa data?",
        "Uma reorganização da correspondência entre pontos das duas retinas, para manter alguma fusão",
        "Uma doença infecciosa que afeta diretamente a retina do olho",
        "Um sinónimo direto e rigoroso do termo catarata congénita",
        "Uma alteração de carácter exclusivamente estético da córnea",
        "A",
        2,
        "É uma adaptação sensorial distinta da simples supressão, mais frequente em estrabismos concomitantes de longa duração.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O 'escotoma de supressão' corresponde a que fenómeno sensorial no estrabismo?",
        "Uma zona da retina do olho desviado cuja imagem é ativamente ignorada pelo cérebro",
        "Uma opacidade permanente localizada na córnea do olho",
        "Uma alteração pontual e transitória da pressão intraocular",
        "Um aumento sustentado na produção de lágrimas do olho",
        "A",
        2,
        "É esta supressão ativa que evita a diplopia na maioria das crianças com estrabismo, mas que pode conduzir a ambliopia se mantida.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um adulto que desenvolve subitamente um desvio ocular queixa-se tipicamente de "
        "diplopia, ao contrário de uma criança pequena. Por que motivo?",
        "O cérebro adulto já não tem a mesma plasticidade para suprimir facilmente uma das imagens",
        "Os adultos têm sempre, de um modo geral, pior acuidade visual",
        "A diplopia, segundo esta ideia, só existe fisiologicamente em adultos",
        "As crianças, segundo esta ideia, nunca têm retina funcional nos dois olhos",
        "A",
        2,
        "A capacidade de supressão cortical diminui com a maturação do sistema visual, tornando a diplopia mais provável e persistente no adulto.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é a 'visão binocular única normal', o objetivo funcional último do tratamento do "
        "estrabismo?",
        "A perceção de uma única imagem nítida e tridimensional, resultante da fusão correta das imagens dos dois olhos",
        "A visão exclusiva e isolada por um único olho dominante",
        "Um sinónimo pouco rigoroso de acuidade visual de vinte por vinte",
        "A ausência total de qualquer desvio latente, ou seja, de qualquer foria",
        "A",
        2,
        "É este o objetivo funcional ideal, para além do simples alinhamento estético dos olhos.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Numa criança operada a estrabismo, por que motivo o resultado sensorial (fusão, "
        "estereopsia) pode ser mais importante do que o simples alinhamento estético dos olhos?",
        "Porque a função visual binocular tem impacto direto na perceção de profundidade e no desenvolvimento visual global da criança",
        "Porque o aspeto estético é, na verdade, totalmente irrelevante clinicamente",
        "Porque a fusão nunca se recupera, segundo esta ideia, após qualquer cirurgia",
        "Porque a estereopsia não tem, segundo esta ideia, qualquer utilidade prática",
        "A",
        2,
        "O objetivo ideal do tratamento vai além do cosmético, procurando também restaurar, sempre que possível, a função binocular.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Um doente com boa fusão sensorial antes de desenvolver um estrabismo paralítico tem, em "
        "geral, um prognóstico funcional pós-tratamento:",
        "Geralmente melhor do que um doente com estrabismo desde a infância, sem nunca ter tido fusão normal",
        "Sempre pior, independentemente de qualquer outro fator considerado",
        "Idêntico, sem qualquer diferença clinicamente relevante entre os dois",
        "Impossível de prever, segundo esta ideia, em qualquer circunstância",
        "A",
        2,
        "Ter tido fusão binocular normal antes do desvio é um fator prognóstico favorável para a recuperação funcional após o tratamento.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que avalia, na prática, um 'sinoptóforo', instrumento clássico usado em ortóptica?",
        "A fusão, a amplitude de fusão e a estereopsia, apresentando imagens ligeiramente diferentes a cada olho",
        "A pressão registada dentro do globo ocular examinado",
        "A capacidade auditiva periférica do doente examinado",
        "A temperatura registada na superfície da córnea",
        "A",
        2,
        "O sinoptóforo permite medir com precisão o ângulo objetivo e subjetivo do desvio, além de avaliar a função binocular.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Num sinoptóforo, a diferença entre o 'ângulo objetivo' e o 'ângulo subjetivo' medidos no "
        "mesmo doente pode indicar a presença de que fenómeno sensorial?",
        "Uma correspondência retiniana anómala entre os dois olhos",
        "Uma catarata presente de forma bilateral no doente",
        "Uma paralisia localizada no nervo facial do doente",
        "Uma reação alérgica de carácter ocular e sazonal",
        "A",
        2,
        "Quando os dois ângulos não coincidem, isso sugere uma readaptação sensorial da correspondência retiniana.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é a principal vantagem de operar precocemente uma esotropia infantil (congénita), "
        "em vez de esperar vários anos?",
        "Aumentar a probabilidade de alguma recuperação de fusão binocular, dado o período crítico do desenvolvimento visual",
        "Reduzir apenas e exclusivamente o custo final da cirurgia",
        "Evitar exclusivamente o uso de óculos no futuro da criança",
        "Não existe, segundo esta ideia, qualquer vantagem em operar cedo",
        "A",
        2,
        "Quanto mais cedo se corrige o alinhamento, maior a janela de oportunidade para algum grau de desenvolvimento binocular.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Que fator torna, em geral, mais difícil recuperar boa fusão binocular numa esotropia "
        "infantil congénita operada tardiamente?",
        "O facto de o período crítico de desenvolvimento da visão binocular já ter avançado ou terminado",
        "O tipo específico de fio cirúrgico usado na operação",
        "A tonalidade de cor natural dos olhos do doente",
        "O peso corporal registado no doente antes da cirurgia",
        "A",
        2,
        "Passado o período crítico, mesmo um bom alinhamento cirúrgico tardio dificilmente restaura a fusão binocular fina.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Que outra alteração ocular é frequentemente associada à esotropia infantil congénita, "
        "além do próprio desvio horizontal?",
        "Um nistagmo latente, ou uma disfunção dos músculos oblíquos",
        "Uma catarata congénita presente de forma sempre bilateral",
        "Um daltonismo hereditário considerado sempre obrigatório",
        "Uma presbiopia precoce, associada ao cristalino do olho",
        "A",
        2,
        "É comum encontrar, associadas à esotropia infantil, disfunções dos músculos oblíquos ou um nistagmo latente.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O que é, na prática, a 'disfunção do oblíquo inferior', um achado comum acompanhando "
        "estrabismos horizontais infantis?",
        "Uma hiperfunção do oblíquo inferior, causando elevação excessiva do olho em adução",
        "Uma paralisia total do nervo oculomotor daquele olho",
        "Uma catarata localizada diretamente no cristalino do olho",
        "Uma reação alérgica ocular causada pela luz solar",
        "A",
        2,
        "É uma das disfunções musculares mais frequentemente associadas e corrigidas na mesma cirurgia do desvio horizontal.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "O 'padrão em V' do estrabismo refere-se a que achado no exame da motilidade ocular?",
        "Um desvio horizontal que aumenta no olhar para cima, comparado ao olhar para baixo",
        "Um desvio ocular que só costuma ocorrer durante a noite",
        "Uma alteração de carácter exclusivamente estético da íris",
        "Um sinónimo pouco rigoroso do termo catarata congénita",
        "A",
        2,
        "Os padrões em A e em V refletem disfunções relativas dos músculos oblíquos, relevantes na decisão cirúrgica.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O 'padrão em A' do estrabismo, em contraste com o padrão em V, caracteriza-se por:",
        "Um desvio horizontal que aumenta no olhar para baixo, comparado ao olhar para cima",
        "Um desvio ocular que só costuma ocorrer durante o sono",
        "Uma alteração de carácter exclusivamente estético da córnea",
        "Um sinónimo pouco rigoroso do termo nistagmo congénito",
        "A",
        2,
        "Tal como o padrão em V, o padrão em A orienta a cirurgia para os músculos oblíquos, além dos retos horizontais.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é o objetivo de medir o desvio em várias posições do olhar (para cima, para baixo, "
        "à direita, à esquerda), e não apenas em posição primária?",
        "Identificar padrões em A ou V e detetar componentes incomitantes do desvio",
        "Avaliar de forma exclusiva a acuidade visual do doente",
        "Medir a pressão intraocular registada em cada posição",
        "Não tem, segundo esta ideia, qualquer utilidade adicional",
        "A",
        2,
        "Um desvio que muda muito consoante a direção do olhar sugere um componente paralítico, restritivo ou um padrão A/V a considerar na cirurgia.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é a função clínica de medir o desvio tanto de perto como de longe, numa consulta "
        "de estrabismo?",
        "Detetar diferenças, como um maior desvio de perto, que orientam o diagnóstico e o plano cirúrgico",
        "É apenas uma repetição desnecessária do mesmo exame já feito",
        "Serve apenas para confirmar novamente a idade do doente",
        "Não tem, na prática clínica, qualquer relevância real",
        "A",
        2,
        "Um desvio maior de perto do que de longe, por exemplo, sugere um componente de excesso de convergência, com implicações no tratamento.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, na prática, o 'excesso de convergência', uma variante de esotropia "
        "acomodativa?",
        "Uma esotropia maior de perto do que de longe, associada a uma relação AC/A elevada",
        "Uma exotropia presente de forma exclusiva ao olhar para longe",
        "Uma paralisia isolada do quarto par de nervos cranianos",
        "Um sinónimo pouco rigoroso do termo ambliopia refrativa",
        "A",
        2,
        "Nestes casos, óculos bifocais ou multifocais podem ser usados especificamente para reduzir o desvio de perto.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Qual é, na prática, o 'défice de divergência', outra variante clínica de estrabismo "
        "horizontal?",
        "Uma esotropia maior de longe do que de perto, ao contrário do excesso de convergência",
        "Uma exotropia maior de perto do que de longe, em contraste com este quadro",
        "Um sinónimo pouco rigoroso do termo síndrome de Duane",
        "Uma paralisia isolada do terceiro par de nervos cranianos",
        "A",
        2,
        "É o padrão inverso do excesso de convergência, com maior desvio ao olhar para longe do que ao olhar para perto.",
        categoria="doencas_estrabismo",
    ),
    # === Nível 3 (patamares 11-15, 100.000 Kz a 1.000.000 Kz) ================
    # Avançado: leis da motilidade, ângulos subjetivo/objetivo, física ótica
    # e história da cirurgia de estrabismo.
    PerguntaSeed(
        "A Lei de Sherrington, ou da inervação recíproca, aplica-se a que contexto?",
        "À visão binocular, na relação de inervação entre os dois olhos",
        "À monocularidade: quando um músculo se contrai, o seu antagonista no mesmo olho "
        "relaxa-se reciprocamente",
        "Apenas ao funcionamento isolado dos músculos oblíquos do olho",
        "Apenas a movimentos oculares observados em crianças pequenas",
        "B",
        3,
        "Determina que a inervação simultânea de agonista e antagonista, no mesmo olho, "
        "permite o movimento do globo ocular.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "A Lei de Hering, ou da inervação equivalente, determina que:",
        "Cada olho recebe uma inervação totalmente independente do outro",
        "Quando um músculo se contrai, o seu conjugado no outro olho recebe igual inervação, "
        "para permitir o movimento binocular",
        "A lei, segundo esta ideia, só se aplica a movimentos verticais dos olhos",
        "A lei, segundo esta ideia, só é válida depois de cirurgia de estrabismo",
        "B",
        3,
        "É uma das leis mais importantes do estrabismo por explicar a semiologia dos "
        "estrabismos inconcomitantes inervacionais paréticos.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Na parésia de um músculo extraocular, qual desvio é maior: o desvio primário (com o "
        "olho não parético a fixar) ou o desvio secundário (com o olho parético a fixar)?",
        "São, segundo esta ideia, sempre exactamente iguais entre si",
        "O desvio secundário é, tipicamente, maior do que o primário",
        "O desvio primário é, segundo esta ideia, sempre o maior dos dois",
        "Não existe, segundo esta ideia, qualquer relação entre os dois",
        "B",
        3,
        "É consequência direta da Lei de Hering: para o músculo parético trazer o olho ao seu "
        "campo de ação, o seu conjugado recebe inervação extra, produzindo o desvio secundário.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Segundo a Lei de Hering, numa parésia do reto externo do olho direito, qual músculo "
        "tipicamente mostra hiperação, por ser o seu conjugado (yoke muscle)?",
        "O reto interno do olho esquerdo, seu conjugado na versão lateral",
        "O reto externo do olho esquerdo, sem relação direta de conjugação",
        "O oblíquo superior (grande oblíquo) do próprio olho direito afetado",
        "O reto inferior do olho esquerdo, sem relação direta de conjugação",
        "A",
        3,
        "O reto externo do olho direito e o reto interno do olho esquerdo formam um par de "
        "músculos conjugados; a hiperação do conjugado explica-se pela Lei de Hering.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O que distingue o 'ângulo objetivo' do 'ângulo subjetivo' do estrabismo, na "
        "formulação clássica da motilidade ocular?",
        "São, na prática clínica, sinónimos exatos, sem diferença real",
        "O objetivo resulta da diferença entre os eixos visuais medida clinicamente; o "
        "subjetivo reflete a perceção subjetiva do espaço pelo próprio paciente",
        "O ângulo subjetivo, segundo esta ideia, só pode ser medido em animais",
        "O ângulo objetivo é, por definição, sempre e exatamente igual a zero",
        "B",
        3,
        "Ao desvio 'real' ou objetivo (E) junta-se ainda o de aparência (A) e o subjetivo (S), "
        "três conceitos distintos de avaliação do estrabismo.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Opticamente, o ângulo kappa (K) representa a diferença entre:",
        "O eixo visual e o eixo pupilar do olho examinado",
        "O eixo óptico e o eixo antero-posterior da própria órbita",
        "A córnea, na frente do olho, e a esclera, na sua periferia",
        "A retina, na parte interna, e a coroide, por baixo dela",
        "A",
        3,
        "O eixo visual e o eixo pupilar raramente coincidem; o ângulo entre eles, o kappa, "
        "tem tipicamente entre 3º e 7º, podendo por vezes ser maior.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Segundo a fórmula clássica que relaciona o desvio real (objetivo) com o desvio "
        "aparente do estrabismo, qual das seguintes está correta?",
        "E = A + K, ou seja, o desvio objetivo é igual ao ângulo de aparência mais o ângulo kappa",
        "E = A menos K, sendo esta relação sempre válida sem exceção",
        "K = E multiplicado por A, segundo esta formulação alternativa",
        "Não existe, segundo esta ideia, qualquer relação matemática entre estas grandezas",
        "A",
        3,
        "Esta relação explica, por exemplo, como um ângulo kappa de sinal contrário pode "
        "mascarar um estrabismo real, anulando a aparência de desvio.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Como se chama o fenómeno em que, por causa do ângulo kappa, existe um desvio "
        "aparente entre os olhos mas os eixos visuais estão, na realidade, corretamente "
        "posicionados relativamente ao objeto?",
        "Anisocoria, uma diferença de tamanho entre as duas pupilas",
        "Pseudoestrabismo por ângulo kappa, sem desvio real subjacente",
        "Ambliopia de privação, causada por um obstáculo à luz",
        "Nistagmo optocinético, um movimento reflexo dos olhos",
        "B",
        3,
        "É o inverso do caso em que o ângulo kappa mascara um desvio real: aqui, cria a "
        "ilusão de um desvio que não existe.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Segundo o relato histórico da cirurgia de estrabismo, quem é geralmente creditado por "
        "ter formulado positivamente, em 1838, a operação de miotomia ocular na sua "
        "'ortopedia operatória'?",
        "Dieffenbach, que mais tarde popularizou a técnica já formulada",
        "Stromeyer, que formulou positivamente a técnica em 1838",
        "Bonnet, que mais tarde substituiu a miotomia pela tenotomia",
        "J. Guérin, que apenas terá pressentido a ideia antes",
        "B",
        3,
        "J. Guérin terá 'pressentido' a ideia primeiro, mas foi Stromeyer quem a formulou "
        "positivamente em 1838; Florent Cunier foi o primeiro a praticá-la ao vivo, em 1839, e "
        "Dieffenbach popularizou-a depois.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Qual cirurgião substituiu a miotomia (secção total do músculo) pela tenotomia, ao "
        "estudar as relações dos músculos oculares com a cápsula de Tenon, melhorando a "
        "reputação da cirurgia de estrabismo?",
        "Bonnet, que estudou a cápsula de Tenon e propôs a tenotomia",
        "Giraud-Teulon, conhecido antes pela sua definição de estrabismo",
        "Buffon, associado antes a uma antiga doutrina sobre a causa",
        "Hering, associado antes à lei da inervação equivalente",
        "A",
        3,
        "A tenotomia, ao contrário da miotomia, conserva o músculo por inteiro e apenas "
        "desloca o seu ponto de inserção.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "A antiga doutrina de Buffon atribuía a causa do estrabismo a quê -- teoria depois "
        "refutada pelos resultados da estrabotomia?",
        "A uma infeção viral localizada diretamente no nervo óptico",
        "A uma desigualdade de força muscular entre os dois olhos",
        "A uma malformação congénita presente diretamente na retina",
        "A um excesso de exposição prolongada à luz solar direta",
        "B",
        3,
        "Os sucessos, por vezes brilhantes, da estrabotomia deram ao sistema muscular o valor "
        "patogénico que a teoria de Buffon não reconhecia.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "O oftalmologista Giraud-Teulon definiu classicamente o estrabismo como:",
        "Uma simples miopia que nunca chegou a ser corrigida",
        "Uma rutura no equilíbrio das forças sinérgicas da visão binocular, traduzida numa "
        "desarmonia dos eixos ópticos principais",
        "Uma doença exclusivamente hereditária, sem qualquer componente muscular",
        "Um sinónimo direto e rigoroso do termo cegueira total",
        "B",
        3,
        "Esta definição do século XIX é ainda hoje reconhecida como uma descrição "
        "essencialmente correta do fenómeno.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O Prémio Nobel de Fisiologia ou Medicina de 1981, atribuído a David Hubel e Torsten "
        "Wiesel, assentou em que descoberta relevante para a compreensão da ambliopia?",
        "A identificação do gene especificamente responsável pelo estrabismo",
        "A demonstração de dano irreversível nas colunas de dominância ocular por privação "
        "visual durante o 'período crítico'",
        "A invenção do teste de Hirschberg para avaliar o alinhamento",
        "A criação da toxina botulínica como agente terapêutico",
        "B",
        3,
        "O trabalho, feito em gatinhos, confirmou que a ambliopia é, na sua essência, um "
        "fenómeno cortical, e não apenas ocular.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Em óptica geométrica, o que significa dizer que a imagem e o objeto são 'conjugados' "
        "através de uma lente?",
        "Que ambos têm exatamente o mesmo tamanho, sem qualquer ampliação",
        "Que estão ligados por um raio de luz que atravessa a lente, correspondendo um "
        "ponto-objeto a um ponto-imagem",
        "Que a lente, na verdade, não tem qualquer efeito sobre eles",
        "Que este conceito, segundo esta ideia, só se aplica a lentes côncavas",
        "B",
        3,
        "Este é o conceito-base usado depois para explicar a técnica de esquiascopia "
        "(retinoscopia) e a distância de trabalho do examinador.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Por definição óptica, um olho diz-se emétrope quando:",
        "Precisa sempre de alguma correção óptica para ver ao longe",
        "A imagem conjugada de um objeto no infinito se forma na retina sem qualquer esforço "
        "de acomodação",
        "Tem sempre algum grau residual de astigmatismo associado",
        "O termo, segundo esta ideia, só se aplica a olhos de crianças",
        "B",
        3,
        "É a partir desta definição que se deriva o conceito de distância de trabalho na "
        "esquiascopia.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Numa técnica de esquiascopia (retinoscopia), ao usar uma lente de trabalho de "
        "+1,50D, a que distância aproximada se forma a imagem conjugada -- e portanto a que "
        "distância se deve posicionar o examinador?",
        "A um metro de distância, segundo o cálculo desta lente",
        "A cerca de 0,66 metros, o inverso da vergência desta lente",
        "A meio metro de distância, segundo o cálculo desta lente",
        "A dois metros de distância, segundo o cálculo desta lente",
        "B",
        3,
        "A distância da imagem conjugada é o inverso da vergência da lente, em metros: "
        "1 ÷ 1,50 ≈ 0,66 m.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O retinoscópio de franja veio substituir que técnica mais antiga, usada para produzir "
        "o feixe de luz na esquiascopia, por ser mais difícil de manejar?",
        "O uso de um espelho simples para refletir o feixe de luz",
        "O uso do autorrefractómetro, um aparelho automático mais recente",
        "O uso da lâmpada de fenda, usada noutro tipo de exame",
        "O uso do oftalmoscópio indireto, usado noutro tipo de exame",
        "A",
        3,
        "O retinoscópio de franja tornou a técnica mais fácil ao produzir diretamente um "
        "feixe de luz retangular, ajustável em espessura e orientação.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Numa paralisia do músculo grande oblíquo (oblíquo superior) em que a função de "
        "depressão é a mais afetada, qual músculo tende a mostrar hiperação, por ser o seu "
        "conjugado contralateral?",
        "O reto inferior contralateral, seu conjugado nesta função",
        "O reto superior homolateral, sem relação de conjugação direta",
        "O oblíquo inferior (pequeno oblíquo) homolateral, sem essa relação",
        "O reto externo contralateral, sem relação de conjugação direta",
        "A",
        3,
        "Segundo as regras de Hering e Sherrington aplicadas a este quadro, a hiperação do "
        "reto inferior contralateral surge quando é a depressão a função mais comprometida.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Quantos músculos extraoculares controlam os movimentos de cada olho, no total?",
        "Um total de quatro músculos extraoculares por olho",
        "Um total de seis músculos extraoculares por olho",
        "Um total de oito músculos extraoculares por olho",
        "Um total de dois músculos extraoculares por olho",
        "B",
        3,
        "Cada olho tem quatro músculos retos e dois oblíquos, num total de seis músculos extraoculares.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Qual é a principal ação do músculo reto lateral (externo)?",
        "Adução, ou seja, aproximar o olho do nariz",
        "Abdução, ou seja, afastar o olho do nariz",
        "Elevação pura, sem qualquer componente horizontal",
        "Depressão pura, sem qualquer componente horizontal",
        "B",
        3,
        "O reto lateral, inervado pelo VI par (abducente), é o principal abdutor do olho.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Qual é a principal ação do músculo reto medial (interno)?",
        "Abdução, ou seja, afastar o olho do nariz",
        "Ciclotorção intorsora, ou seja, rotação do olho",
        "Adução, ou seja, aproximar o olho do nariz",
        "Depressão pura, sem qualquer componente horizontal",
        "C",
        3,
        "O reto medial, inervado pelo III par (oculomotor), é o principal adutor do olho.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "O músculo oblíquo superior (grande oblíquo) é inervado por qual nervo craniano?",
        "O terceiro par, também chamado nervo oculomotor",
        "O sexto par, também chamado nervo abducente",
        "O quinto par, também chamado nervo trigémeo",
        "O quarto par, também chamado nervo troclear",
        "D",
        3,
        "O nervo troclear é o único que inerva exclusivamente o oblíquo superior, atravessando a tróclea antes de chegar ao músculo.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "O músculo reto lateral é inervado por qual nervo craniano?",
        "O terceiro par, também chamado nervo oculomotor",
        "O quarto par, também chamado nervo troclear",
        "O sexto par, também chamado nervo abducente",
        "O sétimo par, também chamado nervo facial",
        "C",
        3,
        "Uma paralisia isolada deste nervo causa tipicamente uma esotropia por perda da abdução do olho afetado.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Os restantes músculos extraoculares (retos superior, inferior, medial e o oblíquo "
        "inferior) são inervados principalmente por qual nervo craniano?",
        "O terceiro par, também chamado nervo oculomotor",
        "O quarto par, também chamado nervo troclear",
        "O sexto par, também chamado nervo abducente",
        "O oitavo par, também chamado nervo vestibulococlear",
        "A",
        3,
        "O nervo oculomotor é o mais 'ocupado' dos três nervos motores oculares, controlando quatro dos seis músculos extraoculares.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Qual é a principal ação do músculo reto superior, na posição primária do olhar?",
        "Elevação, com componentes secundários de adução e intorsão",
        "Depressão pura, sem qualquer componente secundário associado",
        "Abdução pura, sem qualquer componente vertical associado",
        "Ciclotorção extorsora isolada, sem qualquer componente vertical",
        "A",
        3,
        "Por causa do ângulo entre o eixo do músculo e o eixo visual, o reto superior tem ações secundárias além da elevação principal.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Qual é a principal ação do músculo oblíquo inferior (pequeno oblíquo)?",
        "Depressão pura, sem qualquer componente de elevação associado",
        "Elevação, sobretudo em adução, com componente de extorsão",
        "Abdução pura, sem qualquer componente vertical associado",
        "Intorsão pura, sem qualquer componente de elevação associado",
        "B",
        3,
        "O oblíquo inferior é um dos elevadores do olho, atuando sobretudo quando o olho está em adução.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "O que é a 'versão', em motilidade ocular?",
        "Um movimento dos dois olhos realizado em direções opostas",
        "Um movimento conjugado dos dois olhos na mesma direção",
        "Um movimento isolado de apenas um dos dois olhos",
        "Um sinónimo pouco rigoroso do termo nistagmo congénito",
        "B",
        3,
        "Olhar para a direita, por exemplo, é uma versão: os dois olhos movem-se juntos na mesma direção.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O que é a 'vergência', em motilidade ocular, ao contrário da versão?",
        "Um movimento conjugado dos dois olhos na mesma direção",
        "Um movimento realizado numa direção exclusivamente vertical",
        "Um movimento involuntário, rítmico e de amplitude constante",
        "Um movimento dos dois olhos em direções opostas, como na convergência",
        "D",
        3,
        "Ao focar um objeto próximo, os dois olhos convergem, movendo-se em direções opostas um em relação ao outro.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O que são, tecnicamente, os 'músculos conjugados' (yoke muscles)?",
        "Dois músculos do mesmo olho que atuam em sentidos opostos",
        "Um músculo de cada olho que trabalha em conjunto para produzir um movimento binocular na mesma direção",
        "Músculos que existem, de forma exclusiva, apenas no olho esquerdo",
        "Músculos que estão, na verdade, ligados ao sentido da audição",
        "B",
        3,
        "Por exemplo, o reto lateral de um olho e o reto medial do outro são conjugados na versão lateral (dextroversão ou levoversão).",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Numa parésia do reto lateral do olho direito, qual é tipicamente o músculo conjugado "
        "(yoke muscle) do olho esquerdo?",
        "O reto medial do olho esquerdo, seu conjugado nesta versão",
        "O reto lateral do olho esquerdo, sem relação de conjugação direta",
        "O oblíquo superior do olho esquerdo, sem relação de conjugação direta",
        "O reto inferior do olho esquerdo, sem relação de conjugação direta",
        "A",
        3,
        "O reto lateral direito e o reto medial esquerdo formam um par conjugado na versão para a direita (dextroversão).",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Segundo a Lei de Hering, numa parésia de um músculo, o desvio secundário (olho parético "
        "a fixar) é, em relação ao primário (olho são a fixar):",
        "Sempre e exatamente igual, segundo esta formulação da lei",
        "Habitualmente maior, por receber inervação extra pela Lei de Hering",
        "Sempre menor, segundo esta formulação alternativa da lei",
        "Sem qualquer relação previsível entre os dois valores",
        "B",
        3,
        "Para o olho parético conseguir fixar, é necessária inervação extra, que se reflete também no conjugado do olho são, aumentando o desvio secundário.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O 'campo de ação' de um músculo extraocular corresponde a que conceito?",
        "A direção do olhar em que a ação desse músculo é mais evidente e mensurável",
        "A área da retina que é diretamente estimulada por esse músculo",
        "O tempo de contração desse músculo, medido em milissegundos",
        "A quantidade de sangue que chega diretamente a esse músculo",
        "A",
        3,
        "Por exemplo, o campo de ação do reto lateral é a abdução máxima, direção em que uma eventual paralisia é mais evidente.",
        categoria="anatomia_ocular",
    ),
    PerguntaSeed(
        "Ao examinar as nove posições diagnósticas do olhar, o objetivo principal é:",
        "Avaliar a função de cada músculo extraocular isoladamente e em conjunto, procurando limitações",
        "Medir, de forma exclusiva, a acuidade visual em cada posição",
        "Substituir, nesta avaliação, a necessidade do cover test",
        "Avaliar, de forma exclusiva, a pressão registada dentro do olho",
        "A",
        3,
        "Cada uma das nove posições isola predominantemente um ou dois músculos, facilitando a localização de uma disfunção.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O 'ângulo de aparência' (A), na formulação clássica da motilidade ocular, distingue-se "
        "do desvio objetivo (E) por refletir sobretudo o quê?",
        "A perceção visual do próprio doente sobre o espaço à sua volta",
        "A impressão de desvio observada de fora por quem olha para o doente, influenciada pelo ângulo kappa",
        "Apenas o resultado obtido no cover test alternado realizado",
        "Um valor sempre idêntico ao desvio objetivo, sem qualquer exceção",
        "B",
        3,
        "É este ângulo de aparência, e não apenas o desvio real, que um observador externo tende a notar num primeiro olhar.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Um ângulo kappa é classificado como 'negativo' quando o reflexo corneano, no teste de "
        "Hirschberg, se encontra deslocado em que sentido relativamente ao centro da pupila?",
        "Temporalmente, ou seja, deslocado para o lado de fora",
        "Nasalmente, ou seja, deslocado para o lado de dentro",
        "Exatamente no centro, sem qualquer deslocamento visível",
        "Verticalmente para cima, sem qualquer componente horizontal",
        "A",
        3,
        "Ao contrário do ângulo kappa positivo (o mais comum, com reflexo ligeiramente nasal), o negativo desloca o reflexo para o lado temporal.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Por que motivo a medição cuidadosa do ângulo kappa é especialmente relevante antes de "
        "uma cirurgia de estrabismo?",
        "Porque um ângulo kappa não reconhecido pode levar a sobrestimar ou subestimar o verdadeiro desvio a corrigir",
        "Porque determina, sozinho, qual anestesia deve ser usada",
        "Porque substitui, nesta avaliação, qualquer outro exame pré-operatório",
        "Porque não tem, na verdade, qualquer implicação para a cirurgia",
        "A",
        3,
        "Ignorar um ângulo kappa significativo pode distorcer a avaliação do desvio real, com impacto direto no planeamento cirúrgico.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Como se chama o fenómeno em que, por causa do ângulo kappa, existe um desvio aparente "
        "entre os olhos mas os eixos visuais estão, na realidade, corretamente posicionados?",
        "Anisocoria, uma diferença de tamanho entre as duas pupilas",
        "Ambliopia de privação, causada por um obstáculo à luz",
        "Pseudoestrabismo por ângulo kappa, sem desvio real presente",
        "Nistagmo optocinético, um movimento reflexo dos olhos",
        "C",
        3,
        "É o inverso do caso em que o ângulo kappa mascara um desvio real: aqui, cria a ilusão de um desvio que não existe.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Um ângulo kappa positivo muito pronunciado pode ser confundido, à primeira vista, com "
        "que desvio verdadeiro?",
        "Uma esotropia, com o olho aparentemente desviado para dentro",
        "Uma exotropia, com o olho aparentemente desviado para fora",
        "Uma hipertropia, com um olho aparentemente mais alto",
        "Um nistagmo, com um movimento rítmico e involuntário",
        "B",
        3,
        "O cover test permite distinguir os dois quadros: no ângulo kappa a fixação mantém-se ao tapar o olho adelfo.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Um ângulo kappa negativo muito pronunciado pode ser confundido, à primeira vista, com "
        "que desvio verdadeiro?",
        "Uma exotropia, com o olho aparentemente desviado para fora",
        "Uma esotropia, com o olho aparentemente desviado para dentro",
        "Uma hipotropia, com o olho aparentemente mais baixo",
        "Uma ambliopia estrábica, causada pelo próprio desvio",
        "B",
        3,
        "Neste caso, o reflexo luminoso corneano fica desviado temporalmente, sugerindo à primeira vista uma esotropia inexistente.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Na esquiascopia (retinoscopia), o chamado 'ponto neutro' corresponde a que momento da "
        "técnica?",
        "Ao momento em que a pupila deixa de ficar visível ao examinador",
        "Ao instante em que o reflexo retiniano deixa de se mover, preenchendo toda a pupila instantaneamente",
        "Ao momento simples em que o doente pisca durante o exame",
        "A um conceito que só se aplica à cicloplegia farmacológica",
        "B",
        3,
        "É neste ponto neutro que a lente de prova colocada à frente do olho iguala exatamente o erro refrativo, permitindo calcular o grau.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Antes de atingir o ponto neutro na esquiascopia de um olho míope, o reflexo retiniano "
        "observado move-se tipicamente em que sentido, em relação ao movimento do feixe de luz?",
        "Em sentido contrário, no chamado 'movimento inverso' clássico",
        "No mesmo sentido, no chamado 'movimento direto' clássico",
        "Sempre na direção vertical, independentemente do próprio feixe",
        "Sem qualquer movimento percetível associado ao reflexo",
        "A",
        3,
        "Este 'movimento inverso' é a assinatura clássica de uma miopia ainda não neutralizada pela lente de prova.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Numa técnica de esquiascopia (retinoscopia), ao usar uma lente de trabalho de +1,50D, a "
        "que distância aproximada se posiciona o examinador?",
        "A cerca de um metro de distância do doente examinado",
        "A cerca de meio metro de distância do doente examinado",
        "A cerca de dois metros de distância do doente examinado",
        "A cerca de 0,66 metros, o inverso da vergência desta lente",
        "D",
        3,
        "A distância da imagem conjugada é o inverso da vergência da lente, em metros: 1 ÷ 1,50 ≈ 0,66 m.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, na prática, a 'refração ciclopégica', tantas vezes recomendada em crianças "
        "pequenas?",
        "Uma refração feita sob o efeito de um colírio que paralisa temporariamente a acomodação",
        "Uma refração feita, por regra, exclusivamente durante a noite",
        "Um sinónimo pouco rigoroso de esquiascopia sem lente de prova",
        "Uma refração feita, por regra, apenas com o olho fechado",
        "A",
        3,
        "Ao paralisar a acomodação, evita-se que o esforço de foco da criança mascare parte do erro refrativo real, sobretudo da hipermetropia.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "A que se atribui, no relato histórico da cirurgia de estrabismo, a ideia de que J. "
        "Guérin terá 'pressentido' primeiro, sem a chegar a formular positivamente?",
        "A anestesia geral usada em cirurgia oftalmológica moderna",
        "A operação de miotomia do músculo ocular para corrigir o estrabismo",
        "A invenção do oftalmoscópio, atribuída depois a Helmholtz",
        "A teoria tricromática da visão das cores, atribuída a Young",
        "B",
        3,
        "Segundo o relato histórico, coube a Stromeyer formular positivamente a ideia em 1838, embora Guérin a tivesse pressentido antes.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Quem foi o primeiro a praticar ao vivo, em 1839, a operação de miotomia ocular "
        "formulada por Stromeyer no ano anterior?",
        "Florent Cunier, que a executou pela primeira vez na prática",
        "Louis Pasteur, conhecido antes pelo seu trabalho em microbiologia",
        "Hermann von Helmholtz, conhecido antes pela invenção do oftalmoscópio",
        "Thomas Young, conhecido antes pela teoria tricromática das cores",
        "A",
        3,
        "Florent Cunier terá sido o primeiro a executar a operação na prática, antes de Dieffenbach a popularizar.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Que cirurgião é geralmente creditado por ter popularizado a operação de estrabismo, "
        "após a sua primeira execução prática por Cunier?",
        "Dieffenbach, que deu grande visibilidade à técnica cirúrgica",
        "Bonnet, que mais tarde substituiu a miotomia pela tenotomia",
        "Giraud-Teulon, conhecido antes pela sua definição de estrabismo",
        "Buffon, associado antes a uma antiga doutrina sobre a causa",
        "A",
        3,
        "Dieffenbach deu grande visibilidade e disseminação à técnica cirúrgica de correção do estrabismo no século XIX.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual cirurgião substituiu a miotomia (secção total do músculo) pela tenotomia, ao "
        "estudar as relações dos músculos oculares com a cápsula de Tenon?",
        "Giraud-Teulon, conhecido antes pela sua definição de estrabismo",
        "Bonnet, que estudou a cápsula de Tenon e propôs a tenotomia",
        "Buffon, associado antes a uma antiga doutrina sobre a causa",
        "Hering, associado antes à lei da inervação equivalente",
        "B",
        3,
        "A tenotomia, ao contrário da miotomia, conserva o músculo por inteiro e apenas desloca o seu ponto de inserção.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é a principal diferença entre a 'miotomia' e a 'tenotomia' no tratamento cirúrgico "
        "histórico do estrabismo?",
        "A miotomia seccionava totalmente o músculo; a tenotomia apenas deslocava o seu ponto de inserção, preservando-o",
        "São, na prática clínica, exatamente a mesma técnica cirúrgica",
        "A tenotomia, segundo esta ideia, só podia ser feita em animais",
        "A miotomia, segundo esta ideia, nunca chegou a ser praticada",
        "A",
        3,
        "A introdução da tenotomia por Bonnet melhorou significativamente os resultados e a reputação da cirurgia de estrabismo.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "A antiga doutrina de Buffon atribuía a causa do estrabismo a quê, teoria depois "
        "refutada pelos sucessos da estrabotomia?",
        "A uma infeção viral localizada diretamente no nervo óptico",
        "A uma desigualdade de força muscular entre os dois olhos",
        "A uma malformação congénita localizada diretamente na retina",
        "A um excesso de exposição prolongada à luz solar direta",
        "B",
        3,
        "Os sucessos, por vezes notáveis, da estrabotomia deram ao sistema muscular o valor patogénico que a teoria de Buffon não reconhecia.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "O termo histórico 'amblyopia ex anopsia', usado antes da compreensão cortical moderna "
        "da ambliopia, traduzia que ideia sobre a sua causa?",
        "Que a baixa visão resultava diretamente de uma infeção ocular crónica",
        "Que a baixa visão resultava da falta de uso do olho ('anopsia'), sem se saber ainda o mecanismo cortical exato",
        "Que a ambliopia era sempre hereditária, sem qualquer componente ambiental associado",
        "Que a ambliopia era, na verdade, um sinónimo direto de catarata congénita",
        "B",
        3,
        "Antes do trabalho de Hubel e Wiesel, já se suspeitava clinicamente que a 'falta de uso' do olho tinha um papel causal, mesmo sem se conhecer o mecanismo cortical.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Em que espécie animal foram sobretudo conduzidas as experiências clássicas de Hubel e "
        "Wiesel sobre privação visual e colunas de dominância ocular?",
        "Em gatos e em macacos, usados nas experiências clássicas",
        "Exclusivamente em seres humanos, na qualidade de voluntários",
        "Em peixes-zebra, usados noutro tipo de estudo experimental",
        "Exclusivamente em ratos de laboratório, sem outra espécie envolvida",
        "A",
        3,
        "Os estudos em gatinhos e macacos jovens permitiram observar diretamente as alterações corticais causadas pela privação visual precoce.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Que técnica experimental usaram sobretudo Hubel e Wiesel para estudar o desenvolvimento "
        "do córtex visual em animais jovens?",
        "O registo elétrico de neurónios individuais do córtex visual, associado à privação visual num dos olhos",
        "A ressonância magnética funcional, uma técnica ainda inexistente na época",
        "A tomografia por emissão de positrões, uma técnica ainda inexistente na época",
        "A eletroencefalografia de superfície, aplicada de forma isolada",
        "A",
        3,
        "A técnica de microelétrodos, à época pioneira, permitiu-lhes mapear diretamente a resposta de neurónios corticais individuais.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "O conceito de 'período crítico' do desenvolvimento visual, popularizado pelo trabalho de "
        "Hubel e Wiesel, refere-se a que ideia central?",
        "A um intervalo de tempo, durante o desenvolvimento, em que o sistema visual é especialmente sensível à privação ou distorção de estímulo",
        "A um período em que o olho, segundo esta ideia, não recebe qualquer luz",
        "A uma fase da vida adulta em que a visão melhora, segundo esta ideia, espontaneamente",
        "A um conceito, segundo esta ideia, sem qualquer aplicação clínica real",
        "A",
        3,
        "É este conceito que fundamenta a urgência de tratar precocemente a ambliopia e outras causas de privação visual na infância.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Quem é geralmente considerado o 'pai da cirurgia de catarata moderna', por ter "
        "aperfeiçoado a técnica de extração no século XVIII?",
        "Hermann von Helmholtz, associado antes à invenção do oftalmoscópio",
        "Franciscus Donders, associado antes aos erros de refração",
        "Albrecht von Graefe, associado antes à cirurgia de glaucoma",
        "Jacques Daviel, creditado pela primeira extração documentada",
        "D",
        3,
        "Daviel é creditado pela primeira extração extracapsular de catarata bem documentada, em 1747.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "A que oftalmologista do século XIX se atribui a invenção do oftalmoscópio, permitindo "
        "pela primeira vez observar diretamente o fundo do olho vivo?",
        "Louis Pasteur, conhecido antes pelo seu trabalho em microbiologia",
        "Alexander Fleming, conhecido antes pela descoberta da penicilina",
        "Hermann von Helmholtz, inventor do oftalmoscópio em 1851",
        "Robert Koch, conhecido antes pelos seus postulados em microbiologia",
        "C",
        3,
        "A invenção de Helmholtz, em 1851, revolucionou a oftalmologia ao tornar visível o interior do olho vivo.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Franciscus Donders, no século XIX, deu um contributo fundamental para a compreensão "
        "sistemática de que área da oftalmologia?",
        "A cirurgia de catarata, associada mais tarde a Jacques Daviel",
        "A toxina botulínica, associada mais tarde a Alan Scott",
        "A genética do daltonismo, ligada ao cromossoma X",
        "Os erros de refração, como a miopia e a hipermetropia",
        "D",
        3,
        "A sua obra clássica sistematizou, pela primeira vez de forma rigorosa, a compreensão moderna dos erros de refração.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Albrecht von Graefe é lembrado, entre outras contribuições do século XIX, por avanços "
        "na cirurgia de qual doença ocular grave?",
        "O daltonismo, uma alteração hereditária da perceção de cor",
        "A presbiopia, associada ao envelhecimento natural do cristalino",
        "O glaucoma, uma doença que danifica progressivamente o nervo ótico",
        "A conjuntivite, uma inflamação comum e ligeira da conjuntiva",
        "C",
        3,
        "Von Graefe é uma figura central da oftalmologia do século XIX, com contribuições marcantes na cirurgia do glaucoma.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Quem descreveu, no início do século XIX, as bases da teoria tricromática da visão das "
        "cores, mais tarde desenvolvida por Helmholtz?",
        "Isaac Newton, conhecido antes pelos seus trabalhos em óptica geral",
        "Thomas Young, autor das bases da teoria tricromática das cores",
        "Galileu Galilei, conhecido antes pelos seus trabalhos em astronomia",
        "Johannes Kepler, conhecido antes pelas leis do movimento planetário",
        "B",
        3,
        "A teoria de Young-Helmholtz propõe três tipos de recetores de cor na retina, hoje confirmados como os três tipos de cones.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "A que se refere, na teoria da visão das cores, o 'processo de oposição' (opponent "
        "process), formulado por Ewald Hering em alternativa parcial à teoria tricromática?",
        "À ideia de que certas cores, como o vermelho-verde, são processadas em pares opostos",
        "À rejeição total da existência de cones na retina humana",
        "A um mecanismo considerado exclusivo do ouvido interno",
        "A uma teoria específica sobre a pressão dentro do olho",
        "A",
        3,
        "As duas teorias, tricromática e de processos opostos, acabaram por se revelar complementares, e não mutuamente exclusivas.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Ewald Hering, autor da lei da inervação equivalente usada em estrabismo, era, por "
        "formação, sobretudo um investigador de que área?",
        "Cirurgia cardíaca, uma área sem relação direta com a sua obra",
        "Genética molecular, uma área sem relação direta com a sua obra",
        "Fisiologia da visão e da perceção sensorial dos indivíduos",
        "Microbiologia, uma área sem relação direta com a sua obra",
        "C",
        3,
        "Hering dedicou grande parte da sua obra à fisiologia sensorial e à perceção visual, incluindo a teoria das cores opostas.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "A quem se atribui a formulação, no século XIX, da lei da inervação recíproca dos "
        "músculos oculares?",
        "Louis Pasteur, conhecido antes pelo seu trabalho em microbiologia",
        "Gregor Mendel, conhecido antes pelos seus trabalhos em genética",
        "Charles Darwin, conhecido antes pela teoria da evolução",
        "Charles Sherrington, autor da lei da inervação recíproca",
        "D",
        3,
        "A Lei de Sherrington continua a ser citada como base da compreensão da motilidade ocular, mais de um século depois.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Charles Sherrington recebeu, em 1932, o Prémio Nobel de Fisiologia ou Medicina, "
        "sobretudo por trabalhos em que área da neurofisiologia?",
        "A função dos neurónios e a fisiologia dos reflexos nervosos",
        "A genética associada a doenças oculares hereditárias",
        "A cirurgia de catarata, associada antes a Jacques Daviel",
        "A farmacologia associada aos antibióticos modernos",
        "A",
        3,
        "O seu trabalho sobre reflexos e a integração neuronal é a base sobre a qual assenta a lei da inervação recíproca aplicada aos músculos oculares.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "A que grupo de investigadores se atribui, já no século XX, uma melhor compreensão do "
        "papel do córtex visual (e não apenas do olho) na fisiopatologia da ambliopia?",
        "David Hubel e Torsten Wiesel, autores desta descoberta cortical",
        "Charles Sherrington e Ewald Hering, autores de leis da motilidade",
        "Franciscus Donders e Hermann von Helmholtz, ligados à refração e ao oftalmoscópio",
        "Louis Pasteur e Robert Koch, ligados sobretudo à microbiologia",
        "A",
        3,
        "Antes do trabalho de Hubel e Wiesel, a ambliopia era vista sobretudo como um problema ocular, e não cortical.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "A primeira descrição científica rigorosa e sistemática do estrabismo, segundo a "
        "documentação histórica usada como base deste jogo, consolidou-se sobretudo em que "
        "século?",
        "No século vinte e um, já em tempos consideravelmente recentes",
        "Apenas na Antiguidade Clássica, sem qualquer desenvolvimento posterior",
        "Só depois do fim da Segunda Guerra Mundial, já no século vinte",
        "No século dezanove, com nomes como Stromeyer, Bonnet e Giraud-Teulon",
        "D",
        3,
        "Foi sobretudo no século XIX que a cirurgia e a compreensão científica do estrabismo se consolidaram, com nomes como Stromeyer, Bonnet e Giraud-Teulon.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Antes do desenvolvimento da cirurgia muscular no século XIX, que abordagens "
        "'alternativas' (hoje abandonadas) chegaram a ser tentadas historicamente para o "
        "estrabismo?",
        "Apenas cirurgia a laser, uma tecnologia ainda inexistente na época",
        "Óculos com prismas rudimentares e, nalguns relatos históricos, remédios sem qualquer base científica",
        "Apenas terapia génica, uma tecnologia também ainda inexistente na época",
        "Nenhuma tentativa terapêutica foi, de facto, alguma vez registada",
        "B",
        3,
        "A história da medicina regista várias tentativas empíricas, nem sempre eficazes, antes da era da cirurgia muscular moderna.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "Comparando com o século XIX, o que mudou mais radicalmente no tratamento do estrabismo "
        "até aos dias de hoje?",
        "Praticamente nada mudou de relevante entre então e agora",
        "O estrabismo tornou-se, segundo esta ideia, impossível de tratar",
        "A doença deixou, segundo esta ideia, de existir por completo",
        "A precisão diagnóstica, a variedade de opções terapêuticas e a compreensão neurocientífica da visão binocular",
        "D",
        3,
        "O arsenal terapêutico e o conhecimento científico expandiram-se enormemente desde as primeiras cirurgias do século XIX.",
        categoria="curiosidades_visuais",
    ),
    PerguntaSeed(
        "O que é, tecnicamente, a 'dioptria prismática' (DP ou Δ), unidade usada para quantificar "
        "desvios oculares?",
        "Uma unidade usada para medir a pressão dentro do olho",
        "Uma medida do desvio de um raio de luz ao atravessar um prisma, usada para quantificar o ângulo de estrabismo",
        "Uma unidade usada para medir diretamente a acuidade visual",
        "Uma medida usada para avaliar a espessura da própria córnea",
        "B",
        3,
        "Uma dioptria prismática corresponde a um desvio de 1 cm do raio de luz a uma distância de 1 metro do prisma.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Qual é, aproximadamente, a relação de conversão entre graus de ângulo e dioptrias "
        "prismáticas, usada na prática clínica para pequenos ângulos?",
        "Um grau equivale a cerca de duas dioptrias prismáticas",
        "Um grau equivale, segundo esta ideia, a exatamente mil dioptrias",
        "Um grau equivale, segundo esta ideia, a apenas 0,001 dioptrias",
        "Não existe, segundo esta ideia, qualquer relação de conversão",
        "A",
        3,
        "Esta aproximação (1º ≈ 2 DP) é frequentemente usada para converter rapidamente entre as duas unidades em consulta.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O 'ponto remoto' de um olho míope, em óptica geométrica, corresponde a quê?",
        "Ao ponto situado no infinito, tal como num olho emétrope",
        "A um ponto finito à frente do olho, mais próximo quanto maior for o grau de miopia",
        "A um ponto que se situa sempre atrás da própria retina",
        "A um conceito considerado exclusivo da hipermetropia",
        "B",
        3,
        "É precisamente por o ponto remoto ser finito que o míope não consegue focar nitidamente objetos mais distantes do que essa distância.",
        categoria="doencas_estrabismo",
    ),
    PerguntaSeed(
        "Numa lente com vergência de +4,00 dioptrias, a que distância aproximada, em metros, se "
        "forma a sua distância focal?",
        "A quatro metros de distância, segundo o cálculo direto",
        "A quatro centímetros de distância, segundo esta ideia",
        "A vinte e cinco centímetros de distância, o inverso da vergência",
        "A quarenta metros de distância, segundo esta ideia",
        "C",
        3,
        "A distância focal, em metros, é o inverso da vergência em dioptrias: 1 ÷ 4 = 0,25 m.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Ao combinar duas lentes finas justapostas, como se calcula (em boa aproximação) a "
        "vergência total do sistema?",
        "Multiplicando entre si as duas vergências individuais",
        "Somando algebricamente as vergências individuais, em dioptrias",
        "Dividindo a maior vergência pela menor das duas",
        "Não é possível, segundo esta ideia, calcular esta grandeza",
        "B",
        3,
        "Esta soma algébrica simples é a base do cálculo usado, por exemplo, ao adicionar lentes de prova durante um exame de refração.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "O 'princípio de reversibilidade' em óptica geométrica, aplicado à retinoscopia, afirma "
        "que:",
        "A luz nunca pode, segundo esta ideia, ser refletida por um espelho plano",
        "O percurso de um raio de luz pode ser invertido, com o mesmo comportamento óptico em qualquer direção",
        "As lentes convexas, segundo esta ideia, só funcionam num único sentido",
        "Não existe, segundo esta ideia, relação entre o percurso de ida e de volta",
        "B",
        3,
        "É este princípio que permite, na retinoscopia, interpretar o percurso da luz refletida pela retina do doente de volta ao examinador.",
        categoria="ciencia_ocular",
    ),
    PerguntaSeed(
        "Uma lente 'afáquica' é usada em que contexto clínico específico?",
        "Em olhos sem cristalino, por exemplo após remoção cirúrgica de uma catarata sem implante de lente intraocular",
        "Em qualquer olho que apresente apenas uma miopia ligeira",
        "Exclusivamente em crianças saudáveis, sem qualquer patologia associada",
        "Nunca é usada, segundo esta ideia, na prática clínica atual",
        "A",
        3,
        "Antes da generalização das lentes intraoculares, a afacia (ausência de cristalino) exigia óculos ou lentes de contacto com grau muito elevado.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "O que é, tecnicamente, a 'aniseiconia', um conceito óptico relevante em anisometropias "
        "corrigidas apenas com óculos?",
        "Uma diferença percetível no tamanho das imagens retinianas entre os dois olhos, que pode dificultar a fusão binocular",
        "Uma diferença de tonalidade de cor percebida entre os dois olhos",
        "Um sinónimo direto e rigoroso do termo astigmatismo",
        "Uma alteração considerada exclusiva da pressão intraocular",
        "A",
        3,
        "É por isso que, em anisometropias elevadas, as lentes de contacto são muitas vezes preferíveis aos óculos, por gerarem menos aniseiconia.",
        categoria="prevencao_cuidados",
    ),
    PerguntaSeed(
        "Por que motivo as lentes de contacto tendem a gerar menos aniseiconia do que óculos "
        "equivalentes, numa anisometropia significativa?",
        "Por estarem muito mais próximas do olho, alterando menos a ampliação relativa da imagem retiniana em cada olho",
        "Porque são, de um modo geral, sempre mais escuras do que os óculos",
        "Porque filtram, de forma exclusiva, a radiação ultravioleta recebida",
        "Não existe, segundo esta ideia, qualquer diferença óptica relevante",
        "A",
        3,
        "A proximidade da lente de contacto ao olho reduz o efeito de ampliação associado à distância vértice, atenuando a aniseiconia.",
        categoria="prevencao_cuidados",
    ),
]


@dataclass(frozen=True)
class ResultadoSeed:
    inseridas: int
    # Já existiam (pelo texto exacto) e tinham outra categoria -- corrigidas.
    categorias_corrigidas: int
    # Já existiam, iguais -- não se mexeu.
    inalteradas: int


def semear_perguntas(conexao: Connection) -> ResultadoSeed:
    """Insere as perguntas de `PERGUNTAS` que ainda não existem (procuradas
    pelo texto exacto) e acerta a categoria das que já existem. Correr duas
    vezes não duplica nada nem muda nada à segunda.

    Não faz commit: corre dentro da transacção de quem chama (a da migração,
    ou a do pedido). Só Postgres (`pg_advisory_xact_lock`)."""
    for pergunta in PERGUNTAS:
        if pergunta.categoria not in CATEGORIAS:
            raise ValueError(f"categoria inválida: {pergunta.categoria!r} ({pergunta.texto_pergunta[:40]})")

    conexao.execute(sa.select(sa.func.pg_advisory_xact_lock(_CHAVE_BLOQUEIO_SEED)))
    existentes: dict[str, str] = dict(
        conexao.execute(sa.select(_perguntas_jogo.c.texto_pergunta, _perguntas_jogo.c.categoria)).tuples().all()
    )

    novas: list[dict] = []
    a_corrigir: list[PerguntaSeed] = []
    inalteradas = 0
    vistas: set[str] = set()
    for p in PERGUNTAS:
        if p.texto_pergunta in vistas:
            continue
        vistas.add(p.texto_pergunta)
        categoria_atual = existentes.get(p.texto_pergunta)
        if categoria_atual is None:
            novas.append(
                {
                    "texto_pergunta": p.texto_pergunta,
                    "opcao_a": p.opcao_a,
                    "opcao_b": p.opcao_b,
                    "opcao_c": p.opcao_c,
                    "opcao_d": p.opcao_d,
                    "resposta_correta": p.resposta_correta,
                    "nivel_dificuldade": p.nivel_dificuldade,
                    "explicacao": p.explicacao,
                    "categoria": p.categoria,
                }
            )
        elif categoria_atual != p.categoria:
            a_corrigir.append(p)
        else:
            inalteradas += 1

    if novas:
        conexao.execute(sa.insert(_perguntas_jogo), novas)
    for p in a_corrigir:
        conexao.execute(
            sa.update(_perguntas_jogo)
            .where(_perguntas_jogo.c.texto_pergunta == p.texto_pergunta)
            .values(categoria=p.categoria)
        )
    return ResultadoSeed(inseridas=len(novas), categorias_corrigidas=len(a_corrigir), inalteradas=inalteradas)

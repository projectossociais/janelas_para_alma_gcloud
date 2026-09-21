"""Semeia a reserva de perguntas do jogo "Você Sabia Que..." (estilo Quem
Quer Ser Milionário, patamares 1-15, prémios de 500 Kz a 1.000.000 Kz).

As perguntas vêm da documentação científica sobre estrabismo do projeto --
"Estrabismo para totós" (Machado & Gama, 2012), a dissertação histórica
"Breves considerações sobre o estrabismo" (1882) e o artigo "Estrabismos:
da teoria à prática" (Arq. Bras. Oftalmol., CBO 2009) -- reescritas aqui
como perguntas de escolha múltipla, não copiadas literalmente. É esta
reserva na base de dados que substitui a necessidade de uma API de IA em
produção: o endpoint `GET /jogo/pergunta-aleatoria` só sorteia dentro dela
(ver `nivel_dificuldade_do_patamar` em `app/repositories/jogo_repository.py`).

Idempotente: verifica pelo `texto_pergunta` antes de inserir, para poder
ser corrido várias vezes (ex.: depois de acrescentar perguntas a esta
lista) sem duplicar as que já existem.

    python -m scripts.seed_maciço_perguntas

Corre contra a base de dados apontada por `DATABASE_URL` -- não corre
contra produção sem intenção explícita.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.repositories.orm_models import PerguntaJogo, RespostaOpcao


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


PERGUNTAS: list[PerguntaSeed] = [
    # === Nível 1 (patamares 1-5, 500 Kz a 5.000 Kz) ==========================
    # Conceitos básicos, definições simples de estrabismo, óculos e saúde
    # visual geral -- fonte principal: "Estrabismo para totós".
    PerguntaSeed(
        "O que é o estrabismo, em termos simples?",
        "Uma alteração na cor da íris",
        "Um desalinhamento dos eixos visuais dos dois olhos",
        "Uma infeção da conjuntiva",
        "Um aumento da pressão intraocular",
        "B",
        1,
        "Classicamente definido como uma rutura no equilíbrio das forças musculares que "
        "sustentam a visão binocular, traduzida numa desarmonia do alinhamento dos eixos visuais.",
    ),
    PerguntaSeed(
        "Como se chama o desvio ocular que só aparece quando se rompe a fusão binocular "
        "(por exemplo, ao tapar um dos olhos), não estando presente com os dois olhos abertos?",
        "Tropia",
        "Foria",
        "Ambliopia",
        "Ptose",
        "B",
        1,
        "A foria é um desvio latente, só visível quando a binocularidade é rompida (teste do "
        "'uncover'); a tropia é um desvio manifesto, presente mesmo com os dois olhos a par.",
    ),
    PerguntaSeed(
        "Até aos 3 anos de idade, qual é um dos principais motivos de consulta em oftalmologia "
        "pediátrica que, afinal, não é um verdadeiro estrabismo?",
        "Ambliopia profunda",
        "Pseudoestrabismo (por exemplo, por pregas largas do epicanto)",
        "Síndrome de Duane",
        "Catarata congénita",
        "B",
        1,
        "As pregas de epicanto podem dar a falsa impressão de um olho desviado; o teste de "
        "Hirschberg confirma que o alinhamento ocular está, na realidade, normal.",
    ),
    PerguntaSeed(
        "As dores de cabeça (cefaleias) numa criança são, segundo a evidência disponível:",
        "O sintoma mais fiável de que a criança precisa de óculos",
        "Raramente causadas por erros refractivos, apesar da crença popular",
        "Sempre um sinal de estrabismo",
        "Um sinal exclusivo de miopia",
        "B",
        1,
        "Os estudos que tentam ligar cefaleias a erros refractivos são inconclusivos; cefaleias "
        "matinais, progressivas e com náuseas justificam observação por suspeita de outra causa.",
    ),
    PerguntaSeed(
        "Ver filmes em 3D faz mal à visão de uma criança?",
        "Sim, provoca sempre lesões na retina",
        "Não; no máximo pode cansar quem tem pouca amplitude de fusão binocular",
        "Sim, porque aumenta a pressão intraocular",
        "Não tem qualquer relação com a visão binocular",
        "B",
        1,
        "Os óculos 3D usam lentes polarizadas que enviam imagens diferentes a cada olho; isso "
        "pode cansar quem tem baixa amplitude de fusão, mas não causa dano ocular.",
    ),
    PerguntaSeed(
        "Por que é que a hipermetropia é considerada 'fisiológica' numa criança pequena?",
        "Porque todas as crianças acabam por ficar cegas",
        "Porque é o estado refractivo mais comum nessa idade e tende a reduzir-se com o "
        "crescimento (emetropização)",
        "Porque não tem qualquer tratamento possível",
        "Porque é sempre sinal de doença ocular grave",
        "B",
        1,
        "A refração média nas crianças anda à volta de +2,00D; com o crescimento do olho "
        "(aumento do comprimento axial), a refração tende para a emetropia.",
    ),
    PerguntaSeed(
        "O que é a emetropização?",
        "A cirurgia que corrige o estrabismo",
        "O processo natural pelo qual a refração do olho evolui em direção à emetropia com o "
        "crescimento",
        "A perda de visão por privação sensorial",
        "O uso de toxina botulínica no músculo ocular",
        "B",
        1,
        "Ocorre por mudanças estruturais do olho ao longo do crescimento: o comprimento axial "
        "aumenta e as curvaturas da córnea e do cristalino diminuem.",
    ),
    PerguntaSeed(
        "Um pai conta que o filho 'se debruça sobre os cadernos' para ler. Isso deve-se, "
        "sobretudo, a:",
        "Estrabismo grave",
        "O exercício normal da acomodação, um hábito que tende a desaparecer com a idade",
        "Cegueira noturna",
        "Uma alergia ocular",
        "B",
        1,
        "É uma competência (a acomodação) que todos exercitámos nessa fase; não deixa de ser "
        "boa ideia corrigir a postura, mas não é sinal de doença ocular.",
    ),
    PerguntaSeed(
        "Que estrutura do olho é responsável pela acomodação (focar objectos próximos)?",
        "A íris",
        "O músculo ciliar, que altera a curvatura do cristalino",
        "A esclera",
        "O nervo óptico",
        "B",
        1,
        "A contração do músculo ciliar, do tipo esfíncter, relaxa as fibras da zónula e permite "
        "ao cristalino aumentar a sua curvatura.",
    ),
    PerguntaSeed(
        "Quando os dois pais são míopes, qual é a percentagem aproximada de filhos que também "
        "podem vir a ser míopes, citada na avaliação da história familiar?",
        "Até 10%",
        "Até 50%",
        "Praticamente 100%",
        "Praticamente 0%",
        "B",
        1,
        "A história familiar de miopia é um dos itens recolhidos na consulta, precisamente por "
        "este peso hereditário relatado.",
    ),
    PerguntaSeed(
        "Até que idade aproximada costuma ser possível recuperar a acuidade visual perdida por "
        "ambliopia (o chamado 'olho preguiçoso')?",
        "Até aos 2 anos",
        "Até aos 10 anos, altura a partir da qual a capacidade de recuperação diminui muito",
        "Só é possível tratar em adultos",
        "Não há qualquer limite de idade",
        "B",
        1,
        "O tratamento da ambliopia deve começar o mais cedo possível; passada essa janela, a "
        "resposta ao tratamento piora significativamente.",
    ),
    PerguntaSeed(
        "Qual é o tratamento da ambliopia considerado mais eficaz, apesar de ser mal tolerado "
        "por algumas crianças (e alguns pais)?",
        "Colírios anti-inflamatórios",
        "O penso oclusivo, tapando o olho com melhor visão",
        "Exercícios de leitura em voz alta",
        "Óculos de sol escuros",
        "B",
        1,
        "Ao forçar o uso do olho amblíope, o penso oclusivo é o método com melhor eficácia "
        "demonstrada, embora a adesão nem sempre seja fácil.",
    ),
    PerguntaSeed(
        "O que distingue, de forma simples, a miopia da hipermetropia quanto à visão de perto?",
        "A miopia costuma permitir alguma visão nítida de perto; a hipermetropia acentuada "
        "dificulta a nitidez tanto de perto como ao longe",
        "São exactamente a mesma condição, com nomes diferentes",
        "A hipermetropia só existe em pessoas idosas",
        "A miopia nunca está associada a ambliopia",
        "A",
        1,
        "Por isso a hipermetropia bilateral acentuada é uma causa mais frequente de ambliopia "
        "refractiva do que a miopia.",
    ),
    PerguntaSeed(
        "Qual destas NÃO consta entre as causas clássicas de ambliopia?",
        "Ambliopia estrábica",
        "Ambliopia refractiva (por ametropia ou anisometropia)",
        "Ambliopia de privação (por exemplo, catarata congénita)",
        "Ambliopia por uso excessivo de ecrãs",
        "D",
        1,
        "As categorias clássicas são estrábica, refractiva, de privação e idiopática; passar "
        "horas em frente a um ecrã não é, por si só, causa de ambliopia.",
    ),
    PerguntaSeed(
        "Por que motivo se pergunta, na história clínica de uma criança com desvio ocular, se "
        "houve complicações peri-parto como hemorragias intracranianas?",
        "Porque são irrelevantes para o estrabismo",
        "Porque essas patologias podem estar associadas a miopia, estrabismo e atraso de "
        "desenvolvimento",
        "Porque só interessam ao pediatra, nunca ao oftalmologista",
        "Porque causam sempre cegueira total e imediata",
        "B",
        1,
        "Antecedentes peri-parto e sinais neurológicos associados podem ajudar a guiar o "
        "diagnóstico de fundo por trás de um estrabismo.",
    ),
    PerguntaSeed(
        "Numa criança com visão binocular normal, por volta de que idade se espera já haver um "
        "bom alinhamento ocular?",
        "4 a 6 meses",
        "4 a 6 anos",
        "Logo ao nascimento",
        "Só na adolescência",
        "A",
        1,
        "É também a partir daqui que se desenvolve a fusão e a estereopsia, num período crítico "
        "que se estende até aos dois anos de idade.",
    ),
    PerguntaSeed(
        "O que avalia, na prática, o 'teste do olhar preferencial' com cartões de Teller, usado "
        "em bebés?",
        "A pressão intraocular",
        "Uma estimativa comparativa da acuidade visual entre os dois olhos",
        "A cor da retina",
        "O reflexo pupilar direto à luz",
        "B",
        1,
        "É mais útil para comparar os dois olhos entre si do que para obter um valor absoluto "
        "de acuidade visual equivalente ao Snellen.",
    ),
    PerguntaSeed(
        "Para além da história clínica e do exame dos movimentos oculares, qual exame nunca "
        "deve ser esquecido numa consulta de estrabismo pediátrico, por poder revelar doenças "
        "graves do fundo do olho?",
        "A fundoscopia (observação do disco óptico e da mácula)",
        "A medição da temperatura corporal",
        "O teste de audição",
        "A pesagem da criança",
        "A",
        1,
        "Há relatos de ambliopias 'tratadas' sem nunca se ter visualizado o fundo ocular, "
        "atrasando o diagnóstico de uma doença ocular verdadeira.",
    ),
    # === Nível 2 (patamares 6-10, 7.500 Kz a 50.000 Kz) ======================
    # Clínica intermédia: Hirschberg, cover test, ambliopia mais detalhada,
    # prismas e toxina botulínica.
    PerguntaSeed(
        "Em que se baseia o teste de Hirschberg?",
        "Na medição direta da pressão intraocular",
        "Na posição do reflexo luminoso corneano (imagem de Purkinje-Sanson) em relação à pupila",
        "Na velocidade de resposta pupilar à luz",
        "No tempo de reação ao pestanejo",
        "B",
        2,
        "O reflexo não é, na verdade, corneano, mas sim uma imagem virtual localizada atrás da "
        "pupila; a sua posição permite inferir o desvio ocular.",
    ),
    PerguntaSeed(
        "No teste de Hirschberg, um reflexo luminoso localizado no bordo do limbo (cerca de "
        "45º) corresponde a um desvio aproximado de quantas dioptrias prismáticas?",
        "Cerca de 10 DP",
        "Cerca de 100 DP",
        "Cerca de 5 DP",
        "Cerca de 500 DP",
        "B",
        2,
        "A tabela clássica de conversão do teste de Hirschberg associa o limbo a cerca de 45º, "
        "equivalente a aproximadamente 100 dioptrias prismáticas.",
    ),
    PerguntaSeed(
        "O teste de Krimsky é especialmente útil em que situação?",
        "Quando a criança não colabora com o cover test ou não tem fixação (ex.: ambliopia "
        "profunda)",
        "Para medir a pressão intraocular",
        "Quando se suspeita de glaucoma congénito",
        "Para avaliar a cor da íris",
        "A",
        2,
        "Coloca-se um prisma em frente ao olho fixador (não ao desviado), quantificando o "
        "desvio com base no reflexo de Hirschberg.",
    ),
    PerguntaSeed(
        "Qual é a principal diferença entre o teste de 'cover' e o teste de 'uncover'?",
        "O cover deteta forias, o uncover deteta tropias",
        "O cover deteta tropias (desvios manifestos); o uncover deteta forias (desvios latentes)",
        "São, na prática, exactamente o mesmo teste",
        "O cover só pode ser realizado em adultos",
        "B",
        2,
        "No cover, observa-se o olho destapado à procura de movimento; no uncover, observa-se o "
        "olho que estava tapado ao retirar a oclusão.",
    ),
    PerguntaSeed(
        "No cover test alternado, o que é essencial garantir durante a manobra?",
        "Que a oclusão dure pelo menos 1 a 2 segundos em cada olho, para romper completamente "
        "a binocularidade",
        "Que se oclua sempre apenas o olho direito",
        "Que a criança feche os dois olhos ao mesmo tempo",
        "Que se use sempre luz ultravioleta",
        "A",
        2,
        "É preciso rapidez na troca de olho, mas permanência suficiente em cada um para romper "
        "de facto a fusão binocular.",
    ),
    PerguntaSeed(
        "Para que serve, especificamente, o 'cover test prismático'?",
        "Para detetar cataratas congénitas",
        "Para quantificar o desvio, interpondo prismas progressivamente até o anular ou "
        "inverter",
        "Para medir a pressão intraocular",
        "Para diagnosticar glaucoma",
        "B",
        2,
        "É a técnica mais precisa de quantificação do desvio entre as variantes do cover test.",
    ),
    PerguntaSeed(
        "Qual é o mecanismo de ação da toxina botulínica tipo A quando injetada num músculo "
        "extraocular?",
        "Aumenta a libertação de acetilcolina na junção neuromuscular",
        "Inibe a libertação de acetilcolina, ao clivar proteínas do complexo SNARE (SNAP-25)",
        "Bloqueia diretamente os recetores de dopamina",
        "Destrói de forma permanente as fibras musculares",
        "B",
        2,
        "Ao impedir a fusão das vesículas de acetilcolina com a membrana neuronal, a toxina "
        "impede a contração muscular, causando uma paralisia transitória.",
    ),
    PerguntaSeed(
        "Depois de uma injeção de toxina botulínica num músculo ocular, até quanto tempo se "
        "podem ainda detetar moléculas da toxina na fenda sináptica?",
        "Apenas alguns minutos",
        "Até cerca de 6 semanas",
        "Vários anos",
        "Nunca chega a ser detetável",
        "B",
        2,
        "Os mecanismos exactos de recuperação da função muscular não são totalmente "
        "conhecidos, apesar deste efeito ser transitório.",
    ),
    PerguntaSeed(
        "Que bactéria produz a toxina botulínica usada terapeuticamente em oftalmologia?",
        "Staphylococcus aureus",
        "Clostridium botulinum",
        "Escherichia coli",
        "Streptococcus pneumoniae",
        "B",
        2,
        "É um bacilo gram-negativo, esporulado e anaeróbio.",
    ),
    PerguntaSeed(
        "Dos sete serotipos conhecidos de toxina botulínica (A a G), qual é o usado com fins "
        "terapêuticos em oftalmologia?",
        "Serotipo A",
        "Serotipo C",
        "Serotipo F",
        "Serotipo G",
        "A",
        2,
        "Apenas a toxina botulínica tipo A (TBA) tem aplicação terapêutica oftalmológica.",
    ),
    PerguntaSeed(
        "Qual é a equivalência de dose aproximada entre as duas marcas comerciais de toxina "
        "botulínica mais usadas?",
        "1U Botox® = 1U Dysport®",
        "1U Botox® = 3U Dysport®",
        "1U Botox® = 10U Dysport®",
        "1U Botox® = 0,5U Dysport®",
        "B",
        2,
        "Esta equivalência é importante para não haver erro de dosagem ao trocar de marca.",
    ),
    PerguntaSeed(
        "Qual erro refractivo é mais frequentemente associado a ambliopia bilateral quando "
        "acentuado nos dois olhos?",
        "Miopia",
        "Hipermetropia",
        "Astigmatismo misto ligeiro",
        "Presbiopia",
        "B",
        2,
        "A hipermetropia acentuada impede uma imagem nítida tanto de longe como de perto, ao "
        "contrário da miopia, que permite normalmente algum grau de visão de perto.",
    ),
    PerguntaSeed(
        "Que instrumento é tipicamente usado, junto com uma fonte de luz, na realização dos "
        "testes do reflexo luminoso (Hirschberg e Krimsky)?",
        "Um tonómetro",
        "Uma barra de prismas horizontais e verticais",
        "Um perímetro de Goldmann",
        "Apenas uma lâmpada de fenda",
        "B",
        2,
        "É com a barra de prismas que se quantifica o desvio observado pelo reflexo luminoso.",
    ),
    PerguntaSeed(
        "Até que idade se recomenda, de forma sistemática, realizar a refração sob cicloplegia "
        "numa criança?",
        "Até 1 ano de idade",
        "Até cerca dos 5 anos de idade",
        "Até aos 15 anos de idade",
        "A cicloplegia nunca é necessária",
        "B",
        2,
        "Antes desta idade é muito difícil confirmar com testes subjectivos que a criança vê "
        "bem; depois, a maioria já colabora de forma fiável.",
    ),
    PerguntaSeed(
        "Qual fármaco cicloplégico tem o pico de ação mais rápido (30 minutos a 1 hora) e "
        "menor duração de efeito do que a atropina?",
        "Atropina",
        "Ciclopentolato",
        "Pilocarpina",
        "Timolol",
        "B",
        2,
        "Por ser mais rápido e ter efeito mais curto, o ciclopentolato é preferido na prática "
        "diária face à atropina.",
    ),
    PerguntaSeed(
        "Por que motivo a atropina deve ser usada com particular cautela em crianças com "
        "Síndrome de Down?",
        "Porque não tem qualquer efeito nesses doentes",
        "Porque estas crianças são descritas como mais sensíveis aos seus efeitos",
        "Porque cura o estrabismo nesses casos específicos",
        "Porque não existe formulação pediátrica do fármaco",
        "B",
        2,
        "É uma das populações de risco assinaladas junto com prematuros de baixo peso e "
        "insuficientes cardíacos.",
    ),
    PerguntaSeed(
        "Um ângulo kappa 'positivo' (reflexo desviado no sentido nasal) pode ser confundido, à "
        "primeira vista, com qual desvio verdadeiro?",
        "Esotropia",
        "Exotropia",
        "Hipertropia",
        "Nistagmo",
        "B",
        2,
        "O cover test distingue os dois quadros: no ângulo kappa a fixação mantém-se ao tapar "
        "o olho adelfo; na exotropia verdadeira, o olho desviado retoma o alinhamento.",
    ),
    PerguntaSeed(
        "No pseudoestrabismo por pregas de epicanto, o que é característico observar-se no "
        "teste de Hirschberg?",
        "O reflexo luminoso mostra um desalinhamento verdadeiro",
        "O reflexo confirma a manutenção do alinhamento ocular, apesar da aparência de "
        "estrabismo",
        "O teste não pode ser realizado nesses casos",
        "O reflexo desaparece por completo",
        "B",
        2,
        "É precisamente essa manutenção do reflexo centrado que permite tranquilizar os pais "
        "de que não há, de facto, estrabismo.",
    ),
    # === Nível 3 (patamares 11-15, 100.000 Kz a 1.000.000 Kz) ================
    # Avançado: leis da motilidade, ângulos subjetivo/objetivo, física ótica
    # e história da cirurgia de estrabismo.
    PerguntaSeed(
        "A Lei de Sherrington, ou da inervação recíproca, aplica-se a que contexto?",
        "À visão binocular, entre os dois olhos",
        "À monocularidade: quando um músculo se contrai, o seu antagonista no mesmo olho "
        "relaxa-se reciprocamente",
        "Apenas aos músculos oblíquos",
        "Apenas a movimentos oculares em crianças",
        "B",
        3,
        "Determina que a inervação simultânea de agonista e antagonista, no mesmo olho, "
        "permite o movimento do globo ocular.",
    ),
    PerguntaSeed(
        "A Lei de Hering, ou da inervação equivalente, determina que:",
        "Cada olho recebe inervação totalmente independente do outro",
        "Quando um músculo se contrai, o seu conjugado no outro olho recebe igual inervação, "
        "para permitir o movimento binocular",
        "Só se aplica a movimentos verticais dos olhos",
        "Só é válida depois de cirurgia de estrabismo",
        "B",
        3,
        "É uma das leis mais importantes do estrabismo por explicar a semiologia dos "
        "estrabismos inconcomitantes inervacionais paréticos.",
    ),
    PerguntaSeed(
        "Na parésia de um músculo extraocular, qual desvio é maior: o desvio primário (com o "
        "olho não parético a fixar) ou o desvio secundário (com o olho parético a fixar)?",
        "São sempre exactamente iguais",
        "O desvio secundário é maior do que o primário",
        "O desvio primário é sempre maior",
        "Não existe qualquer relação entre os dois",
        "B",
        3,
        "É consequência direta da Lei de Hering: para o músculo parético trazer o olho ao seu "
        "campo de ação, o seu conjugado recebe inervação extra, produzindo o desvio secundário.",
    ),
    PerguntaSeed(
        "Segundo a Lei de Hering, numa parésia do reto externo do olho direito, qual músculo "
        "tipicamente mostra hiperação, por ser o seu conjugado (yoke muscle)?",
        "O reto interno do olho esquerdo",
        "O reto externo do olho esquerdo",
        "O oblíquo superior (grande oblíquo) do olho direito",
        "O reto inferior do olho esquerdo",
        "A",
        3,
        "O reto externo do olho direito e o reto interno do olho esquerdo formam um par de "
        "músculos conjugados; a hiperação do conjugado explica-se pela Lei de Hering.",
    ),
    PerguntaSeed(
        "O que distingue o 'ângulo objetivo' do 'ângulo subjetivo' do estrabismo, na "
        "formulação clássica da motilidade ocular?",
        "São sinónimos, sem qualquer diferença prática",
        "O objetivo resulta da diferença entre os eixos visuais medida clinicamente; o "
        "subjetivo reflete a perceção subjetiva do espaço pelo próprio paciente",
        "O ângulo subjetivo só pode ser medido em animais",
        "O ângulo objetivo é, por definição, sempre igual a zero",
        "B",
        3,
        "Ao desvio 'real' ou objetivo (E) junta-se ainda o de aparência (A) e o subjetivo (S), "
        "três conceitos distintos de avaliação do estrabismo.",
    ),
    PerguntaSeed(
        "Opticamente, o ângulo kappa (K) representa a diferença entre:",
        "O eixo visual e o eixo pupilar",
        "O eixo óptico e o eixo antero-posterior da órbita",
        "A córnea e a esclera",
        "A retina e a coroide",
        "A",
        3,
        "O eixo visual e o eixo pupilar raramente coincidem; o ângulo entre eles, o kappa, "
        "tem tipicamente entre 3º e 7º, podendo por vezes ser maior.",
    ),
    PerguntaSeed(
        "Segundo a fórmula clássica que relaciona o desvio real (objetivo) com o desvio "
        "aparente do estrabismo, qual das seguintes está correta?",
        "E = A + K (o desvio objetivo é igual ao ângulo de aparência mais o ângulo kappa)",
        "E = A − K, sempre",
        "K = E × A",
        "Não existe qualquer relação matemática entre estas grandezas",
        "A",
        3,
        "Esta relação explica, por exemplo, como um ângulo kappa de sinal contrário pode "
        "mascarar um estrabismo real, anulando a aparência de desvio.",
    ),
    PerguntaSeed(
        "Como se chama o fenómeno em que, por causa do ângulo kappa, existe um desvio "
        "aparente entre os olhos mas os eixos visuais estão, na realidade, corretamente "
        "posicionados relativamente ao objeto?",
        "Anisocoria",
        "Pseudoestrabismo por ângulo kappa",
        "Ambliopia de privação",
        "Nistagmo optocinético",
        "B",
        3,
        "É o inverso do caso em que o ângulo kappa mascara um desvio real: aqui, cria a "
        "ilusão de um desvio que não existe.",
    ),
    PerguntaSeed(
        "Segundo o relato histórico da cirurgia de estrabismo, quem é geralmente creditado por "
        "ter formulado positivamente, em 1838, a operação de miotomia ocular na sua "
        "'ortopedia operatória'?",
        "Dieffenbach",
        "Stromeyer",
        "Bonnet",
        "J. Guérin",
        "B",
        3,
        "J. Guérin terá 'pressentido' a ideia primeiro, mas foi Stromeyer quem a formulou "
        "positivamente em 1838; Florent Cunier foi o primeiro a praticá-la ao vivo, em 1839, e "
        "Dieffenbach popularizou-a depois.",
    ),
    PerguntaSeed(
        "Qual cirurgião substituiu a miotomia (secção total do músculo) pela tenotomia, ao "
        "estudar as relações dos músculos oculares com a cápsula de Tenon, melhorando a "
        "reputação da cirurgia de estrabismo?",
        "Bonnet",
        "Giraud-Teulon",
        "Buffon",
        "Hering",
        "A",
        3,
        "A tenotomia, ao contrário da miotomia, conserva o músculo por inteiro e apenas "
        "desloca o seu ponto de inserção.",
    ),
    PerguntaSeed(
        "A antiga doutrina de Buffon atribuía a causa do estrabismo a quê -- teoria depois "
        "refutada pelos resultados da estrabotomia?",
        "A uma infeção viral do nervo óptico",
        "A uma desigualdade de força entre os dois olhos",
        "A uma malformação congénita da retina",
        "A um excesso de exposição à luz solar",
        "B",
        3,
        "Os sucessos, por vezes brilhantes, da estrabotomia deram ao sistema muscular o valor "
        "patogénico que a teoria de Buffon não reconhecia.",
    ),
    PerguntaSeed(
        "O oftalmologista Giraud-Teulon definiu classicamente o estrabismo como:",
        "Uma simples miopia não corrigida",
        "Uma rutura no equilíbrio das forças sinérgicas da visão binocular, traduzida numa "
        "desarmonia dos eixos ópticos principais",
        "Uma doença exclusivamente hereditária, sem qualquer componente muscular",
        "Um sinónimo direto de cegueira total",
        "B",
        3,
        "Esta definição do século XIX é ainda hoje reconhecida como uma descrição "
        "essencialmente correta do fenómeno.",
    ),
    PerguntaSeed(
        "O Prémio Nobel de Fisiologia ou Medicina de 1981, atribuído a David Hubel e Torsten "
        "Wiesel, assentou em que descoberta relevante para a compreensão da ambliopia?",
        "A identificação do gene responsável pelo estrabismo",
        "A demonstração de dano irreversível nas colunas de dominância ocular por privação "
        "visual durante o 'período crítico'",
        "A invenção do teste de Hirschberg",
        "A criação da toxina botulínica terapêutica",
        "B",
        3,
        "O trabalho, feito em gatinhos, confirmou que a ambliopia é, na sua essência, um "
        "fenómeno cortical, e não apenas ocular.",
    ),
    PerguntaSeed(
        "Em óptica geométrica, o que significa dizer que a imagem e o objeto são 'conjugados' "
        "através de uma lente?",
        "Que têm exatamente o mesmo tamanho",
        "Que estão ligados por um raio de luz que atravessa a lente, correspondendo um "
        "ponto-objeto a um ponto-imagem",
        "Que a lente não tem qualquer efeito sobre eles",
        "Que este conceito só se aplica a lentes côncavas",
        "B",
        3,
        "Este é o conceito-base usado depois para explicar a técnica de esquiascopia "
        "(retinoscopia) e a distância de trabalho do examinador.",
    ),
    PerguntaSeed(
        "Por definição óptica, um olho diz-se emétrope quando:",
        "Precisa sempre de correção para ver ao longe",
        "A imagem conjugada de um objeto no infinito se forma na retina sem qualquer esforço "
        "de acomodação",
        "Tem sempre algum astigmatismo residual",
        "O termo só se aplica, por convenção, a olhos de crianças",
        "B",
        3,
        "É a partir desta definição que se deriva o conceito de distância de trabalho na "
        "esquiascopia.",
    ),
    PerguntaSeed(
        "Numa técnica de esquiascopia (retinoscopia), ao usar uma lente de trabalho de "
        "+1,50D, a que distância aproximada se forma a imagem conjugada -- e portanto a que "
        "distância se deve posicionar o examinador?",
        "1 metro",
        "0,66 metros",
        "0,50 metros",
        "2 metros",
        "B",
        3,
        "A distância da imagem conjugada é o inverso da vergência da lente, em metros: "
        "1 ÷ 1,50 ≈ 0,66 m.",
    ),
    PerguntaSeed(
        "O retinoscópio de franja veio substituir que técnica mais antiga, usada para produzir "
        "o feixe de luz na esquiascopia, por ser mais difícil de manejar?",
        "O uso de um espelho para refletir o feixe de luz",
        "O autorrefractómetro",
        "A lâmpada de fenda",
        "O oftalmoscópio indireto",
        "A",
        3,
        "O retinoscópio de franja tornou a técnica mais fácil ao produzir diretamente um "
        "feixe de luz retangular, ajustável em espessura e orientação.",
    ),
    PerguntaSeed(
        "Numa paralisia do músculo grande oblíquo (oblíquo superior) em que a função de "
        "depressão é a mais afetada, qual músculo tende a mostrar hiperação, por ser o seu "
        "conjugado contralateral?",
        "O reto inferior contralateral",
        "O reto superior homolateral",
        "O oblíquo inferior (pequeno oblíquo) homolateral",
        "O reto externo contralateral",
        "A",
        3,
        "Segundo as regras de Hering e Sherrington aplicadas a este quadro, a hiperação do "
        "reto inferior contralateral surge quando é a depressão a função mais comprometida.",
    ),
]


def semear(sessao: Session) -> tuple[int, int]:
    """Insere as perguntas de `PERGUNTAS` que ainda não existem (procuradas
    pelo texto exacto da pergunta). Devolve (inseridas, já_existentes)."""
    existentes = set(sessao.scalars(select(PerguntaJogo.texto_pergunta)).all())
    inseridas = 0
    ja_existentes = 0
    for pergunta in PERGUNTAS:
        if pergunta.texto_pergunta in existentes:
            ja_existentes += 1
            continue
        sessao.add(
            PerguntaJogo(
                texto_pergunta=pergunta.texto_pergunta,
                opcao_a=pergunta.opcao_a,
                opcao_b=pergunta.opcao_b,
                opcao_c=pergunta.opcao_c,
                opcao_d=pergunta.opcao_d,
                resposta_correta=RespostaOpcao(pergunta.resposta_correta),
                nivel_dificuldade=pergunta.nivel_dificuldade,
                explicacao=pergunta.explicacao,
            )
        )
        inseridas += 1
    sessao.commit()
    return inseridas, ja_existentes


def main() -> int:
    sessao = SessionLocal()
    try:
        inseridas, ja_existentes = semear(sessao)
    finally:
        sessao.close()
    print(f"{inseridas} perguntas inseridas, {ja_existentes} já existiam.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

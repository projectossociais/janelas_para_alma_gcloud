"""perguntas do jogo em linguagem simples (225 reescritas no lugar)

Revision ID: b4e7d2a9c6f1
Revises: 87f3ac3f0e85
Create Date: 2026-10-19 00:00:00.000000

Migração só de dados. Os jogadores queixaram-se de que as perguntas eram
difíceis demais: termos clínicos e opções em frase completa. As 225 perguntas
de `reserva_perguntas_jogo.py` foram reescritas em linguagem simples, com a
dificuldade a vir da raridade da informação (ver o módulo).

`semear_perguntas` procura pelo texto exacto, por isso sozinho deixava as
perguntas antigas na tabela e juntava-lhes as novas (450). Esta migração
reescreve cada linha antiga NO LUGAR -- o mesmo `id`, porque
`partidas_jogo.pergunta_atual_id` guarda o UUID da pergunta em curso (sem
FK) -- e a letra certa e o nível de cada posição não mudam, por isso um jogo
a meio continua válido. Depois chama `semear_perguntas`, que insere o que
faltar (numa base de dados onde a pergunta antiga nunca existiu) e não
duplica nada.

Os textos antigos e novos ficam congelados aqui, em literais: a migração não
pode depender de `PERGUNTAS`, que continuará a mudar. Numa base de dados
nova, `e5b1c8d2a4f7` já insere as perguntas novas e os UPDATE daqui não
apanham nenhuma linha.

Downgrade: não repõe os textos antigos, de propósito -- são dados de
referência, e voltar a subir é seguro (idempotente), como em `e5b1c8d2a4f7`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.repositories.reserva_perguntas_jogo import semear_perguntas

revision: str = "b4e7d2a9c6f1"
down_revision: Union[str, None] = "87f3ac3f0e85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_perguntas_jogo = sa.table(
    "perguntas_jogo",
    sa.column("texto_pergunta", sa.Text),
    sa.column("opcao_a", sa.Text),
    sa.column("opcao_b", sa.Text),
    sa.column("opcao_c", sa.Text),
    sa.column("opcao_d", sa.Text),
    sa.column(
        "resposta_correta", sa.Enum("A", "B", "C", "D", name="resposta_opcao", create_type=False)
    ),
    sa.column("explicacao", sa.Text),
    sa.column("categoria", sa.Text),
)

_CAMPOS = (
    "texto_pergunta",
    "opcao_a",
    "opcao_b",
    "opcao_c",
    "opcao_d",
    "resposta_correta",
    "explicacao",
    "categoria",
)

# (texto antigo, (os valores novos, pela ordem de `_CAMPOS`))
_REESCRITAS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "O que é o estrabismo, em termos simples?",
        (
            "Que parte do olho se fecha quando dormimos?",
            "A pupila",
            "A íris",
            "A pálpebra",
            "O nervo óptico",
            "C",
            "As pálpebras fecham-se para proteger e humedecer o olho durante o sono.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Como se chama o desvio ocular que só aparece quando se rompe a fusão binocular (por "
            "exemplo, ao tapar um dos olhos), não estando presente com os dois olhos abertos?"
        ),
        (
            "A parte branca do olho chama-se…",
            "Pupila",
            "Íris",
            "Esclera",
            "Pestana",
            "C",
            "A esclera é a camada branca e resistente que envolve o olho.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Até aos 3 anos de idade, qual é um dos principais motivos de consulta em oftalmologia "
            "pediátrica que, afinal, não é um verdadeiro estrabismo?"
        ),
        (
            "Quantos olhos tem uma pessoa?",
            "Um",
            "Três",
            "Dois",
            "Quatro",
            "C",
            "Temos dois olhos, e o cérebro junta as imagens dos dois.",
            "anatomia_ocular",
        ),
    ),
    (
        "As dores de cabeça (cefaleias) numa criança são, segundo a evidência disponível:",
        (
            "De onde vêm as lágrimas?",
            "Do interior do nariz",
            "Do fundo da boca",
            "De glândulas junto ao olho",
            "Do canal dentro das orelhas",
            "C",
            "As glândulas lacrimais, por cima de cada olho, produzem as lágrimas.",
            "anatomia_ocular",
        ),
    ),
    (
        "Ver filmes em 3D faz mal à visão de uma criança?",
        (
            "Para onde escorrem as lágrimas quando choramos muito?",
            "Para as orelhas",
            "Para a garganta só",
            "Também para o nariz",
            "Para o cérebro",
            "C",
            "Um pequeno canal liga o olho ao nariz; por isso o nariz pinga quando choramos.",
            "anatomia_ocular",
        ),
    ),
    (
        "Por que é que a hipermetropia é considerada 'fisiológica' numa criança pequena?",
        (
            "O que fica atrás do olho e recebe a imagem?",
            "A sobrancelha",
            "A pestana",
            "A retina",
            "A testa",
            "C",
            "A retina é uma camada fina no fundo do olho que capta a luz.",
            "anatomia_ocular",
        ),
    ),
    (
        "O que é a emetropização?",
        (
            "Que parte do olho pode ser castanha, verde ou azul?",
            "A pupila",
            "A esclera",
            "A íris",
            "A pálpebra",
            "C",
            "A íris é o anel colorido à volta da pupila.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Um pai conta que o filho 'se debruça sobre os cadernos' para ler. Isso deve-se, "
            "sobretudo, a:"
        ),
        (
            "O que protege o olho de uma pancada de lado?",
            "As pestanas compridas",
            "As lágrimas salgadas",
            "Os ossos da cara",
            "A pupila aberta",
            "C",
            "O olho fica protegido dentro de uma cavidade de osso, a órbita.",
            "anatomia_ocular",
        ),
    ),
    (
        "Que estrutura do olho é responsável pela acomodação (focar objectos próximos)?",
        (
            "O olho mexe-se graças a quê?",
            "Ao sangue",
            "Às lágrimas",
            "A pequenos músculos",
            "Aos ossos da cara",
            "C",
            "Seis pequenos músculos à volta de cada olho fazem-no mexer em todas as direcções.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Quando os dois pais são míopes, qual é a percentagem aproximada de filhos que também "
            "podem vir a ser míopes, citada na avaliação da história familiar?"
        ),
        (
            "O que faz a pupila quando está escuro?",
            "Fica mais pequena",
            "Fica vermelha",
            "Fica maior",
            "Desaparece",
            "C",
            "No escuro, a pupila abre-se para deixar entrar mais luz.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Até que idade aproximada costuma ser possível recuperar a acuidade visual perdida por "
            "ambliopia (o chamado 'olho preguiçoso')?"
        ),
        (
            "O olho de um bebé é muito mais pequeno que o de um adulto?",
            "Sim, dez vezes menor",
            "Sim, metade do tamanho",
            "Não, é quase igual",
            "Não, é bem maior",
            "C",
            "Ao nascer, o olho já tem cerca de três quartos do tamanho adulto.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Qual é o tratamento da ambliopia considerado mais eficaz, apesar de ser mal tolerado "
            "por algumas crianças (e alguns pais)?"
        ),
        (
            "Precisamos de luz para ver?",
            "Não, nunca é preciso",
            "Só para ver as cores vivas",
            "Sim, sem luz não vemos",
            "Só para ler",
            "C",
            "O olho capta a luz que as coisas reflectem; sem luz nenhuma, não se vê.",
            "ciencia_ocular",
        ),
    ),
    (
        "O que distingue, de forma simples, a miopia da hipermetropia quanto à visão de perto?",
        (
            "Com que sentido vemos as cores?",
            "A audição",
            "O olfacto",
            "A visão",
            "O paladar",
            "C",
            "A visão é o sentido que nos deixa ver formas, luz e cores.",
            "ciencia_ocular",
        ),
    ),
    (
        "Qual destas NÃO consta entre as causas clássicas de ambliopia?",
        (
            "Ao fechar um olho, ainda conseguimos ver?",
            "Não, nada",
            "Só no escuro",
            "Só as cores mais fortes",
            "Sim, com o outro olho",
            "D",
            "Um olho sozinho vê, mas é mais difícil calcular as distâncias.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Por que motivo se pergunta, na história clínica de uma criança com desvio ocular, se "
            "houve complicações peri-parto como hemorragias intracranianas?"
        ),
        (
            "Porque é que vemos mal debaixo de água sem óculos de mergulho?",
            "A água é fria",
            "A água tem sal",
            "A água muda o foco",
            "Os peixes atrapalham",
            "C",
            (
                "A água tira o poder de focar da córnea; com óculos de mergulho fica ar à frente "
                "dos olhos."
            ),
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Numa criança com visão binocular normal, por volta de que idade se espera já haver um "
            "bom alinhamento ocular?"
        ),
        (
            "Qual destes sentidos usamos para ler um livro?",
            "O olfacto",
            "O paladar",
            "A visão",
            "A audição",
            "C",
            "Para ler um livro impresso usamos os olhos.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "O que avalia, na prática, o 'teste do olhar preferencial' com cartões de Teller, "
            "usado em bebés?"
        ),
        (
            "Porque é que de noite vemos pior as cores?",
            "As cores dormem",
            "Os olhos encolhem",
            "Há pouca luz",
            "A lua apaga as cores",
            "C",
            "As células que vêem cores precisam de bastante luz para funcionar.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Para além da história clínica e do exame dos movimentos oculares, qual exame nunca "
            "deve ser esquecido numa consulta de estrabismo pediátrico, por poder revelar doenças "
            "graves do fundo do olho?"
        ),
        (
            "Uma lupa serve para quê?",
            "Ver as coisas mais pequenas",
            "Ver no escuro",
            "Ver as coisas maiores",
            "Ver as cores",
            "C",
            "A lupa é uma lente que aumenta o tamanho daquilo que se vê.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Qual destas estruturas do olho é responsável por dar cor à íris e regular, através da "
            "pupila, a quantidade de luz que entra?"
        ),
        (
            "O arco-íris mostra que a luz do sol tem…",
            "Uma só cor",
            "Nenhuma cor",
            "Muitas cores juntas",
            "Só preto e branco",
            "C",
            "As gotas de chuva separam a luz do sol nas suas várias cores.",
            "ciencia_ocular",
        ),
    ),
    (
        "O que é, em termos simples, a esclera?",
        (
            "Ver bem ajuda as crianças em quê?",
            "A dormir menos horas à noite",
            "A crescer mais",
            "A aprender na escola",
            "A comer mais",
            "C",
            "Grande parte do que se aprende na escola entra pelos olhos.",
            "ciencia_ocular",
        ),
    ),
    (
        "Qual é a função do nervo óptico?",
        (
            "Que animal é famoso pela vista apurada, capaz de ver longe?",
            "A minhoca",
            "A toupeira",
            "O caracol",
            "A águia",
            "D",
            "As águias vêem uma presa pequena a grande distância.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Por que motivo se costuma recomendar que crianças façam pausas regulares ao usar "
            "tablets ou telemóveis durante muito tempo?"
        ),
        (
            "Que objecto ajuda pessoas cegas a andar na rua?",
            "Um guarda-chuva",
            "Um chapéu",
            "Uma bengala branca",
            "Uma mochila",
            "C",
            (
                "A bengala branca ajuda a detectar obstáculos e avisa os outros de que a pessoa "
                "não vê."
            ),
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Que hábito simples ajuda a repor a lubrificação natural da superfície do olho durante "
            "tarefas visuais concentradas, como ler ou usar um ecrã?"
        ),
        (
            "Como se costuma chamar a quem tem os olhos desalinhados?",
            "Míope",
            "Daltónico de nascença",
            "Vesgo ou estrábico",
            "Cego de um olho",
            "C",
            "\"Vesgo\" é a palavra popular; o nome médico é estrabismo.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "A chamada regra '20-20-20', popularmente usada para prevenir fadiga ocular associada "
            "a ecrãs, propõe o quê?"
        ),
        (
            "O estrabismo pode ser tratado?",
            "Não, nunca",
            "Só com chás",
            "Sim, muitas vezes",
            "Só com chás e rezas",
            "C",
            (
                "Óculos, penso, exercícios ou cirurgia ajudam muitos casos, sobretudo se tratados "
                "cedo."
            ),
            "doencas_estrabismo",
        ),
    ),
    (
        "O que distingue, de forma simples, a miopia da hipermetropia?",
        (
            "Um olho que vira para o nariz está a desviar para…",
            "Fora",
            "Cima",
            "Baixo",
            "Dentro",
            "D",
            "Quando o olho desvia para o lado do nariz, diz-se que desvia para dentro.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é o astigmatismo, em termos simples?",
        (
            "Um olho que vira para a orelha está a desviar para…",
            "Dentro",
            "Cima",
            "Fora",
            "Baixo",
            "C",
            "Quando o olho desvia para o lado da orelha, diz-se que desvia para fora.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Que tipo de lentes são geralmente usadas para corrigir a miopia?",
        (
            "O estrabismo é culpa da criança?",
            "Sim, por ver televisão",
            "Sim, por ser preguiçosa",
            "Sim, por comer doces",
            "Não, não é culpa de ninguém",
            "D",
            "O estrabismo não é culpa da criança nem dos pais; tem causas médicas.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Que tipo de lentes são geralmente usadas para corrigir a hipermetropia?",
        (
            "O estrabismo pode passar de pais para filhos?",
            "Não, nunca",
            "Só entre vizinhos próximos",
            "Só por contágio na escola",
            "Sim, pode haver na família",
            "D",
            "Ter familiares com estrabismo aumenta a probabilidade de o ter.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é, na prática, a ambliopia, popularmente chamada de 'olho preguiçoso'?",
        (
            "Um terçol é…",
            "Um tipo de miopia forte",
            "Um olho torto desde bebé",
            "Uma mancha escura na cor do olho",
            "Um caroço inflamado na pálpebra",
            "D",
            "O terçol é uma pequena inflamação na pálpebra; compressas mornas ajudam.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Qual é o tratamento clássico mais eficaz da ambliopia, apesar de exigir boa adesão da "
            "criança?"
        ),
        (
            "O que é a miopia?",
            "Ver tudo amarelo",
            "Não ver de dia",
            "Ver tudo a dobrar",
            "Ver mal ao longe",
            "D",
            "Quem tem miopia vê bem ao perto mas desfocado ao longe.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Além da oclusão, que fármaco é por vezes usado para borrar temporariamente a visão do "
            "olho bom no tratamento da ambliopia?"
        ),
        (
            "O que é a hipermetropia, em palavras simples?",
            "Ver tudo com tons de vermelho",
            "Não ter pestanas",
            "Esforço a focar ao perto",
            "Ver tudo maior",
            "C",
            "Na hipermetropia o olho tem de se esforçar mais para focar, sobretudo ao perto.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é, em termos gerais, o pseudoestrabismo?",
        (
            "Uma criança que esfrega muito os olhos ao ler pode…",
            "Estar a brincar com os irmãos",
            "Ter fome ou sede",
            "Ter frio nas mãos",
            "Precisar de exame à vista",
            "D",
            "Esfregar os olhos ao ler pode ser sinal de cansaço visual ou de precisar de óculos.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Por que é importante um exame oftalmológico em idade pré-escolar, mesmo sem queixas "
            "aparentes da criança?"
        ),
        (
            "Olhos vermelhos e com comichão na primavera podem ser…",
            "Miopia",
            "Estrabismo",
            "Catarata",
            "Alergia",
            "D",
            "O pólen pode causar alergia nos olhos, com comichão e vermelhidão.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "O que avalia, de forma simples, um teste de acuidade visual com uma tabela de letras "
            "(como a de Snellen)?"
        ),
        (
            "A conjuntivite pode passar a outras pessoas?",
            "Nunca passa",
            "Só pelo olhar",
            "Só ao falar ao telefone",
            "Algumas sim, pelas mãos",
            "D",
            "Conjuntivites por vírus ou bactérias passam pelas mãos e toalhas; alergias não.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Segundo a literatura de divulgação sobre saúde visual usada como base deste jogo, que "
            "fração aproximada da informação que recebemos do mundo chega até nós através da "
            "visão?"
        ),
        (
            "Ver o mesmo objecto duas vezes chama-se…",
            "Visão nocturna",
            "Visão de cor",
            "Visão ao longe",
            "Visão dupla",
            "D",
            "Visão dupla é ver duas imagens do mesmo objecto.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é a retina, em termos simples?",
        (
            "O estrabismo pode fazer a criança ver pior de um olho?",
            "Não, nunca",
            "Só nos adultos",
            "Só de noite, no escuro",
            "Sim, se não for tratado",
            "D",
            "Sem tratamento, o olho desviado pode ficar preguiçoso.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Por que motivo a pupila fica mais pequena quando há muita luz ambiente?",
        (
            "Uma criança com estrabismo vai ficar sempre assim?",
            "Sim, sempre",
            "Só se for rapaz",
            "Não, muitas vezes trata-se",
            "Só se não usar óculos",
            "C",
            "Com tratamento a tempo, muitas crianças melhoram bastante.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é, basicamente, a acomodação visual?",
        (
            "O estrabismo pode aparecer só quando a criança está cansada?",
            "Não, nunca",
            "Só ao domingo",
            "Sim, pode",
            "Só à praia",
            "C",
            "Alguns desvios aparecem só com cansaço, doença ou ao olhar ao longe.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Um pai refere que o filho aproxima muito o rosto do caderno para ler. Isto deve-se, "
            "na maioria das vezes, a:"
        ),
        (
            "Uma pancada forte no olho deve ser vista por…",
            "Um vizinho",
            "Um cabeleireiro",
            "Ninguém",
            "Um médico",
            "D",
            "Mesmo que pareça pouca coisa, uma pancada forte pode ferir o interior do olho.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Até que idade aproximada é geralmente mais eficaz tratar a ambliopia?",
        (
            "Qual destes NÃO é um problema de visão?",
            "A miopia",
            "O estrabismo",
            "A catarata nos idosos",
            "A dor de dentes",
            "D",
            "A dor de dentes é um problema da boca, não dos olhos.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é, em termos simples, a hipermetropia?",
        (
            "Ver as linhas tortas ou desfocadas num só sentido pode ser…",
            "Gripe",
            "Sarampo",
            "Constipação",
            "Astigmatismo",
            "D",
            "No astigmatismo, a visão fica desfocada em certas direcções.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Qual destas NÃO é uma boa prática recomendada para a saúde ocular no dia a dia?",
        (
            "Olhos muito secos podem causar…",
            "Febre muito alta e arrepios",
            "Dor de barriga",
            "Tosse forte",
            "Ardor e sensação de areia",
            "D",
            "Com o olho seco sente-se ardor, como se houvesse areia no olho.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que faz, basicamente, a glândula lacrimal?",
        (
            "O estrabismo pode afectar a confiança de uma criança?",
            "Não, nunca",
            "Só nos adultos",
            "Sim, pode",
            "Só em férias",
            "C",
            "Algumas crianças sentem vergonha; tratar ajuda a visão e a auto-estima.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Uma criança com estrabismo raramente se queixa de visão dupla, ao contrário do que "
            "acontece tipicamente num adulto com um desvio ocular recente. Por que motivo?"
        ),
        (
            "Uma criança que tropeça muito pode estar a ver…",
            "Bem demais",
            "A cores",
            "De lado",
            "Mal",
            "D",
            "Tropeçar muito pode ser sinal de que a criança não vê bem.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Qual destas causas de ambliopia resulta do próprio estrabismo, e não de um erro "
            "refrativo?"
        ),
        (
            "A catarata aparece sobretudo em quem?",
            "Bebés",
            "Adolescentes",
            "Atletas de alta competição",
            "Pessoas mais velhas",
            "D",
            "A catarata é muito mais frequente com a idade.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Qual é uma causa clássica de ambliopia de privação numa criança pequena?",
        (
            "Uma criança que se aproxima muito do caderno para ler pode…",
            "Ter sono",
            "Estar com fome",
            "Precisar de óculos",
            "Gostar do caderno",
            "C",
            "Aproximar-se muito para ver pode ser sinal de problema de visão.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é, em termos simples, um exame de refração?",
        (
            "Fechar um olho ao sol forte pode ser sinal de…",
            "Gripe",
            "Fome",
            "Alegria e boa disposição",
            "Estrabismo",
            "D",
            "Algumas crianças com estrabismo fecham um olho ao sol; vale a pena um exame.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Qual destas estruturas NÃO faz parte da anatomia do olho?",
        (
            "Que bebida é melhor para a saúde dos olhos e do corpo?",
            "Refrigerante",
            "Álcool",
            "Água",
            "Bebida energética",
            "C",
            "Beber água ajuda a manter os olhos e o corpo hidratados.",
            "estilo_vida_visao",
        ),
    ),
    (
        "O que é, na prática, o 'campo visual'?",
        (
            "Fumar faz bem ou mal aos olhos?",
            "Faz bem",
            "Não faz nada",
            "Faz mal",
            "Só faz bem de manhã",
            "C",
            "Fumar aumenta o risco de cataratas e outras doenças dos olhos.",
            "estilo_vida_visao",
        ),
    ),
    (
        (
            "Por que motivo os óculos de sol de má qualidade, sem proteção UV adequada, podem ser "
            "prejudiciais?"
        ),
        (
            "Que alimentos fazem bem aos olhos?",
            "Batatas fritas e salgadas",
            "Doces e bolos",
            "Legumes e frutas coloridas",
            "Refrigerantes bem gelados",
            "C",
            "Frutas e legumes coloridos têm vitaminas boas para os olhos.",
            "estilo_vida_visao",
        ),
    ),
    (
        "O que é, em termos simples, a presbiopia?",
        (
            "O peixe faz bem aos olhos porque tem…",
            "Muito açúcar",
            "Muito sal",
            "Corantes",
            "Gorduras boas",
            "D",
            "O peixe tem gorduras boas (ómega-3) que ajudam os olhos.",
            "estilo_vida_visao",
        ),
    ),
    (
        "Qual é, em geral, o erro refrativo fisiológico mais comum numa criança muito pequena?",
        (
            "Fazer desporto faz bem aos olhos?",
            "Não, faz mal",
            "Só se for de noite",
            "Sim, faz bem ao corpo todo",
            "Só se estiver a chover",
            "C",
            "O exercício melhora a circulação e a saúde em geral, incluindo a dos olhos.",
            "estilo_vida_visao",
        ),
    ),
    (
        "O que é a anisometropia, em termos simples?",
        (
            "Antes de pôr gotas nos olhos, deve-se…",
            "Esfregar os olhos",
            "Correr um pouco",
            "Comer um doce",
            "Lavar as mãos",
            "D",
            "Mãos limpas evitam levar micróbios para o olho.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é a esclerótica, também chamada esclera?",
        (
            "Pode-se usar o colírio de outra pessoa?",
            "Sim, sempre que quiser",
            "Sim, se for amigo",
            "Sim, se for barato",
            "Não, cada um o seu",
            "D",
            "Partilhar gotas pode passar infecções; use só o que o médico receitou.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, na prática, a conjuntiva?",
        (
            "Brincar com ponteiros laser apontados aos olhos é…",
            "Seguro",
            "Divertido e inofensivo",
            "Perigoso",
            "Bom para a vista",
            "C",
            "A luz laser pode queimar a retina em segundos.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Qual é, na prática, o objetivo de um teste de rastreio visual feito na escola?",
        (
            "Olhar directamente para o sol faz mal?",
            "Não, faz bem",
            "Só ao fim da tarde",
            "Só se estiver muito frio",
            "Sim, pode queimar a retina",
            "D",
            "Olhar para o sol, mesmo num eclipse, pode causar danos permanentes.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Segundo os princípios gerais de saúde visual pediátrica, a partir de que altura se "
            "recomenda a primeira avaliação oftalmológica de uma criança, mesmo sem sintomas?"
        ),
        (
            "Para ver um eclipse do sol, o que se deve usar?",
            "Óculos de sol normais",
            "Nada, olhar directamente",
            "Óculos próprios para eclipse",
            "Um copo de vidro",
            "C",
            "Só filtros próprios para eclipse protegem; os óculos de sol não bastam.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, de forma simples, um erro refrativo?",
        (
            "Se entrar um produto químico no olho, o que fazer primeiro?",
            "Esfregar com força",
            "Fechar e esperar",
            "Lavar com muita água",
            "Pôr manteiga",
            "C",
            "Lavar logo com água corrente durante vários minutos e depois ir ao médico.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Como se costuma chamar, popularmente, ao uso combinado de óculos para perto e para "
            "longe na mesma armação?"
        ),
        (
            "Que objecto NÃO se deve usar para tirar algo do olho?",
            "Água limpa",
            "Um lenço limpo",
            "Uma agulha",
            "Soro fisiológico",
            "C",
            "Objectos pontiagudos podem ferir gravemente o olho.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Qual é a principal diferença prática entre óculos e lentes de contacto?",
        (
            "Para limpar a remela de um bebé, usa-se…",
            "O dedo sujo",
            "Um pano do chão",
            "Uma compressa limpa e húmida",
            "A própria saliva",
            "C",
            "Uma compressa limpa, uma para cada olho, evita infecções.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Uma criança que estreita muito os olhos para ver ao longe pode estar a compensar, "
            "sobretudo, que erro refrativo?"
        ),
        (
            "Toalhas partilhadas podem espalhar…",
            "Miopia",
            "Daltonismo e cegueira nocturna",
            "Conjuntivites",
            "Estrabismo",
            "C",
            "Algumas conjuntivites passam pelas toalhas e pelas mãos.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Qual destas situações justifica encaminhamento urgente a um oftalmologista numa "
            "criança pequena?"
        ),
        (
            "Quem já usa óculos deve ir ao médico dos olhos…",
            "Nunca mais",
            "Com regularidade",
            "Só aos 90 anos",
            "Só se os partir",
            "B",
            "A graduação muda com o tempo; consultas regulares mantêm os óculos certos.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, em termos simples, a diplopia?",
        (
            "Se a vista piorar de repente, deve-se…",
            "Esperar um ano",
            "Comprar óculos na rua",
            "Ir logo ao médico",
            "Ignorar",
            "C",
            "Uma perda súbita de visão é uma urgência.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Um estrabismo que aparece só de vez em quando, por exemplo quando a criança está "
            "cansada, chama-se:"
        ),
        (
            "Óculos comprados na rua, sem receita, podem…",
            "Curar a miopia",
            "Cansar a vista",
            "Mudar a cor dos olhos",
            "Fazer ver no escuro",
            "B",
            "Óculos que não são à medida podem cansar e esconder problemas.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, em termos simples, a esotropia?",
        (
            "No trabalho com pó ou faíscas, o que protege os olhos?",
            "Um boné com pala",
            "Luvas grossas",
            "Óculos de protecção",
            "Um relógio de pulso",
            "C",
            "Óculos de protecção evitam ferimentos graves.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, em termos simples, a exotropia?",
        (
            "Lentes de contacto podem ser usadas na piscina?",
            "Sim, sempre",
            "Não é aconselhado",
            "Sim, até fazem bem",
            "Só no mar",
            "B",
            "A água pode ter micróbios que se agarram às lentes e infectam o olho.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Um desvio vertical, em que um olho fica mais alto do que o outro, chama-se:",
        (
            "Para proteger os olhos dos bebés do sol, usa-se…",
            "Mais luz",
            "Nada",
            "Chapéu e sombra",
            "Um espelho",
            "C",
            "Sombra, chapéu e, se possível, óculos de sol próprios protegem os olhos dos bebés.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, na prática, o 'teste de cover' (tapar e destapar um olho)?",
        (
            "Crianças precisam de óculos de sol?",
            "Não, nunca precisam",
            "Sim, o sol faz-lhes mal",
            "Só os adultos precisam",
            "Só no Inverno",
            "B",
            "Os olhos das crianças deixam passar mais luz; precisam de protecção.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Qual profissional está mais indicado para diagnosticar e tratar o estrabismo?",
        (
            "Quem trata a visão das crianças?",
            "O mecânico",
            "O cozinheiro da escola",
            "O oftalmologista",
            "O carteiro",
            "C",
            "O oftalmologista é o médico que cuida dos olhos, também dos das crianças.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que faz, tipicamente, um ortoptista, em articulação com o oftalmologista?",
        (
            "Os óculos de uma criança devem ser revistos quando?",
            "Nunca mais na vida",
            "Só aos 18 anos",
            "Só quando se partirem de vez",
            "Quando o médico indicar",
            "D",
            "A visão das crianças muda; o médico diz quando rever a graduação.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, de forma simples, o daltonismo?",
        (
            "Deve-se coçar o olho com as mãos sujas?",
            "Sim, sempre",
            "Sim, faz bem",
            "Só de manhã, ao acordar",
            "Não, pode infectar",
            "D",
            "As mãos sujas levam micróbios para o olho.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Que tipo de células da retina são responsáveis pela visão das cores e pela visão "
            "detalhada em boas condições de luz?"
        ),
        (
            "A maquilhagem dos olhos deve ser partilhada?",
            "Sim, sempre que der",
            "Não, pode passar infecções",
            "Só entre irmãs",
            "Só se for de marca",
            "B",
            "Rímel e lápis partilhados podem passar micróbios.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Os bastonetes da retina são sobretudo importantes para:",
        (
            "Ao sentir algo no olho, o melhor é não…",
            "Piscar",
            "Lavar com água",
            "Esfregar",
            "Pedir ajuda",
            "C",
            "Esfregar pode arranhar a córnea; lave com água.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Qual é a forma mais comum de daltonismo?",
        (
            "Porque deve uma criança usar óculos com lentes resistentes?",
            "Para pesarem mais",
            "Para brilharem ao sol",
            "Para mudarem de cor ao sol",
            "Para não ferirem ao partir",
            "D",
            "Lentes resistentes protegem em quedas e brincadeiras.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Um bebé que ainda não fala pode ter a sua visão avaliada sobretudo através de que método?",
        (
            "Antes de dormir, as lentes de contacto devem…",
            "Ficar nos olhos",
            "Ser lavadas com água da torneira",
            "Ser tiradas e guardadas",
            "Ser deitadas fora sempre",
            "C",
            "Tirar as lentes à noite reduz muito o risco de infecção.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Em que se baseia o teste de Hirschberg?",
        (
            "Porque é que dois olhos vêem melhor a profundidade do que um?",
            "Um olho vê só cores",
            "Cada olho vê de um ângulo",
            "Dois olhos têm mais lágrimas",
            "Um olho está sempre fechado",
            "B",
            "O cérebro compara as duas imagens, ligeiramente diferentes, e calcula a distância.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "No teste de Hirschberg, um reflexo luminoso localizado no bordo do limbo (cerca de "
            "45º) corresponde a um desvio aproximado de quantas dioptrias prismáticas?"
        ),
        (
            "Quando lemos, os olhos rodam um pouco para…",
            "Fora, para as orelhas",
            "Dentro, um para o outro",
            "Cima, para a testa",
            "Lado nenhum",
            "B",
            "Para ver ao perto, os dois olhos convergem, rodando para o nariz.",
            "ciencia_ocular",
        ),
    ),
    (
        "O teste de Krimsky é especialmente útil em que situação?",
        (
            "O que faz o cristalino para vermos de perto?",
            "Fica mais escuro",
            "Sai do lugar",
            "Fica mais curvo",
            "Pára de trabalhar",
            "C",
            "O cristalino muda de forma para focar ao perto; chama-se acomodação.",
            "ciencia_ocular",
        ),
    ),
    (
        "Qual é a principal diferença entre o teste de 'cover' e o teste de 'uncover'?",
        (
            "Ao passar do sol para uma sala escura, porque vemos mal uns segundos?",
            "A sala não tem cor",
            "O olho ainda se adapta",
            "O sol queimou os olhos",
            "As pestanas fecharam",
            "B",
            "A pupila e a retina precisam de tempo para se ajustar a pouca luz.",
            "ciencia_ocular",
        ),
    ),
    (
        "No cover test alternado, o que é essencial garantir durante a manobra?",
        (
            "O que mede uma \"dioptria\"?",
            "O peso dos óculos",
            "O tamanho do olho",
            "A força de uma lente",
            "A cor da lente",
            "C",
            "Quanto maior o número de dioptrias, mais forte é a lente.",
            "ciencia_ocular",
        ),
    ),
    (
        "Para que serve, especificamente, o 'cover test prismático'?",
        (
            "Uma lente para miopia tem o sinal…",
            "Mais (+)",
            "Menos (−)",
            "Igual (=)",
            "Vezes (×)",
            "B",
            "As lentes para miopia são negativas; as para hipermetropia são positivas.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Qual é o mecanismo de ação da toxina botulínica tipo A quando injetada num músculo "
            "extraocular?"
        ),
        (
            "Porque é que as letras do quadro de exame ficam mais pequenas em baixo?",
            "Para poupar papel",
            "Para medir até onde vemos",
            "Por moda",
            "Para enganar o doente",
            "B",
            "A linha mais pequena que se lê bem indica a acuidade visual.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Depois de uma injeção de toxina botulínica num músculo ocular, até quanto tempo se "
            "podem ainda detetar moléculas da toxina na fenda sináptica?"
        ),
        (
            "No olho míope, a imagem forma-se onde?",
            "Atrás da retina",
            "À frente da retina",
            "Na pálpebra",
            "Na pestana",
            "B",
            "No olho míope, a luz foca antes de chegar à retina, e a imagem chega desfocada.",
            "ciencia_ocular",
        ),
    ),
    (
        "Que bactéria produz a toxina botulínica usada terapeuticamente em oftalmologia?",
        (
            "O nervo óptico liga o olho a quê?",
            "Ao coração",
            "Ao cérebro",
            "Ao estômago",
            "Ao nariz",
            "B",
            "O nervo óptico leva os sinais do olho para o cérebro.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Dos sete serotipos conhecidos de toxina botulínica (A a G), qual é o usado com fins "
            "terapêuticos em oftalmologia?"
        ),
        (
            "Que parte do olho ajusta o tamanho da pupila?",
            "A retina",
            "A pestana",
            "A íris",
            "A lágrima",
            "C",
            "A íris é um músculo que abre e fecha a pupila.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Qual é a equivalência de dose aproximada entre as duas marcas comerciais de toxina "
            "botulínica mais usadas?"
        ),
        (
            "A córnea fica em que parte do olho?",
            "Atrás, junto ao nervo",
            "Na frente do olho",
            "Dentro da pálpebra",
            "Na sobrancelha",
            "B",
            "A córnea é a camada transparente que cobre a frente do olho.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Qual erro refractivo é mais frequentemente associado a ambliopia bilateral quando "
            "acentuado nos dois olhos?"
        ),
        (
            "A conjuntiva é…",
            "Um osso da cara",
            "Uma película sobre o branco",
            "Uma pestana grossa",
            "Um músculo pequeno do braço",
            "B",
            (
                "A conjuntiva cobre o branco do olho e o interior das pálpebras; quando inflama, é "
                "conjuntivite."
            ),
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Que instrumento é tipicamente usado, junto com uma fonte de luz, na realização dos "
            "testes do reflexo luminoso (Hirschberg e Krimsky)?"
        ),
        (
            "Qual é o músculo mais rápido do corpo humano?",
            "O que faz bater o coração",
            "O que faz piscar o olho",
            "O da barriga da perna",
            "O do braço",
            "B",
            "Os músculos das pálpebras fecham o olho numa fracção de segundo.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Até que idade se recomenda, de forma sistemática, realizar a refração sob cicloplegia "
            "numa criança?"
        ),
        (
            "Quanto tempo dura, mais ou menos, uma piscadela?",
            "Cinco segundos inteiros",
            "Um terço de segundo",
            "Um minuto",
            "Uma hora",
            "B",
            "Uma piscadela dura cerca de 100 a 400 milissegundos.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Qual fármaco cicloplégico tem o pico de ação mais rápido (30 minutos a 1 hora) e "
            "menor duração de efeito do que a atropina?"
        ),
        (
            "Os bebés choram com lágrimas logo ao nascer?",
            "Sim, muitas lágrimas",
            "Normalmente ainda não",
            "Só de noite",
            "Só quando estão ao sol",
            "B",
            "As lágrimas de choro costumam aparecer só após algumas semanas.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Por que motivo a atropina deve ser usada com particular cautela em crianças com "
            "Síndrome de Down?"
        ),
        (
            "Que distância é boa para ler um livro?",
            "Encostado ao nariz",
            "Cerca de 30 a 40 cm",
            "A três metros",
            "A dez metros",
            "B",
            "Ler a uma distância confortável reduz o esforço dos olhos.",
            "estilo_vida_visao",
        ),
    ),
    (
        (
            "Um ângulo kappa 'positivo' (reflexo desviado no sentido nasal) pode ser confundido, à "
            "primeira vista, com qual desvio verdadeiro?"
        ),
        (
            "Quantas horas por dia ao ar livre se aconselha às crianças, contra a miopia?",
            "Cinco minutos",
            "Cerca de duas horas",
            "Nenhuma",
            "Doze horas seguidas",
            "B",
            (
                "Estudos sugerem que cerca de duas horas por dia ao ar livre reduzem o risco de "
                "miopia."
            ),
            "estilo_vida_visao",
        ),
    ),
    (
        (
            "No pseudoestrabismo por pregas de epicanto, o que é característico observar-se no "
            "teste de Hirschberg?"
        ),
        (
            "O excesso de açúcar no sangue (diabetes) pode afectar…",
            "Só os dentes",
            "A visão",
            "Só os pés",
            "Só o cabelo",
            "B",
            "A diabetes pode danificar os vasos da retina.",
            "estilo_vida_visao",
        ),
    ),
    (
        (
            "O que é a esotropia acomodativa refrativa, um dos quadros mais comuns de estrabismo "
            "infantil?"
        ),
        (
            "Folhas verde-escuras, como couve, ajudam que parte do olho?",
            "As pestanas compridas",
            "As sobrancelhas grossas",
            "O centro da retina",
            "A pálpebra de cima",
            "C",
            "Têm luteína, um pigmento que protege a mácula.",
            "estilo_vida_visao",
        ),
    ),
    (
        (
            "Qual é a relação neurológica entre acomodação e convergência que explica o estrabismo "
            "acomodativo?"
        ),
        (
            "Ler no carro em andamento pode causar…",
            "Miopia para sempre",
            "Enjoo e dor de cabeça",
            "Cegueira total",
            "Estrabismo grave",
            "B",
            "Os olhos e o ouvido interno recebem informações diferentes, e isso enjoa.",
            "estilo_vida_visao",
        ),
    ),
    (
        (
            "O que distingue a esotropia acomodativa 'pura' da esotropia acomodativa com "
            "componente 'não acomodativo' (parcialmente acomodativa)?"
        ),
        (
            "O \"olho preguiçoso\" chama-se, em linguagem médica…",
            "Catarata",
            "Glaucoma",
            "Conjuntivite",
            "Ambliopia",
            "D",
            "Ambliopia é quando um olho não desenvolveu boa visão na infância.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é, na prática, a 'ambliopia por anisometropia'?",
        (
            "Porque é difícil notar um \"olho preguiçoso\" em casa?",
            "Muda de cor",
            "Faz barulho",
            "Só aparece ao sol",
            "O olho bom compensa",
            "D",
            "A criança vê bem com o olho bom e não se queixa; só um exame descobre.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Que grau aproximado de diferença de astigmatismo entre os dois olhos já é, por si só, "
            "considerado clinicamente significativo como fator de risco de ambliopia?"
        ),
        (
            "O estrabismo com o olho virado para dentro é mais comum em…",
            "Pessoas idosas",
            "Atletas de corrida",
            "Pilotos de avião experientes",
            "Crianças pequenas",
            "D",
            "A esotropia aparece muitas vezes nos primeiros anos de vida.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "O que avalia especificamente o 'teste de Bruckner', usando o oftalmoscópio direto a "
            "alguma distância da criança?"
        ),
        (
            "Que tipo de estrabismo pode corrigir-se só com óculos?",
            "Todos os tipos, sem excepção",
            "Nenhum tipo de estrabismo",
            "Só o dos adultos",
            "O causado por hipermetropia",
            "D",
            (
                "Quando o desvio se deve ao esforço de focar, os óculos certos podem endireitar o "
                "olho."
            ),
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "No teste de Bruckner, um reflexo mais brilhante no olho desviado, comparado com o "
            "olho fixador, é compatível com que achado?"
        ),
        (
            "Um olho que desvia para fora só ao olhar ao longe pode ser…",
            "Uma catarata a começar",
            "Uma exotropia intermitente",
            "Um terçol escondido",
            "Uma alergia ao pólen",
            "B",
            "Este desvio aparece às vezes, sobretudo ao longe ou com cansaço.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Que instrumento simples, além da barra de prismas, é habitualmente usado no cover "
            "test para captar a atenção de uma criança pequena?"
        ),
        (
            "No estrabismo de um adulto, o sintoma mais comum é…",
            "Comichão",
            "Espirros frequentes",
            "Febre",
            "Ver a dobrar",
            "D",
            "O cérebro adulto já não consegue ignorar o olho desviado, e vê a dobrar.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Por que se prefere, sempre que possível, um alvo acomodativo (e não apenas uma luz) "
            "durante o cover test?"
        ),
        (
            "A hipermetropia forte numa criança pode levar a…",
            "Olhos azuis",
            "Pestanas compridas",
            "Dores de barriga ao ler",
            "Um olho virado para dentro",
            "D",
            "O esforço para focar puxa os olhos para dentro.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Uma 'foria' descompensada, isto é, que deixa de ser controlável pela fusão binocular, "
            "pode evoluir clinicamente para:"
        ),
        (
            "Que doença deixa a visão turva como um vidro embaciado?",
            "A conjuntivite",
            "O terçol",
            "O daltonismo",
            "A catarata",
            "D",
            "Na catarata, a lente natural do olho fica opaca.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é, na prática clínica, a 'amplitude de fusão'?",
        (
            "A catarata trata-se com…",
            "Gotas de limão",
            "Óculos de sol",
            "Exercícios",
            "Uma cirurgia",
            "D",
            "A cirurgia troca a lente turva por uma lente artificial.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Qual é o principal objetivo dos exercícios ortópticos (terapia visual) em casos "
            "selecionados de insuficiência de convergência?"
        ),
        (
            "O glaucoma pode cegar sem…",
            "Ter tratamento nenhum",
            "Afectar o nervo",
            "Existir na família",
            "Dar sinais no início",
            "D",
            "No início não dá sintomas; só os exames o detectam.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "O que é, na prática, um 'prisma de Fresnel', por vezes aplicado temporariamente sobre "
            "uma lente de óculos?"
        ),
        (
            "Ver moscas ou pontos a flutuar de vez em quando é…",
            "Sempre grave",
            "Contagioso",
            "Causado por moscas",
            "Muitas vezes normal",
            "D",
            "Os \"flutuadores\" são comuns; se aparecerem muitos de repente, vá ao médico.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Em que situação clínica um prisma incorporado permanentemente nos óculos pode ser "
            "usado, em vez de cirurgia, para tratar um pequeno desvio ocular?"
        ),
        (
            "Muitos pontos a flutuar de repente, com flashes de luz, podem ser…",
            "Uma alergia ao pó",
            "Um terçol na pálpebra",
            "Fome ou falta de açúcar",
            "Um descolamento da retina",
            "D",
            "É uma urgência: a retina pode estar a descolar.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "O que é a síndrome de Duane, um exemplo clássico de estrabismo "
            "restritivo/inervacional congénito?"
        ),
        (
            "A miopia costuma aumentar em que idade?",
            "Só depois dos 70",
            "Só nos bebés recém-nascidos",
            "Nunca muda",
            "Na infância e adolescência",
            "D",
            "A miopia aumenta sobretudo enquanto o corpo cresce.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que caracteriza a síndrome de Brown, outro exemplo clássico de estrabismo restritivo?",
        (
            "Uma pálpebra caída chama-se…",
            "Miopia",
            "Catarata",
            "Terçol",
            "Ptose",
            "D",
            "A ptose é a pálpebra superior descaída; em crianças pode atrapalhar a visão.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Qual é a principal diferença entre um estrabismo 'restritivo' e um 'paralítico'?",
        (
            "O daltonismo é uma dificuldade com…",
            "A distância",
            "O escuro",
            "O som",
            "As cores",
            "D",
            "Quem tem daltonismo confunde algumas cores.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Um teste de 'ducção forçada', feito sob anestesia tópica ou geral, ajuda a distinguir "
            "que dois tipos de estrabismo?"
        ),
        (
            "Olhos que tremem sem parar, desde bebé, chamam-se…",
            "Miopia",
            "Estrabismo",
            "Catarata",
            "Nistagmo",
            "D",
            "O nistagmo é um movimento rítmico e involuntário dos olhos.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Que exame de imagem é por vezes solicitado perante um estrabismo paralítico de início "
            "súbito num adulto, para excluir causas neurológicas graves?"
        ),
        (
            "O olho seco é mais comum em quem…",
            "Dorme bem todas as noites",
            "Bebe muita água",
            "Anda ao ar livre",
            "Passa muitas horas ao ecrã",
            "D",
            "Ao ecrã pisca-se menos, e as lágrimas evaporam.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Uma paralisia isolada do nervo abducente (VI par) causa tipicamente que desvio ocular?",
        (
            "Uma pequena mancha vermelha no branco do olho, sem dor, costuma ser…",
            "Um cancro muito grave",
            "Uma cegueira que começa",
            "Uma catarata a nascer",
            "Um pequeno derrame que passa",
            "D",
            "Rebenta um pequeno vaso; costuma desaparecer sozinho em uma ou duas semanas.",
            "doencas_estrabismo",
        ),
    ),
    (
        "Uma paralisia isolada do nervo troclear (IV par) afeta principalmente que músculo?",
        (
            "Um olho que desvia para cima chama-se…",
            "Hipotropia",
            "Exotropia",
            "Esotropia",
            "Hipertropia",
            "D",
            "\"Hiper\" quer dizer acima: o olho desvia para cima.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Um doente com paralisia do oblíquo superior costuma adotar espontaneamente que "
            "posição compensatória da cabeça?"
        ),
        (
            "O estrabismo pode fazer a criança ver em 3D pior?",
            "Não",
            "Só no cinema",
            "Só de noite",
            "Sim",
            "D",
            "Com os olhos desalinhados, o cérebro não junta bem as duas imagens.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "O 'teste de inclinação da cabeça de Bielschowsky' é usado sobretudo para localizar "
            "que tipo de paralisia?"
        ),
        (
            "A conjuntivite alérgica passa de pessoa para pessoa?",
            "Sim, sempre",
            "Só nas escolas",
            "Só pelo aperto",
            "Não, não passa",
            "D",
            "A alérgica não é contagiosa; as de vírus e bactérias são.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Uma paralisia completa do nervo oculomotor (III par) tipicamente NÃO afeta qual "
            "destes músculos?"
        ),
        (
            "O \"olho preguiçoso\" melhora mais facilmente em…",
            "Idosos",
            "Adultos",
            "Adolescentes mais velhos",
            "Crianças pequenas",
            "D",
            "Quanto mais novo, mais o cérebro consegue aprender a usar o olho fraco.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Além da limitação de vários movimentos oculares, uma paralisia completa do III par "
            "costuma incluir que outras duas manifestações características?"
        ),
        (
            "Um bebé com o olho a lacrimejar sempre pode ter…",
            "Miopia muito forte",
            "Daltonismo herdado dos pais",
            "Uma catarata grave nos dois olhos",
            "O canal da lágrima entupido",
            "D",
            "É comum e muitas vezes passa com massagens; o médico deve avaliar.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Numa criança com estrabismo, a chamada 'posição compensatória da cabeça' (torcicolo "
            "ocular) serve tipicamente para quê?"
        ),
        (
            "Quem tem diabetes deve fazer exame aos olhos…",
            "Nunca na vida",
            "Só se doer",
            "Só aos 80 anos",
            "Todos os anos",
            "D",
            "O exame anual apanha cedo os danos na retina.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Qual é o principal risco de não corrigir cirurgicamente uma síndrome de Duane com "
            "torcicolo compensatório muito acentuado e mantido na infância?"
        ),
        (
            "A queratocone é uma doença em que a córnea…",
            "Fica em forma de cone",
            "Fica toda colorida",
            "Desaparece de vez",
            "Fica mais grossa",
            "A",
            "A córnea afina e deforma-se, e a visão fica distorcida.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Um estrabismo que surge subitamente numa criança mais velha ou num adulto, sem "
            "história prévia, deve sempre motivar a exclusão de que tipo de causa?"
        ),
        (
            "O \"olho preguiçoso\" pode ter várias causas. Qual destas é uma?",
            "Um olho com muita mais graduação",
            "Comer muitos doces",
            "Dormir sempre do mesmo lado",
            "Ler à noite com candeeiro",
            "A",
            "Uma grande diferença de graduação entre os olhos pode causar ambliopia.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Que doença sistémica crónica é um fator de risco reconhecido para paralisias agudas "
            "de nervos cranianos que controlam os movimentos oculares?"
        ),
        (
            "A visão dupla num adulto deve ser vista…",
            "Com urgência",
            "Daqui a um ano",
            "Nunca",
            "Só se doer",
            "A",
            "Pode indicar problemas nos nervos ou no cérebro.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Uma paralisia do III par causada por diabetes tem, tipicamente, uma característica "
            "distintiva importante para o diagnóstico diferencial. Qual?"
        ),
        (
            "Que doença infecciosa dos olhos é comum em zonas com pouca água limpa?",
            "O tracoma",
            "A miopia",
            "O daltonismo",
            "A presbiopia",
            "A",
            "O tracoma espalha-se onde é difícil lavar a cara e as mãos.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Qual é, na prática clínica, o significado de uma paralisia do III par que afeta "
            "também a pupila (com midríase), num adulto?"
        ),
        (
            "A presbiopia, a \"vista cansada\", aparece com…",
            "A idade",
            "A gripe",
            "O frio",
            "O calor",
            "A",
            "A partir dos 40 anos, focar ao perto fica mais difícil.",
            "doencas_estrabismo",
        ),
    ),
    (
        "O que é o 'nistagmo', em termos simples?",
        (
            "Uma criança com estrabismo pode precisar de várias soluções juntas. Por exemplo…",
            "Óculos e penso",
            "Só doces",
            "Só descanso",
            "Só televisão",
            "A",
            "Muitas vezes combinam-se óculos, penso e, se preciso, cirurgia.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Um nistagmo congénito costuma, em muitos casos, apresentar que característica "
            "particular quanto à visão do doente?"
        ),
        (
            "No consultório, para que servem as gotas que dilatam a pupila?",
            "Ver o fundo do olho",
            "Mudar a cor do olho",
            "Curar a miopia",
            "Dar sono ao doente",
            "A",
            "Com a pupila maior, o médico vê a retina e o nervo óptico.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Em que contexto pode a toxina botulínica ser usada no tratamento do nistagmo, para "
            "além do estrabismo?"
        ),
        (
            "Depois das gotas que dilatam a pupila, deve-se evitar…",
            "Conduzir logo a seguir",
            "Beber um copo de água",
            "Falar com o médico",
            "Andar a pé até casa",
            "A",
            "A visão fica turva e sensível à luz durante algumas horas.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Qual é a principal diferença entre um 'nistagmo sensorial' e um 'nistagmo motor "
            "congénito idiopático'?"
        ),
        (
            "Quem faz os óculos a partir da receita do médico?",
            "O óptico",
            "O dentista",
            "O padeiro",
            "O motorista",
            "A",
            "O óptico prepara e ajusta os óculos.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Que exame é fundamental realizar perante uma criança pequena com nistagmo de início "
            "recente, para excluir uma causa grave subjacente?"
        ),
        (
            "O que faz um optometrista, em muitos países?",
            "Mede a visão e receita óculos",
            "Opera ao coração",
            "Trata os dentes",
            "Faz análises ao sangue e urina",
            "A",
            "O optometrista avalia a visão e encaminha para o médico quando há sinais de doença.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "O que avalia, de forma simples, a 'estereopsia', testada por exemplo com o teste de "
            "Titmus ou de Lang?"
        ),
        (
            "No tratamento com penso, quantas horas por dia se costuma tapar o olho bom?",
            "Sempre 24 horas",
            "As que o médico indicar",
            "Nenhuma hora",
            "Só um minuto",
            "B",
            "O número de horas depende da idade e do caso; o médico ajusta.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Por volta de que idade se espera já estar presente uma estereopsia mensurável numa "
            "criança com desenvolvimento visual normal?"
        ),
        (
            "Para a criança aceitar o penso, ajuda…",
            "Gritar com ela",
            "Brincar enquanto o usa",
            "Castigá-la muito",
            "Esconder o penso dos amigos",
            "B",
            "Desenhar, brincar ou ver desenhos animados com o penso torna-o mais fácil.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Que teste simples de estereopsia, usado em consultório, usa óculos polarizados para "
            "ver imagens em relevo (como uma mosca)?"
        ),
        (
            "Que gotas podem substituir o penso no \"olho preguiçoso\"?",
            "Gotas de limão",
            "Gotas de atropina",
            "Soro de laranja",
            "Água salgada",
            "B",
            "A atropina desfoca o olho bom, e o cérebro usa o mais fraco.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "O que é, na prática, a 'correspondência retiniana anómala', uma adaptação sensorial "
            "do estrabismo de longa data?"
        ),
        (
            "Depois de uma cirurgia ao estrabismo, a criança costuma…",
            "Ir para casa no mesmo dia",
            "Ficar um mês no hospital",
            "Deixar de ver",
            "Mudar de cor",
            "A",
            "Na maioria dos casos, a criança vai para casa no próprio dia.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O 'escotoma de supressão' corresponde a que fenómeno sensorial no estrabismo?",
        (
            "Após a cirurgia ao estrabismo, o olho costuma ficar…",
            "Vermelho uns dias",
            "Azul para sempre",
            "Sem pestanas",
            "Maior",
            "A",
            "A vermelhidão é normal e passa em algumas semanas.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Um adulto que desenvolve subitamente um desvio ocular queixa-se tipicamente de "
            "diplopia, ao contrário de uma criança pequena. Por que motivo?"
        ),
        (
            "A cirurgia ao estrabismo faz-se com…",
            "Anestesia",
            "Sem nada",
            "Só com gelo",
            "Só com música",
            "A",
            "Nas crianças faz-se com anestesia geral, para não sentirem nada.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "O que é a 'visão binocular única normal', o objetivo funcional último do tratamento "
            "do estrabismo?"
        ),
        (
            "Os exercícios para os olhos ajudam sobretudo quem…",
            "Não junta bem os olhos",
            "Tem uma catarata",
            "Tem um glaucoma",
            "Tem daltonismo herdado",
            "A",
            "Ajudam na insuficiência de convergência, mas não em todos os problemas.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Numa criança operada a estrabismo, por que motivo o resultado sensorial (fusão, "
            "estereopsia) pode ser mais importante do que o simples alinhamento estético dos "
            "olhos?"
        ),
        (
            "Porque se mede o desvio em várias direcções do olhar?",
            "Pode mudar com a direcção",
            "Por simples tradição",
            "Para demorar mais",
            "Para gastar menos",
            "A",
            "Alguns desvios são maiores a olhar para um lado; isso orienta o tratamento.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Um doente com boa fusão sensorial antes de desenvolver um estrabismo paralítico tem, "
            "em geral, um prognóstico funcional pós-tratamento:"
        ),
        (
            "Um rastreio visual na escola substitui uma consulta?",
            "Não",
            "Sim",
            "Só nos rapazes",
            "Só nas raparigas",
            "A",
            "O rastreio só aponta quem precisa de consulta.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que avalia, na prática, um 'sinoptóforo', instrumento clássico usado em ortóptica?",
        (
            "Que instrumento usa o médico para ver o fundo do olho?",
            "O oftalmoscópio",
            "O estetoscópio",
            "O termómetro",
            "O martelo",
            "A",
            "O oftalmoscópio ilumina e amplia o interior do olho.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Num sinoptóforo, a diferença entre o 'ângulo objetivo' e o 'ângulo subjetivo' medidos "
            "no mesmo doente pode indicar a presença de que fenómeno sensorial?"
        ),
        (
            "As lentes de contacto devem ser trocadas…",
            "No prazo indicado",
            "Nunca na vida",
            "Só quando partirem",
            "De dez em dez anos",
            "A",
            "Usar lentes além do prazo aumenta o risco de infecções.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Qual é a principal vantagem de operar precocemente uma esotropia infantil "
            "(congénita), em vez de esperar vários anos?"
        ),
        (
            "O estojo das lentes de contacto deve ser…",
            "Lavado e trocado com frequência",
            "Nunca lavado nem trocado",
            "Partilhado com os amigos da escola",
            "Lavado com saliva",
            "A",
            "Um estojo sujo é uma fonte de micróbios.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Que fator torna, em geral, mais difícil recuperar boa fusão binocular numa esotropia "
            "infantil congénita operada tardiamente?"
        ),
        (
            "Antes de uma cirurgia aos olhos, o médico explica os riscos para…",
            "Os pais decidirem informados",
            "Assustar a família toda",
            "Perder algum tempo",
            "Poder cobrar mais caro",
            "A",
            "O consentimento informado garante que a família compreende e escolhe.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Que outra alteração ocular é frequentemente associada à esotropia infantil congénita, "
            "além do próprio desvio horizontal?"
        ),
        (
            "Que profissional ajuda quem já vê muito pouco a usar a visão que tem?",
            "O especialista em baixa visão",
            "O dentista da família",
            "O farmacêutico do bairro",
            "O fisioterapeuta do hospital",
            "A",
            "Lupas, luz e treino ajudam a aproveitar a visão que resta.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "O que é, na prática, a 'disfunção do oblíquo inferior', um achado comum acompanhando "
            "estrabismos horizontais infantis?"
        ),
        (
            "A protecção ocular no desporto é importante em…",
            "Squash e paintball",
            "Natação na praia",
            "Xadrez",
            "Corrida a pé",
            "A",
            "Bolas pequenas e projécteis podem ferir gravemente o olho.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O 'padrão em V' do estrabismo refere-se a que achado no exame da motilidade ocular?",
        (
            "Óculos de sol baratos sem filtro UV podem…",
            "Fazer pior que não usar",
            "Curar cataratas",
            "Melhorar a visão",
            "Fazer ver melhor no escuro",
            "A",
            "Lentes escuras sem filtro abrem a pupila e deixam entrar mais raios UV.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O 'padrão em A' do estrabismo, em contraste com o padrão em V, caracteriza-se por:",
        (
            "Em caso de queimadura química no olho, deve-se lavar durante…",
            "Pelo menos 15 minutos",
            "Dois segundos",
            "Apenas um minuto",
            "Não se lava, tapa-se",
            "A",
            "Lavar muito tempo com água corrente reduz o dano; depois, ir à urgência.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Qual é o objetivo de medir o desvio em várias posições do olhar (para cima, para "
            "baixo, à direita, à esquerda), e não apenas em posição primária?"
        ),
        (
            "Para aliviar um terçol em casa, ajuda…",
            "Uma compressa morna",
            "Espremê-lo",
            "Gelo directo",
            "Pomada de dentes",
            "A",
            "O calor ajuda a drenar; espremer pode piorar.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Qual é a função clínica de medir o desvio tanto de perto como de longe, numa consulta "
            "de estrabismo?"
        ),
        (
            "O seguimento após o tratamento da ambliopia serve para…",
            "Evitar que volte a piorar",
            "Mudar a cor do olho tratado",
            "Ganhar prémios na escola",
            "Trocar de médico",
            "A",
            "A ambliopia pode voltar se o tratamento parar cedo demais.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O que é, na prática, o 'excesso de convergência', uma variante de esotropia acomodativa?",
        (
            "Depois de nadar em piscina com cloro, os olhos podem ficar…",
            "Vermelhos e irritados",
            "Mais azuis",
            "Mais nítidos que antes",
            "Mais fortes e resistentes",
            "A",
            "Óculos de natação protegem os olhos do cloro.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Qual é, na prática, o 'défice de divergência', outra variante clínica de estrabismo "
            "horizontal?"
        ),
        (
            "Qual destes NÃO se deve pôr num olho irritado?",
            "Gotas receitadas a outra pessoa",
            "Água limpa da garrafa",
            "Soro fisiológico da farmácia",
            "Uma compressa limpa e fria",
            "A",
            "Medicamentos de outra pessoa podem fazer mal ou esconder doenças.",
            "prevencao_cuidados",
        ),
    ),
    (
        "A Lei de Sherrington, ou da inervação recíproca, aplica-se a que contexto?",
        (
            "Quantos ossos formam a cavidade onde está o olho?",
            "Dois",
            "Sete",
            "Vinte",
            "Um",
            "B",
            "A órbita é formada por sete ossos do crânio e da face.",
            "anatomia_ocular",
        ),
    ),
    (
        "A Lei de Hering, ou da inervação equivalente, determina que:",
        (
            "O músculo que levanta a pálpebra de cima é comandado por que nervo?",
            "O nervo do ouvido",
            "O terceiro nervo craniano",
            "O nervo do olfacto",
            "O nervo da língua",
            "B",
            "O terceiro nervo comanda também quatro músculos do olho.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Na parésia de um músculo extraocular, qual desvio é maior: o desvio primário (com o "
            "olho não parético a fixar) ou o desvio secundário (com o olho parético a fixar)?"
        ),
        (
            "O músculo recto de cima puxa o olho sobretudo para…",
            "Baixo",
            "Cima",
            "Dentro",
            "Fora",
            "B",
            "O recto superior eleva o olho.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Segundo a Lei de Hering, numa parésia do reto externo do olho direito, qual músculo "
            "tipicamente mostra hiperação, por ser o seu conjugado (yoke muscle)?"
        ),
        (
            "O músculo recto de baixo puxa o olho sobretudo para…",
            "Baixo",
            "Cima",
            "Fora",
            "Lado nenhum",
            "A",
            "O recto inferior baixa o olho.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "O que distingue o 'ângulo objetivo' do 'ângulo subjetivo' do estrabismo, na "
            "formulação clássica da motilidade ocular?"
        ),
        (
            "O sexto nervo craniano comanda o músculo que vira o olho para…",
            "Dentro",
            "Fora",
            "Cima",
            "Baixo",
            "B",
            "O nervo abducente comanda o recto lateral, que afasta o olho do nariz.",
            "anatomia_ocular",
        ),
    ),
    (
        "Opticamente, o ângulo kappa (K) representa a diferença entre:",
        (
            "O quarto nervo craniano é o mais fino. Que músculo comanda?",
            "O oblíquo superior",
            "O recto lateral",
            "O recto medial",
            "O músculo da pálpebra",
            "A",
            "O nervo troclear comanda só o oblíquo superior.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Segundo a fórmula clássica que relaciona o desvio real (objetivo) com o desvio "
            "aparente do estrabismo, qual das seguintes está correta?"
        ),
        (
            "A camada do olho cheia de vasos, por baixo da retina, chama-se…",
            "Coróide",
            "Córnea",
            "Conjuntiva",
            "Cílio",
            "A",
            "A coróide alimenta a parte exterior da retina.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Como se chama o fenómeno em que, por causa do ângulo kappa, existe um desvio aparente "
            "entre os olhos mas os eixos visuais estão, na realidade, corretamente posicionados "
            "relativamente ao objeto?"
        ),
        (
            "A pequena cova no centro da mácula, onde se vê com mais pormenor, é…",
            "A pupila",
            "A fóvea",
            "A órbita",
            "A tróclea",
            "B",
            "Na fóvea há só cones, muito juntos; é aí que lemos.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Segundo o relato histórico da cirurgia de estrabismo, quem é geralmente creditado por "
            "ter formulado positivamente, em 1838, a operação de miotomia ocular na sua 'ortopedia "
            "operatória'?"
        ),
        (
            "O nervo óptico de cada olho tem cerca de quantas fibras?",
            "Cerca de dez",
            "Mais de um milhão",
            "Cerca de cem",
            "Cerca de mil e quinhentas",
            "B",
            "Cada nervo óptico tem cerca de 1,2 milhões de fibras.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "Qual cirurgião substituiu a miotomia (secção total do músculo) pela tenotomia, ao "
            "estudar as relações dos músculos oculares com a cápsula de Tenon, melhorando a "
            "reputação da cirurgia de estrabismo?"
        ),
        (
            "Os nervos ópticos dos dois olhos cruzam-se num ponto chamado…",
            "Quiasma óptico",
            "Ponto cego central",
            "Fóvea",
            "Íris",
            "A",
            "No quiasma, parte das fibras de cada olho passa para o outro lado do cérebro.",
            "anatomia_ocular",
        ),
    ),
    (
        (
            "A antiga doutrina de Buffon atribuía a causa do estrabismo a quê -- teoria depois "
            "refutada pelos resultados da estrabotomia?"
        ),
        (
            "Em que parte do cérebro se processa a visão?",
            "Atrás da testa",
            "Na parte de trás",
            "Junto às orelhas",
            "No topo da cabeça",
            "B",
            "O córtex visual fica no lobo occipital, na nuca.",
            "ciencia_ocular",
        ),
    ),
    (
        "O oftalmologista Giraud-Teulon definiu classicamente o estrabismo como:",
        (
            "O lado esquerdo do que vemos é processado em que lado do cérebro?",
            "No lado esquerdo",
            "No lado direito",
            "Nos dois por igual",
            "No cerebelo",
            "B",
            "As vias visuais cruzam-se; cada metade do cérebro trata o lado oposto.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "O Prémio Nobel de Fisiologia ou Medicina de 1981, atribuído a David Hubel e Torsten "
            "Wiesel, assentou em que descoberta relevante para a compreensão da ambliopia?"
        ),
        (
            "Quando um olho vira para dentro, que músculo do mesmo olho relaxa?",
            "O de dentro",
            "O de fora",
            "O de cima",
            "Nenhum",
            "B",
            "Pela lei de Sherrington, o músculo oposto relaxa.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Em óptica geométrica, o que significa dizer que a imagem e o objeto são 'conjugados' "
            "através de uma lente?"
        ),
        (
            "Ao olhar para a direita, que músculo trabalha no olho esquerdo?",
            "O recto de fora",
            "O recto de dentro",
            "O recto de cima",
            "O recto de baixo",
            "B",
            "O olho esquerdo vai para o nariz; trabalha o recto medial.",
            "ciencia_ocular",
        ),
    ),
    (
        "Por definição óptica, um olho diz-se emétrope quando:",
        (
            "Músculos dos dois olhos que trabalham juntos para o mesmo lado chamam-se…",
            "Músculos opostos",
            "Músculos conjugados",
            "Músculos parados",
            "Músculos soltos",
            "B",
            "Por exemplo, o recto lateral direito e o recto medial esquerdo.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Numa técnica de esquiascopia (retinoscopia), ao usar uma lente de trabalho de +1,50D, "
            "a que distância aproximada se forma a imagem conjugada -- e portanto a que distância "
            "se deve posicionar o examinador?"
        ),
        (
            "Numa paralisia de um músculo, o desvio é maior quando se olha…",
            "Para o lado oposto ao músculo",
            "Para o lado desse músculo",
            "Para o chão",
            "Igual para todos os lados",
            "B",
            "O desvio aumenta na direcção em que o músculo fraco devia puxar.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "O retinoscópio de franja veio substituir que técnica mais antiga, usada para produzir "
            "o feixe de luz na esquiascopia, por ser mais difícil de manejar?"
        ),
        (
            "Se o olho com o músculo fraco fixar, o outro desvia…",
            "Mais",
            "Menos",
            "Nada",
            "Para cima sempre",
            "A",
            "O cérebro manda mais força aos dois olhos, e o olho bom exagera (desvio secundário).",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Numa paralisia do músculo grande oblíquo (oblíquo superior) em que a função de "
            "depressão é a mais afetada, qual músculo tende a mostrar hiperação, por ser o seu "
            "conjugado contralateral?"
        ),
        (
            "O ponto cego do olho não se nota no dia-a-dia porque…",
            "O cérebro preenche a falha",
            "É grande demais para notar",
            "Só existe à noite",
            "Muda de lugar sem parar",
            "A",
            "O cérebro preenche a falha e o outro olho vê essa zona.",
            "ciencia_ocular",
        ),
    ),
    (
        "Quantos músculos extraoculares controlam os movimentos de cada olho, no total?",
        (
            "Que cor de luz vemos melhor no escuro?",
            "Vermelha",
            "Azul-esverdeada",
            "Laranja",
            "Castanho-escura",
            "B",
            "Os bastonetes são mais sensíveis à luz azul-esverdeada.",
            "ciencia_ocular",
        ),
    ),
    (
        "Qual é a principal ação do músculo reto lateral (externo)?",
        (
            "Quantos tipos de cones temos para ver as cores?",
            "Um",
            "Três",
            "Dez",
            "Cinquenta",
            "B",
            "Cones sensíveis ao vermelho, ao verde e ao azul combinam-se em todas as cores.",
            "ciencia_ocular",
        ),
    ),
    (
        "Qual é a principal ação do músculo reto medial (interno)?",
        (
            "Os olhos fazem pequenos tremores constantes, que não sentimos. Para quê?",
            "Para limpar a córnea",
            "Para fazer mais lágrimas",
            "Para a imagem não desaparecer",
            "Para nos ajudar a adormecer",
            "C",
            "Se a imagem ficasse parada, as células deixavam de responder.",
            "ciencia_ocular",
        ),
    ),
    (
        "O músculo oblíquo superior (grande oblíquo) é inervado por qual nervo craniano?",
        (
            "Um objecto a dois metros de nós aparece invertido…",
            "No espelho",
            "Na pálpebra",
            "No nariz",
            "Na retina",
            "D",
            "A lente do olho inverte a imagem na retina; o cérebro endireita-a.",
            "ciencia_ocular",
        ),
    ),
    (
        "O músculo reto lateral é inervado por qual nervo craniano?",
        (
            "Qual é o nome científico da noção de profundidade com dois olhos?",
            "Presbiopia",
            "Ambliopia",
            "Estereopsia",
            "Diplopia",
            "C",
            "A estereopsia vem da diferença entre as imagens dos dois olhos.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Os restantes músculos extraoculares (retos superior, inferior, medial e o oblíquo "
            "inferior) são inervados principalmente por qual nervo craniano?"
        ),
        (
            "O cérebro junta as imagens dos dois olhos numa só. Chama-se…",
            "Fusão",
            "Fissão",
            "Confusão",
            "Difusão",
            "A",
            "Na fusão, as duas imagens tornam-se uma.",
            "ciencia_ocular",
        ),
    ),
    (
        "Qual é a principal ação do músculo reto superior, na posição primária do olhar?",
        (
            "Quando o cérebro ignora a imagem de um olho, chama-se…",
            "Supressão",
            "Expressão",
            "Impressão",
            "Pressão",
            "A",
            "A supressão evita ver a dobrar, mas pode causar olho preguiçoso.",
            "ciencia_ocular",
        ),
    ),
    (
        "Qual é a principal ação do músculo oblíquo inferior (pequeno oblíquo)?",
        (
            "O \"ângulo kappa\" é a diferença entre o centro da pupila e…",
            "A ponta da sobrancelha",
            "A linha para onde olhamos",
            "O meio da orelha",
            "A ponta do queixo",
            "B",
            "Quase toda a gente tem um pequeno ângulo kappa.",
            "ciencia_ocular",
        ),
    ),
    (
        "O que é a 'versão', em motilidade ocular?",
        (
            "Um ângulo kappa grande pode fazer parecer…",
            "Uma catarata em formação",
            "Um estrabismo que não existe",
            "Uma miopia muito forte",
            "Uma alergia de primavera",
            "B",
            "O reflexo da luz parece descentrado, mas os olhos estão alinhados.",
            "ciencia_ocular",
        ),
    ),
    (
        "O que é a 'vergência', em motilidade ocular, ao contrário da versão?",
        (
            "Por volta de que idade a visão de uma criança fica quase como a de um adulto?",
            "Logo ao nascer",
            "Aos 30 anos",
            "Aos 60 anos",
            "Cerca dos 5 a 7 anos",
            "D",
            "A visão amadurece nos primeiros anos; por isso se trata cedo.",
            "ciencia_ocular",
        ),
    ),
    (
        "O que são, tecnicamente, os 'músculos conjugados' (yoke muscles)?",
        (
            "Até que idade o cérebro aprende melhor a usar um \"olho preguiçoso\"?",
            "Até aos 70",
            "Até cerca dos 7 anos",
            "Só ao nascer",
            "Não há limite",
            "B",
            "Depois desse período ainda se consegue melhorar, mas com mais dificuldade.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Numa parésia do reto lateral do olho direito, qual é tipicamente o músculo conjugado "
            "(yoke muscle) do olho esquerdo?"
        ),
        (
            "O movimento lento dos olhos a seguir um carro chama-se…",
            "Seguimento",
            "Sacada",
            "Piscadela",
            "Vergência",
            "A",
            "No seguimento, os olhos acompanham suavemente um objecto que se mexe.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Segundo a Lei de Hering, numa parésia de um músculo, o desvio secundário (olho "
            "parético a fixar) é, em relação ao primário (olho são a fixar):"
        ),
        (
            "Os saltos rápidos dos olhos ao ler chamam-se…",
            "Seguimentos",
            "Sacadas",
            "Piscadelas",
            "Bocejos",
            "B",
            "As sacadas levam o olhar de palavra em palavra.",
            "ciencia_ocular",
        ),
    ),
    (
        "O 'campo de ação' de um músculo extraocular corresponde a que conceito?",
        (
            "Durante uma sacada, o cérebro…",
            "Quase não regista a imagem",
            "Vê tudo em câmara lenta",
            "Vê a dobrar",
            "Vê tudo a vermelho",
            "A",
            "Por isso não vemos a imagem a \"tremer\" quando os olhos saltam.",
            "ciencia_ocular",
        ),
    ),
    (
        "Ao examinar as nove posições diagnósticas do olhar, o objetivo principal é:",
        (
            "Uma lente para quem vê mal ao perto (hipermetropia) é…",
            "Mais grossa no centro",
            "Mais fina no centro",
            "Toda plana",
            "Colorida",
            "A",
            "As lentes positivas, como as lupas, são mais grossas no meio.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "O 'ângulo de aparência' (A), na formulação clássica da motilidade ocular, "
            "distingue-se do desvio objetivo (E) por refletir sobretudo o quê?"
        ),
        (
            "O que mede a \"refracção\" num exame?",
            "A pressão dentro do olho",
            "A graduação que o olho precisa",
            "O tamanho da pupila",
            "A cor exacta da íris",
            "B",
            "Mede quanto a luz precisa de ser corrigida para focar na retina.",
            "ciencia_ocular",
        ),
    ),
    (
        (
            "Um ângulo kappa é classificado como 'negativo' quando o reflexo corneano, no teste de "
            "Hirschberg, se encontra deslocado em que sentido relativamente ao centro da pupila?"
        ),
        (
            "Em que cidade se operou com sucesso o primeiro estrabismo, em 1839?",
            "Berlim",
            "Lisboa",
            "Luanda",
            "Nova Iorque",
            "A",
            "Johann Dieffenbach operou-o em Berlim.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Por que motivo a medição cuidadosa do ângulo kappa é especialmente relevante antes de "
            "uma cirurgia de estrabismo?"
        ),
        (
            "Quem inventou o oftalmoscópio, em 1851?",
            "Hermann von Helmholtz",
            "Alexander Graham Bell",
            "Isaac Newton",
            "Charles Darwin",
            "A",
            "O oftalmoscópio permitiu ver pela primeira vez o fundo do olho.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Como se chama o fenómeno em que, por causa do ângulo kappa, existe um desvio aparente "
            "entre os olhos mas os eixos visuais estão, na realidade, corretamente posicionados?"
        ),
        (
            "Em que ano Hubel e Wiesel receberam o Nobel pelo estudo da visão?",
            "1901",
            "1950",
            "1981",
            "2010",
            "C",
            "Mostraram que o cérebro aprende a ver num período da infância.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Um ângulo kappa positivo muito pronunciado pode ser confundido, à primeira vista, com "
            "que desvio verdadeiro?"
        ),
        (
            "Que animal tem um dos sistemas de cores mais complexos do mundo?",
            "A vaca leiteira",
            "O camarão-louva-a-deus",
            "O cão pastor alemão",
            "O morcego das cavernas",
            "B",
            "Tem 12 a 16 tipos de células para cores; nós temos três.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Um ângulo kappa negativo muito pronunciado pode ser confundido, à primeira vista, com "
            "que desvio verdadeiro?"
        ),
        (
            "Os cães vêem as cores como nós?",
            "Sim, iguais",
            "Não, vêem menos cores",
            "Sim, e vêem ainda mais",
            "Só vêem vermelho",
            "B",
            "Os cães têm dois tipos de cones e confundem vermelho e verde.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Na esquiascopia (retinoscopia), o chamado 'ponto neutro' corresponde a que momento da "
            "técnica?"
        ),
        (
            "Que animal tem olhos maiores do que o seu cérebro?",
            "O elefante",
            "O avestruz",
            "O leão",
            "O tubarão",
            "B",
            "Os olhos do avestruz são maiores do que o próprio cérebro.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Antes de atingir o ponto neutro na esquiascopia de um olho míope, o reflexo retiniano "
            "observado move-se tipicamente em que sentido, em relação ao movimento do feixe de "
            "luz?"
        ),
        (
            "Porque é que nas fotografias com flash os olhos ficam vermelhos?",
            "A luz reflecte no fundo do olho",
            "Os olhos estão doentes",
            "A câmara é muito velha",
            "Há sangue misturado nas lágrimas",
            "A",
            "A luz do flash ilumina a retina, cheia de vasos sanguíneos.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Numa técnica de esquiascopia (retinoscopia), ao usar uma lente de trabalho de +1,50D, "
            "a que distância aproximada se posiciona o examinador?"
        ),
        (
            "Quem descreveu o seu próprio daltonismo em 1794?",
            "Louis Pasteur",
            "Galileu Galilei",
            "Marie Curie",
            "John Dalton",
            "D",
            "Por isso, em muitas línguas, a doença tem o seu nome.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "O que é, na prática, a 'refração ciclopégica', tantas vezes recomendada em crianças "
            "pequenas?"
        ),
        (
            "Quem criou a primeira lente intra-ocular para cataratas, em 1949?",
            "Harold Ridley",
            "Thomas Edison",
            "Alexander Fleming",
            "Nikola Tesla",
            "A",
            "Ridley notou que pedaços de plástico no olho de pilotos não causavam reacção.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "A que se atribui, no relato histórico da cirurgia de estrabismo, a ideia de que J. "
            "Guérin terá 'pressentido' primeiro, sem a chegar a formular positivamente?"
        ),
        (
            "O médico Jacques Daviel ficou famoso por operar o quê?",
            "O coração",
            "Cataratas",
            "Os dentes",
            "Os pulmões",
            "B",
            "Por volta de 1750 começou a retirar o cristalino turvo.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Quem foi o primeiro a praticar ao vivo, em 1839, a operação de miotomia ocular "
            "formulada por Stromeyer no ano anterior?"
        ),
        (
            "Em que dia se celebra o Dia Mundial da Visão?",
            "Na segunda quinta-feira de Outubro",
            "No dia 1 de Janeiro",
            "No dia de Natal",
            "No último dia de Maio",
            "A",
            "É celebrado todos os anos em Outubro, para chamar a atenção para a saúde dos olhos.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Que cirurgião é geralmente creditado por ter popularizado a operação de estrabismo, "
            "após a sua primeira execução prática por Cunier?"
        ),
        (
            "O sistema Braille usa grupos de quantos pontos?",
            "Seis",
            "Dois",
            "Dez",
            "Doze",
            "A",
            "Cada letra é uma combinação de até seis pontos em relevo.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Qual cirurgião substituiu a miotomia (secção total do músculo) pela tenotomia, ao "
            "estudar as relações dos músculos oculares com a cápsula de Tenon?"
        ),
        (
            "Os polvos têm ponto cego?",
            "Sim, dois",
            "Não, não têm",
            "Sim, três",
            "Não têm olhos",
            "B",
            "Nos polvos, a retina está montada de forma que não há ponto cego.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Qual é a principal diferença entre a 'miotomia' e a 'tenotomia' no tratamento "
            "cirúrgico histórico do estrabismo?"
        ),
        (
            "Que animal tem olhos dos lados da cabeça e vê quase à volta toda?",
            "O coelho",
            "O mocho",
            "O ser humano",
            "O gato",
            "A",
            "Os coelhos vêem quase 360 graus para detectar predadores.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "A antiga doutrina de Buffon atribuía a causa do estrabismo a quê, teoria depois "
            "refutada pelos sucessos da estrabotomia?"
        ),
        (
            "Cerca de que fracção do cérebro está ligada à visão?",
            "Quase nada",
            "Cerca de um terço",
            "Cerca de 1%",
            "Praticamente o cérebro todo",
            "B",
            "Uma grande parte do cérebro participa em ver e interpretar imagens.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "O termo histórico 'amblyopia ex anopsia', usado antes da compreensão cortical moderna "
            "da ambliopia, traduzia que ideia sobre a sua causa?"
        ),
        (
            "Em que país foram inventados os primeiros óculos?",
            "Japão",
            "Itália",
            "Canadá",
            "Austrália",
            "B",
            "Os primeiros óculos de leitura surgiram em Itália, por volta de 1280.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Em que espécie animal foram sobretudo conduzidas as experiências clássicas de Hubel e "
            "Wiesel sobre privação visual e colunas de dominância ocular?"
        ),
        (
            "Antes da cirurgia moderna, como se tentava tratar o estrabismo?",
            "Com óculos com furinhos",
            "Com cirurgia a laser",
            "Com antibióticos fortes",
            "Com ressonância magnética",
            "A",
            "Usavam-se máscaras e óculos de furos para obrigar os olhos a olhar em frente.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "Que técnica experimental usaram sobretudo Hubel e Wiesel para estudar o "
            "desenvolvimento do córtex visual em animais jovens?"
        ),
        (
            "O que é a \"heterocromia\"?",
            "Ter olhos de cores diferentes",
            "Ver tudo sempre a dobrar",
            "Não conseguir ver cores",
            "Ter manchas brancas na íris",
            "A",
            "Pode ser herdada e normalmente não faz mal à visão.",
            "curiosidades_visuais",
        ),
    ),
    (
        (
            "O conceito de 'período crítico' do desenvolvimento visual, popularizado pelo trabalho "
            "de Hubel e Wiesel, refere-se a que ideia central?"
        ),
        (
            "Uma paralisia do sexto nervo faz o olho…",
            "Não conseguir ir para fora",
            "Ficar azul para sempre",
            "Deixar de conseguir piscar",
            "Chorar muito sem parar",
            "A",
            "O recto lateral deixa de puxar, e o olho fica virado para dentro.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Quem é geralmente considerado o 'pai da cirurgia de catarata moderna', por ter "
            "aperfeiçoado a técnica de extração no século XVIII?"
        ),
        (
            "Uma paralisia do terceiro nervo pode deixar…",
            "O olho mais claro",
            "Pestanas muito compridas",
            "A visão mais nítida",
            "Pálpebra caída e olho para fora",
            "D",
            "O terceiro nervo comanda vários músculos e a pálpebra.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "A que oftalmologista do século XIX se atribui a invenção do oftalmoscópio, permitindo "
            "pela primeira vez observar diretamente o fundo do olho vivo?"
        ),
        (
            "No glaucoma, a primeira visão a perder-se costuma ser…",
            "A do centro",
            "A das cores",
            "A dos lados",
            "A do perto",
            "C",
            "A perda começa pela periferia e avança sem se notar.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Franciscus Donders, no século XIX, deu um contributo fundamental para a compreensão "
            "sistemática de que área da oftalmologia?"
        ),
        (
            "A retinopatia da prematuridade afecta…",
            "Pessoas idosas",
            "Atletas de alta competição",
            "Só adolescentes",
            "Bebés nascidos antes do tempo",
            "D",
            "Os vasos da retina dos prematuros podem crescer de forma anormal.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Albrecht von Graefe é lembrado, entre outras contribuições do século XIX, por avanços "
            "na cirurgia de qual doença ocular grave?"
        ),
        (
            "A degenerescência macular da idade afecta sobretudo…",
            "A visão dos lados",
            "As pestanas",
            "A visão do centro",
            "A pálpebra",
            "C",
            "Ler e reconhecer rostos torna-se difícil.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Quem descreveu, no início do século XIX, as bases da teoria tricromática da visão das "
            "cores, mais tarde desenvolvida por Helmholtz?"
        ),
        (
            "O glaucoma agudo, com dor forte e vómitos, é…",
            "Normal",
            "Uma urgência",
            "Uma alergia",
            "Uma miopia",
            "B",
            "É preciso ir logo ao hospital para baixar a pressão do olho.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "A que se refere, na teoria da visão das cores, o 'processo de oposição' (opponent "
            "process), formulado por Ewald Hering em alternativa parcial à teoria tricromática?"
        ),
        (
            "Que doença da retina pode ser detectada pelo reflexo branco numa foto?",
            "O retinoblastoma",
            "A conjuntivite",
            "O terçol",
            "A presbiopia",
            "A",
            "O retinoblastoma é um tumor raro da infância; tratado cedo, tem bom prognóstico.",
            "doencas_estrabismo",
        ),
    ),
    (
        (
            "Ewald Hering, autor da lei da inervação equivalente usada em estrabismo, era, por "
            "formação, sobretudo um investigador de que área?"
        ),
        (
            "Como se chama o exame que mede a pressão do olho?",
            "Audiometria",
            "Electrocardiograma",
            "Tonometria",
            "Radiografia",
            "C",
            "A tonometria mede a pressão do olho, importante no glaucoma.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "A quem se atribui a formulação, no século XIX, da lei da inervação recíproca dos "
            "músculos oculares?"
        ),
        (
            "Que exame mostra a visão dos lados?",
            "O raio-X ao peito",
            "A análise ao sangue",
            "O teste de audição",
            "O campo visual",
            "D",
            "O campo visual mostra falhas na visão periférica.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Charles Sherrington recebeu, em 1932, o Prémio Nobel de Fisiologia ou Medicina, "
            "sobretudo por trabalhos em que área da neurofisiologia?"
        ),
        (
            "O tratamento mais usado no glaucoma é…",
            "Gotas diárias",
            "Óculos de sol",
            "Penso no olho",
            "Exercícios",
            "A",
            "As gotas baixam a pressão do olho e travam a doença.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "A que grupo de investigadores se atribui, já no século XX, uma melhor compreensão do "
            "papel do córtex visual (e não apenas do olho) na fisiopatologia da ambliopia?"
        ),
        (
            "A visão perdida no glaucoma…",
            "Não volta",
            "Volta sozinha",
            "Volta com óculos",
            "Volta com cenouras",
            "A",
            "Por isso o diagnóstico precoce é tão importante.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "A primeira descrição científica rigorosa e sistemática do estrabismo, segundo a "
            "documentação histórica usada como base deste jogo, consolidou-se sobretudo em que "
            "século?"
        ),
        (
            "Quem tem pais com glaucoma deve…",
            "Não se preocupar",
            "Usar só óculos de sol",
            "Comer mais sal",
            "Fazer exames regulares",
            "D",
            "A história familiar aumenta o risco.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Antes do desenvolvimento da cirurgia muscular no século XIX, que abordagens "
            "'alternativas' (hoje abandonadas) chegaram a ser tentadas historicamente para o "
            "estrabismo?"
        ),
        (
            "Para que serve o exame do \"reflexo vermelho\" nos bebés?",
            "Ver se tem fome",
            "Detectar cedo doenças graves",
            "Medir a altura do bebé",
            "Saber se o bebé vai ter sono",
            "B",
            "Diferenças no reflexo podem indicar catarata ou tumor.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Comparando com o século XIX, o que mudou mais radicalmente no tratamento do "
            "estrabismo até aos dias de hoje?"
        ),
        (
            "Os bebés prematuros devem fazer exame à retina porque…",
            "Têm sempre olhos azuis",
            "Choram muito de noite",
            "Dormem muitas horas",
            "Os vasos podem crescer mal",
            "D",
            "O rastreio da retinopatia da prematuridade evita cegueira.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "O que é, tecnicamente, a 'dioptria prismática' (DP ou Δ), unidade usada para "
            "quantificar desvios oculares?"
        ),
        (
            "Porque se injecta toxina botulínica num músculo do olho?",
            "Para o tornar mais forte",
            "Para o enfraquecer um tempo",
            "Para mudar a cor",
            "Para limpar o olho",
            "B",
            "Enfraquecer um músculo ajuda o olho a endireitar-se.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Qual é, aproximadamente, a relação de conversão entre graus de ângulo e dioptrias "
            "prismáticas, usada na prática clínica para pequenos ângulos?"
        ),
        (
            "Quem começou a usar a toxina botulínica no estrabismo?",
            "Alan Scott",
            "Louis Braille",
            "Jacques Daviel",
            "John Dalton",
            "A",
            "O oftalmologista Alan Scott usou-a nos anos 70; foi aprovada em 1989.",
            "prevencao_cuidados",
        ),
    ),
    (
        "O 'ponto remoto' de um olho míope, em óptica geométrica, corresponde a quê?",
        (
            "Uma cirurgia ao estrabismo pode precisar de ser repetida?",
            "Nunca",
            "Sim, às vezes",
            "Sempre três vezes",
            "Só em adultos",
            "B",
            "Alguns casos precisam de mais de uma cirurgia para o melhor resultado.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Numa lente com vergência de +4,00 dioptrias, a que distância aproximada, em metros, "
            "se forma a sua distância focal?"
        ),
        (
            "Que gotas usa o médico para medir a graduação real de uma criança?",
            "Gotas de limão",
            "Gotas de água salgada",
            "Gotas que relaxam o foco",
            "Gotas de açúcar",
            "C",
            "As gotas cicloplégicas impedem a criança de \"esconder\" a hipermetropia.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Ao combinar duas lentes finas justapostas, como se calcula (em boa aproximação) a "
            "vergência total do sistema?"
        ),
        (
            "Quem tem diabetes protege os olhos sobretudo…",
            "Usando lentes de contacto coloridas",
            "Controlando o açúcar no sangue",
            "Dormindo de dia",
            "Bebendo refrigerantes",
            "B",
            "Um bom controlo da diabetes reduz os danos na retina.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "O 'princípio de reversibilidade' em óptica geométrica, aplicado à retinoscopia, "
            "afirma que:"
        ),
        (
            "O ortoptista mede o desvio do olho com…",
            "Termómetros",
            "Prismas",
            "Balanças",
            "Relógios",
            "B",
            "Os prismas desviam a luz e mostram o tamanho do desvio.",
            "prevencao_cuidados",
        ),
    ),
    (
        "Uma lente 'afáquica' é usada em que contexto clínico específico?",
        (
            "O teste com quatro luzes coloridas (de Worth) avalia…",
            "Se os olhos trabalham juntos",
            "A pressão do olho",
            "A cor dos olhos",
            "A audição da criança",
            "A",
            "Com óculos vermelho-verde, vê-se se o cérebro usa os dois olhos.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "O que é, tecnicamente, a 'aniseiconia', um conceito óptico relevante em "
            "anisometropias corrigidas apenas com óculos?"
        ),
        (
            "Depois da cirurgia às cataratas, deve-se evitar…",
            "Esfregar o olho",
            "Ver televisão",
            "Comer",
            "Andar a pé",
            "A",
            "Esfregar pode deslocar a lente ou infectar o olho.",
            "prevencao_cuidados",
        ),
    ),
    (
        (
            "Por que motivo as lentes de contacto tendem a gerar menos aniseiconia do que óculos "
            "equivalentes, numa anisometropia significativa?"
        ),
        (
            "Porque se deve ir à consulta mesmo sem queixas?",
            "Há doenças sem sintomas",
            "Para ganhar descontos",
            "Para mudar a cor dos olhos",
            "Por obrigação legal",
            "A",
            "Glaucoma e diabetes podem afectar os olhos sem dar sinais.",
            "prevencao_cuidados",
        ),
    ),
)


def upgrade() -> None:
    conexao = op.get_bind()
    reescritas = 0
    for texto_antigo, nova in _REESCRITAS:
        valores = dict(zip(_CAMPOS, nova, strict=True))
        reescritas += conexao.execute(
            sa.update(_perguntas_jogo)
            .where(_perguntas_jogo.c.texto_pergunta == texto_antigo)
            .values(**valores)
        ).rowcount
    resultado = semear_perguntas(conexao)
    print(
        f"perguntas_jogo: {reescritas} reescritas no lugar, {resultado.inseridas} inseridas, "
        f"{resultado.categorias_corrigidas} categorias corrigidas, {resultado.inalteradas} já em dia"
    )


def downgrade() -> None:
    # Os textos novos ficam (ver a docstring).
    pass

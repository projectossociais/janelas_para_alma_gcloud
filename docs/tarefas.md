# Folha de tarefas — `tarefas.csv`

Folha simples de gestão entre o Wilson (`W`) e o Lukeny (`L`). O `BACKLOG.md`
continua a ser o *porquê* de cada tarefa (prosa); este CSV é o *quadro*:
quem faz o quê, com que prioridade, e em que estado.

## Colunas

| Coluna | Valores |
|---|---|
| `id` | identificador estável (`INF-*`, `DEP-*`, `W-*`, `L-*`, `S4-*`…, `CROSS-*`, `NAO-*`) |
| `area` | `infra` · `api` · `frontend` · `ci` · `legal` · `docs` · `-` |
| `tarefa` | descrição curta |
| `prioridade` | `P0` (agora) · `P1` · `P2` · `P3` · `-` |
| `estado` | `feito` · `em-curso` · `a-fazer` · `bloqueado` · `nao-fazer-agora` |
| `responsavel` | `W` · `L` · `W+L` · `-` |
| `sprint` | `infra-0..6` · `infra-extra` · `deploy` · `S0..S6` · `transversal` |
| `atualizado` | data ISO da última mudança de estado |
| `notas` | dependências, bloqueios, contexto |

## Fluxo

1. Ao **fechar** uma tarefa (ou combinar uma nova, ou eu sugerir uma
   funcionalidade/implementação): actualiza-se a linha no `tarefas.csv` **no
   mesmo commit** que a fecha, e volta-se a gerar o tracker
   (`python docs/gerar_tracker.py`). O `git log docs/tarefas.csv` passa a ser
   o registo de quem fez o quê e quando.
2. Reimportar no Google Sheets: *Ficheiro → Importar → Carregar* o
   `tarefas.csv` → **Substituir folha atual**. Fica sempre a versão de agora.
3. Edições feitas só no Sheets (comentários, colunas extra do Lukeny) **não
   voltam** para o CSV — o CSV é a fonte, o Sheets é a vista partilhada.

## `tracker.html` — vista só-leitura

`docs/tracker.html` é **gerado** a partir do CSV por `docs/gerar_tracker.py`
(só biblioteca padrão do Python). Abre em qualquer browser sem servidor:
tabela ordenada por estado, com filtros por estado/responsável, procura e
barra de progresso. Não editar à mão — editar o CSV e voltar a gerar.

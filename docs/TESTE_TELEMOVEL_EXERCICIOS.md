# Teste em telemóvel real: exercícios sem webcam

Checklist para percorrer **com o dedo, no telemóvel**, antes do merge. Demora cerca de
30 a 40 minutos. Anote o que falhar na tabela do fim (secção 4).

## 1. Abrir o site local no telemóvel (mesma rede Wi-Fi, sem internet pública)

O telemóvel só precisa de chegar ao **frontend (porta 8080)**. O Vite reencaminha `/api/*`
para a API em `localhost:8000`, dentro do computador, por isso a API nunca precisa de ser
acessível ao telemóvel.

1. **API e base de dados no computador.** Duas opções:
   - **Recomendada, nada exposto além do frontend:** Postgres local e a API só em
     `127.0.0.1`:
     ```bash
     cd api && DATABASE_URL=postgresql+psycopg://jpa:jpa@localhost:5432/jpa python -m alembic upgrade head
     ```
     ```bash
     cd api && DATABASE_URL=postgresql+psycopg://jpa:jpa@localhost:5432/jpa python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
     ```
   - **Com o `docker compose up`:** funciona, mas o `docker-compose.yml` publica a base
     (5432, `jpa/jpa`) e a API (8000) em **todas** as interfaces, por isso ficam visíveis
     a outros aparelhos da mesma rede. Use só numa rede de confiança (casa, não Wi-Fi
     público) e desligue no fim.
2. **Frontend:**
   ```bash
   cd frontend && npm run dev
   ```
   O `vite.config.ts` já escuta em todas as interfaces (`host: "::"`). O terminal mostra
   uma linha `Network: http://192.168.x.x:8080/`.
3. **IP do computador**, se a linha `Network` não aparecer:
   ```bash
   ipconfig getifaddr en0
   ```
   No Windows é `ipconfig`, e no Linux é `hostname -I`.
4. **No telemóvel**, ligado à mesma rede Wi-Fi, abrir `http://<IP-do-computador>:8080/`.
   Se não abrir, o firewall do computador pode estar a bloquear a porta 8080. No macOS,
   aceitar a pergunta "permitir ligações de entrada" do Node.
5. **Conta de teste:** uma conta local com Premium (ou um trial iniciado), para ter os 8
   exercícios desbloqueados. Nunca usar uma conta ou password reais.

**Nada disto expõe o site à internet:** é `http` na rede local, sem reencaminhamento de
portas no router. Ao terminar, pare o `npm run dev` e a API.

**Limitação:** em `http://192.168…` o browser não dá acesso à câmara (exige HTTPS). Por
isso o **scanner** não funciona assim no telemóvel. Os exercícios não usam câmara e
funcionam normalmente.

## 2. Preparação

- [ ] Brilho do ecrã **no máximo**, modo nocturno e filtro de luz azul **desligados**.
- [ ] Um **cartão bancário** (ou outro com o mesmo tamanho: 85,6 × 54 mm).
- [ ] **Óculos vermelho-ciano** de papel (filtro vermelho no olho **esquerdo**), para a
      Estereopsia.
- [ ] Um **tapa-olho** (para os treinos) e uma fita métrica ou régua (60 cm e 1 m).
- [ ] Ter à mão a tabela de anotação (secção 4).

## 3. Checklist

Em cada item: **o que fazer** → **o que deve acontecer**. Se não acontecer, anote na
tabela da secção 4 o número do item.

### A. Calibração com cartão real
1. Abrir `/exercicios/acuidade` → Continuar → ecrã "Ajuste ao tamanho de um cartão".
   → Com o telemóvel **na vertical**, a moldura aparece **ao alto** (lado curto na
   horizontal) e o texto diz "na vertical".
2. Encostar o cartão ao ecrã, dentro da moldura, e mover o controlo.
   → É possível fazer a moldura **coincidir exactamente** com o cartão, nos dois lados.
   → O controlo é fácil de mover com o dedo, sem a página fazer scroll ao mesmo tempo.
3. Tocar "O cartão coincide". Ao voltar a um exercício, deve aparecer "Ecrã já
   calibrado".
4. Medir com a régua um anel grande do Teste de Acuidade a 60 cm. Pouco rigoroso, mas
   apanha erros grosseiros: um anel de logMAR 1,0 a 60 cm deve ter **cerca de 8,7 mm**
   de diâmetro exterior.

### B. Anel e selector de 8 sectores
5. No Teste de Acuidade (olho direito): o **anel**, os **8 sectores** e o botão **"Não
   vejo"** estão **todos visíveis sem scroll**, na vertical.
6. Cada sector acerta-se à primeira com o polegar, sem tocar no sector ao lado. Os alvos
   devem ter pelo menos ~1 cm.
7. Ao tocar num sector, o anel desaparece por um instante e aparece noutra direcção.
   Nunca há duas direcções iguais seguidas.

### C. Teste de Acuidade a 60 cm e a 1 m
8. A 60 cm, braço esticado: completar os dois olhos (tapar com a mão).
   → Resultado por olho em 6/x, decimal e logMAR. Aviso de triagem visível.
   → "Guardado no seu histórico" aparece **só depois** de guardar.
9. Se aparecer "Chegou ao tamanho mais pequeno que este ecrã consegue mostrar", tocar
   "Repetir a 1 metro" e repetir a 1 m.
   → Os anéis ficam proporcionalmente mais pequenos e o resultado é coerente com o de
   60 cm.

### D. Modo escuro e orientação
10. Pôr o telemóvel em **modo escuro** e abrir um exercício.
    → A página fica escura, mas o **palco (a área do anel) continua branco com o anel
    preto**.
11. Rodar para a **horizontal** num teste a decorrer.
    → Nada fica cortado, não há scroll horizontal e o anel continua visível. Voltar à
    vertical: igual.

### E. Contraste
12. `/exercicios/contraste`: completar os dois olhos.
    → O anel começa preto e vai clareando. Nos últimos degraus deve ficar **quase
    invisível**. Anote se consegue distinguir os degraus mais fracos ou se "saltam"
    todos de uma vez.
    → Os degraus que o ecrã não consegue mostrar são descartados automaticamente. Se
    chegar ao mais fraco que o ecrã mostra, o resultado leva "≥" e o aviso "Chegou ao
    contraste mais fraco que este ecrã consegue mostrar…".
13. O resultado diz "Não há aqui valores de referência clínicos…", compara os dois olhos
    e mostra o resultado anterior, se existir.

### F. Estereopsia (óculos vermelho-ciano reais, os dois olhos abertos)
14. Passo "Verifique os óculos 3D": fechar o olho direito → deve ver **só uma** das
    letras. Fechar o esquerdo → vê **só a outra**.
    → Se escolher mal (ou "Vejo as duas"), aparece "Os óculos não estão a separar as
    imagens", com "Tentar de novo" e "Continuar mesmo assim".
15. Estereograma: com os óculos, a forma do meio deve **"saltar"** do fundo. Testar as
    **4 formas** (círculo, quadrado, triângulo, estrela). Sem os óculos, só deve
    aparecer ruído (com franjas de cor, que é normal no anáglifo).
16. Resultado em segundos de arco, com o aviso **"Resultado indicativo… cross-talk"**
    visível.

### G. Astigmatismo
17. `/exercicios/astigmatismo`: o leque de linhas cabe no ecrã, na vertical, sem ficar
    deformado. Responder "Sim" num olho e "Não, há linhas mais escuras" no outro.
    → O resultado por olho corresponde às respostas.

### H. Convergência (os dois olhos abertos, sem tapa-olho)
18. Antes de começar, aparecem os avisos "Pare se sentir dor de cabeça…" e "Quem tem
    estrabismo diagnosticado…".
19. Os botões "Vejo 1" e "Vejo 2" são grandes e ficam visíveis juntamente com os pontos,
    sem scroll. Trocar para "Avançado (saltos)": os pontos mudam de distância de repente.
20. Ficar ~6 s sem tocar → aparece "Continua a ver o mesmo? Toque para confirmar".
    → Este lembrete **não** deve aparecer antes da primeira resposta.
21. A 10.ª resposta mostra **um ponto só** e a pergunta "Quantos pontos vê?".
22. No fim do bloco (2 min de respostas), a pausa **não** manda "destapar o olho".

### I. Perto e longe (tapa-olho no olho mais forte)
23. O ecrã do tapa-olho diz "A mão não basta… Use um tapa-olho".
24. Alternar perto (anel no ecrã, ~40 cm) e longe (um objecto a 3 m ou mais), tocando
    "Nítido" em cada um.
    → O "Nível" sobe quando é rápido e desce quando demora.
25. À 10.ª tentativa aparece um anel grande com "Para que lado está a abertura deste
    anel?" e o selector de 8 sectores.
26. A pausa entre blocos diz "Destape o olho…" (aqui está certo).

### J. Geral
27. Em todos os ecrãs está o aviso: "Teste de triagem…" nos testes e "Complementa o
    tratamento prescrito…" nos treinos.
28. O botão "Sair" funciona em qualquer passo e volta à lista.
29. `/exercicios/progresso` e `/exercicios/relatorio` abrem sem erros. O relatório
    imprime ou guarda em PDF a partir do telemóvel ("Imprimir ou guardar PDF").

## 4. Tabela de anotação

Copie uma linha por item que **falhou** (ou por observação importante). Se tudo passou num
aparelho, basta uma linha com "todos" e "passou".

| Dispositivo (modelo) | Sistema | Navegador (versão) | Item nº | Passou / Falhou | Observação (o que viu, captura de ecrã, orientação, modo escuro?) |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

Idealmente, testar pelo menos **um Android com Chrome** e **um iPhone com Safari**.

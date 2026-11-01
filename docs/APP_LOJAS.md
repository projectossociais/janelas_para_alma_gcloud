# App nas lojas — Google Play e App Store

> Estado a 2026-10-30: os projectos nativos estão criados (`frontend/android`,
> `frontend/ios`), mas **nenhuma versão foi compilada nem enviada** — falta instalar o
> Android Studio e o Xcode neste Mac. As compras pelas lojas estão programadas (secção 3.1),
> mas só funcionam depois de criar os produtos nas lojas e a conta no RevenueCat.

## 1. Como a app funciona

A app é o próprio site, aberto dentro de uma "casca" nativa feita com **Capacitor**
(`frontend/capacitor.config.ts`):

- Abre `https://www.janelasparaalma.com` (`server.url`). Não leva uma cópia do build lá
  dentro, para o `/api/*` continuar na mesma origem e o cookie `httpOnly` de sessão
  continuar a funcionar (CLAUDE.md §2 e §3b).
- **Cada deploy do Vercel chega logo à app**, sem nova versão nas lojas. Só é preciso
  publicar uma versão nova quando muda algo nativo: ícone, nome, permissões, plugins,
  versão do Capacitor.
- Sem internet, mostra `app-nativa/www/sem-ligacao.html`.
- Links para outros domínios (WhatsApp, BAI, redes sociais) abrem no browser do
  telemóvel; só `janelasparaalma.com` abre dentro da app.
- O site sabe que está na app por `estaNaAppNativa()` (`src/lib/appNativa.ts`).
  Serve para esconder o login com Google e para trocar a transferência + comprovativo
  pela compra na loja (secção 3).
- Permissões: câmara (rastreio). No iOS também fotos, microfone e reconhecimento de voz
  (só usados se a pessoa ligar a resposta por voz), com textos em `ios/App/App/Info.plist`.

| | Valor |
|---|---|
| Identificador (os dois) | `com.janelasparaalma.app` — **não se pode mudar depois de publicar** |
| Nome | Janelas Para a Alma |
| Ícone e ecrã de abertura | `app-nativa/recursos/` → `npm run app:icones` |
| Versão Android | `android/app/build.gradle` (`versionCode` sobe +1 em cada envio, `versionName`) |
| Versão iOS | Xcode → App → General (Version / Build) |

Comandos (dentro de `frontend/`):

```bash
npm run app:sync      # copia a config e os plugins para android/ e ios/
npm run app:android   # abre no Android Studio
npm run app:ios       # abre no Xcode
```

## 2. Quanto custa

| | Custo | Notas |
|---|---|---|
| Google Play Console | **25 USD, uma vez** | Cartão Visa/Mastercard internacional |
| Apple Developer Program | **99 USD por ano** | Organizações sem fins lucrativos podem pedir isenção da taxa — verificar se Angola é elegível em developer.apple.com/support/membership-fee-waiver |
| Número D-U-N-S | Grátis | Só para conta de **organização** (recomendado, ver passo 1). Pede-se em dnb.com; demora 1 a 4 semanas |
| Mac com Xcode | Já existe | O Xcode é grátis na Mac App Store (precisa de ~40 GB livres) |
| Android Studio | Grátis | |
| Telemóvel Android e iPhone para testar | — | Recomendado; os simuladores servem para começar |

**Total para começar: 124 USD** (≈ 25 + 99), depois 99 USD por ano para a Apple.

Nas vendas feitas dentro da app:

| | Fica com |
|---|---|
| Apple / Google | **15%** de cada venda (Small Business Program da Apple e taxa da Google para subscrições e até 1 milhão USD/ano — inscrever-se no programa da Apple, não é automático) |
| RevenueCat | Grátis até 2.500 USD de receita por mês; acima disso, 1% |

## 3. Antes de submeter — o que as lojas vão recusar

### 3.1 Pagamentos — compras pelas lojas (decidido a 2026-10-30)

O Premium e os diamantes/moedas do jogo são **produtos digitais**: a Apple (guideline
3.1.1) e a Google obrigam a vendê-los pelo sistema de pagamento delas dentro da app.
Decisão do dono do projecto: **na app, vendem-se pelas lojas**. O site continua igual
(transferência + comprovativo).

Como funciona (já programado):

- Na app, `/registo-premium` mostra a subscrição mensal pela loja (`PremiumNaApp`), e as
  lojas do jogo trocam o botão em Kz pela compra na loja (`BotaoCompraNaLoja`). Nada de
  Kwanzas, IBAN nem comprovativo dentro da app. O plano anual não existe na app.
- A compra passa pelo **RevenueCat** (`@revenuecat/purchases-capacitor`), que fala com a
  Apple e a Google e confirma o recibo. A app identifica-se com o `id` da conta.
- O RevenueCat chama `POST /api/webhooks/revenuecat` (`CompraLojaService`), que dá o
  Premium (+ o período pago, somado à validade actual) ou os diamantes/moedas do
  catálogo. Cada transacção aplica-se uma única vez (tabela `compras_loja`). Reembolsos
  tiram só o que essa compra deu.
- A app só diz "Premium activado" ou "compra concluída" quando a API já o mostra.
- Compras de teste (sandbox) também creditam, porque o revisor da Apple compra assim.

**Ids dos produtos** — têm de ser exactamente estes nas duas lojas (estão no código, em
`compra_loja_service.py` e `comprasLoja.ts`):

| Produto | Tipo na loja | Dá |
|---|---|---|
| `jpa_premium_mensal` | Subscrição com renovação automática, 1 mês (no Google Play: plano base `mensal`) | +1 mês de Premium por pagamento |
| `jpa_diamantes_pequeno` / `_medio` / `_grande` | Consumível | 50 / 165 / 480 diamantes |
| `jpa_moedas_pilha` / `_saco` / `_bau` | Consumível | 1.000 / 3.300 / 9.000 moedas |

**Preços**: definem-se nas consolas das lojas, em escalões de USD (a loja converte para a
moeda de cada país). **Decisão do dono do projecto, ainda por tomar.** Referência:
15.000 Kz ≈ 16 USD; com os 15% da loja, recebe-se ≈ 85% do preço.

**Passos para activar** (por esta ordem):

1. **Contratos e pagamentos das lojas**
   - Apple: App Store Connect → Business → aceitar o *Paid Apps Agreement*, preencher
     conta bancária e impostos. Inscrever-se no *App Store Small Business Program* (15%).
   - Google: Play Console → Definições → Perfil de pagamentos (conta de comerciante).
   - ⚠️ **Confirmar primeiro que as duas lojas pagam a uma conta bancária em Angola**
     (ou a uma conta da associação noutro país). Se não pagarem, as compras na app não
     são possíveis e volta-se à opção de esconder as compras na app.
2. **Criar os produtos** com os ids da tabela acima.
   - App Store Connect → a app → Subscrições → grupo "Premium" → `jpa_premium_mensal`;
     In-App Purchases → os 6 consumíveis.
   - Play Console → a app → Monetizar → Subscrições → `jpa_premium_mensal` com o plano
     base `mensal`; Produtos no app → os 6 consumíveis. (O Google só deixa criar produtos
     depois de enviar um AAB que já tenha o plugin de compras.)
3. **RevenueCat** (revenuecat.com, conta grátis): criar o projecto, ligar a app iOS (chave
   de In-App Purchase da App Store Connect) e a app Android (conta de serviço do Google
   Play), e importar os 7 produtos.
4. **Webhook**: RevenueCat → Integrations → Webhooks →
   URL `https://www.janelasparaalma.com/api/webhooks/revenuecat` e, em *Authorization
   header*, um valor longo e aleatório. Guardar esse mesmo valor no Secret Manager:
   ```bash
   printf '%s' 'O-VALOR-DO-AUTHORIZATION' | gcloud secrets create jpa-revenuecat-webhook --data-file=-
   ```
   e voltar a fazer deploy da API (o `04-deploy.sh` liga-o como `REVENUECAT_WEBHOOK_SEGREDO`).
   Não correr o `03-secrets.sh` inteiro para isto (CLAUDE.md §4.8).
5. **Chaves públicas do SDK** no Vercel (Settings → Environment Variables), e novo deploy:
   `VITE_REVENUECAT_CHAVE_IOS` (começa por `appl_`) e `VITE_REVENUECAT_CHAVE_ANDROID`
   (começa por `goog_`). Sem elas, a app diz "as compras ainda não estão disponíveis".
6. **Xcode** → App → Signing & Capabilities → **+ Capability → In-App Purchase**.
7. **Testar**: Apple — conta *Sandbox* (App Store Connect → Utilizadores → Sandbox) num
   iPhone com TestFlight; Google — *License testers* na Play Console, com a app no teste
   interno. Comprar, ver o Premium/saldo aparecer, e "Restaurar compras".

**Doações**: continuam por transferência no site. Na Apple, só organizações sem fins
lucrativos aprovadas podem receber doações dentro da app — antes de submeter, confirmar
se a página "Apoiar" deve ficar escondida na app.

### 3.2 Login com Google — já tratado

O Google bloqueia o login dentro de uma app embutida, e a Apple exigiria "Iniciar sessão
com a Apple" ao lado. Na app, o botão do Google não aparece; entra-se com email e password.

### 3.3 Outras exigências

- **Eliminar a conta dentro da app** (Apple 5.1.1(v)): já existe em Configurações. ✔
- **Política de privacidade** pública: `https://www.janelasparaalma.com/politica-de-privacidade`. ✔
- **Conta de teste para o revisor**: criar uma conta confirmada **sem** Premium (o revisor
  testa a compra em sandbox) e dar o email e a password no formulário de submissão (nunca
  no repositório).
- **"Só um site embrulhado"** (Apple 4.2): é o maior risco na App Store. A favor: câmara
  nativa no rastreio, ecrã sem ligação, conteúdo próprio. Se a Apple recusar, o próximo
  passo é acrescentar algo nativo (notificações de lembrete do treino, por exemplo).
- **Saúde**: o texto da loja diz sempre **triagem e treino de apoio, nunca diagnóstico**
  (como o site). Nada de "trata", "cura" ou "corrige o estrabismo" — as duas lojas
  revêem apps de saúde com mais cuidado.
- **Público**: a conta é de um adulto (18+); a criança usa a conta do representante.
  **Não** escolher a categoria "Crianças"/"Família" — isso traria regras muito mais
  apertadas (sem análise de dados, sem links externos, sem compras).

## 4. Google Play — passo a passo

1. **Criar a conta** em play.google.com/console (25 USD).
   - Escolher **Organização** (precisa do D-U-N-S). Uma conta **pessoal** nova tem de
     fazer um **teste fechado com pelo menos 12 testadores durante 14 dias seguidos**
     antes de poder publicar em produção.
   - Verificação de identidade (documento) — pode demorar alguns dias.
2. **Instalar o Android Studio** (developer.android.com/studio). Já traz o Java.
3. Em `frontend/`: `npm run app:sync` e `npm run app:android`.
4. Testar num telemóvel (Run ▶) — entrar, fazer um exercício, o rastreio com câmara, ver
   o ecrã sem ligação (modo avião).
5. **Gerar o AAB assinado**: Build → Generate Signed App Bundle → criar uma *upload key*
   (ficheiro `.jks`). **Guardar o ficheiro e as passwords fora do repositório e com cópia
   de segurança** — sem ela não se consegue actualizar a app (pode pedir-se reposição à
   Google, mas demora).
6. Na Play Console → Criar app: nome, idioma pt-PT, App, Gratuita.
7. Preencher **Conteúdo da app**: política de privacidade, acesso à app (dar a conta de
   teste), anúncios (não), classificação de conteúdo (questionário), público-alvo (18+),
   **Segurança dos dados** (ver secção 6), **declaração de apps de saúde**.
8. **Ficha da loja**: descrição curta (80 caracteres), descrição completa, ícone 512×512
   (`app-nativa/recursos/icon-only.png` redimensionado), imagem de destaque 1024×500,
   pelo menos 2 capturas de ecrã de telemóvel.
9. Enviar o AAB para **Teste interno** → testar → **Teste fechado** (os 12 × 14 dias, se
   a conta for pessoal) → **Produção**. Revisão: de umas horas a ~7 dias.

## 5. App Store — passo a passo

1. **Inscrever-se no Apple Developer Program** (developer.apple.com/programs, 99 USD/ano)
   com a Apple ID da organização. Como organização: D-U-N-S, nome legal e site.
2. **Instalar o Xcode** pela Mac App Store e, num terminal:
   `sudo xcode-select -s /Applications/Xcode.app` (hoje o Mac só tem as Command Line Tools).
3. Em `frontend/`: `npm run app:sync` e `npm run app:ios`.
4. No Xcode → App → Signing & Capabilities: escolher a **Team**; o Bundle Identifier é
   `com.janelasparaalma.app`.
5. Testar no simulador e num iPhone real (câmara do rastreio, login, ecrã sem ligação).
6. Em appstoreconnect.apple.com → Apps → **+** → Nova app: nome, idioma Português
   (Portugal), bundle id, SKU (`janelasparaalma-ios`).
7. Xcode → Product → **Archive** → Distribute App → App Store Connect → Upload.
8. **TestFlight**: instalar no iPhone dos testadores e testar.
9. Preencher a ficha: descrição, palavras-chave, URL de suporte e de privacidade,
   capturas de ecrã (iPhone 6,9" obrigatório; iPad se a app estiver activa para iPad),
   classificação etária (questionário), **Privacidade da app** (secção 6), categoria
   **Saúde e fitness** ou **Medicina**, conta de teste em "Informações para a revisão".
10. **Submeter para revisão**: normalmente 1 a 3 dias. Se recusarem, a mensagem diz a
    guideline; responde-se pelo Resolution Center.

## 6. Privacidade — o que declarar nas lojas

Resumo para os formulários (Segurança dos dados na Google, Privacidade da app na Apple).
Confirmar com `docs/APD_NOTIFICACAO.md` antes de submeter.

| Dados | Recolhidos? | Para quê |
|---|---|---|
| Nome, email, telefone | Sim, ligados à conta | Funcionamento da app, conta |
| Dados de saúde (resultados do rastreio e dos exercícios) | Sim, ligados à conta, com consentimento expresso | Funcionamento da app |
| Fotografias do rastreio | **Não** — analisadas no telemóvel e apagadas; só números seguem para a API | — |
| Histórico de compras (produto, data, id da transacção da loja) | Sim, ligado à conta | Compras na app |
| Localização, contactos, publicidade, rastreio entre apps | Não | — |

Dados encriptados em trânsito: sim (https). A pessoa pode pedir para apagar a conta: sim.

## 7. Depois de publicada

- Mudanças no site → deploy normal (Vercel); a app actualiza-se sozinha.
- Mudanças nativas → subir `versionCode`/`versionName` (Android) e Version/Build (iOS),
  `npm run app:sync`, novo AAB/Archive, nova submissão.
- Uma mudança no site que **acrescente outra forma de pagar produtos digitais** dentro da
  app volta a esbarrar na secção 3.1 — as lojas revêem a app a qualquer momento.
- Um pacote ou produto novo: criá-lo nas duas lojas e no RevenueCat **e** acrescentá-lo
  ao catálogo da API (`compra_loja_service.py`). Um produto desconhecido é ignorado pelo
  webhook (fica no log como erro) — o cliente pagava sem receber.

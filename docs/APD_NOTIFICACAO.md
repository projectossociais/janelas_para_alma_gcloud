# Notificação e pedido de autorização à APD

> **Para quem:** o dono do projecto (Lukeny), que é quem representa o Janelas Para a
> Alma perante a Agência de Protecção de Dados (APD). **Passo administrativo que o
> código não resolve.** Preparado a 2026-09-30, sem jurista no projecto, a partir do
> texto da Lei n.º 22/11 e do que o sistema faz de facto (código de `api/` e
> `frontend/`).

---

## 1. Porque é obrigatório

| Regra da Lei n.º 22/11 | O que significa para nós |
|---|---|
| Art. 35.º, n.º 1 | Todo o tratamento de dados pessoais é notificado à APD **antes** de começar |
| Art. 13.º, 14.º e 35.º | Dados de saúde são sensíveis: além do consentimento escrito (já pedido no site desde 2026-09-30), o tratamento está sujeito a **autorização** da APD |
| Art. 33.º e 34.º | Os dados estão fora de Angola (Google Cloud na Bélgica; Cloudflare, Resend e Vercel com servidores noutros países): a transferência também se notifica |
| Multa | A falta de notificação é uma contravenção, com multa entre 7.000 e 15.000 dólares (em Kwanzas) |

A APD tem **30 dias** para responder a uma notificação (art. 35.º, n.º 2).

## 2. Como submeter

1. Em **www.apd.ao**, secção **Balcão** → formulário **"Legalização do Tratamento de
   Dados"** (há um instrutivo em PDF na mesma página). Pode ser preenchido e submetido
   online (com registo), ou descarregado, preenchido e enviado por email para
   **geral@apd.ao**, ou entregue em mão.
2. A APD também tem um formulário de **"Tratamento de Dados Biométricos"**. O scanner
   analisa imagens do rosto, mas **só para medir o alinhamento dos olhos, não para
   identificar pessoas**, e as imagens são apagadas logo a seguir. Recomendação:
   descrever isto na notificação geral e **perguntar à APD se o formulário biométrico
   também se aplica**.
3. Há uma **taxa variável** (Tabela de Taxas da APD).
4. Contactos da APD: Rua do MAT, Complexo Administrativo Clássicos de Talatona, 3.º
   edifício, 7.º andar, Luanda · +244 937 930 788 (também WhatsApp) · geral@apd.ao.
5. Guardar o comprovativo de submissão e a resposta, e avisar a equipa: a Política de
   Privacidade pode então dizer que o tratamento está notificado/autorizado.

## 3. Conteúdo para o formulário

**Responsável pelo tratamento:** Janelas Para a Alma, Luanda, Angola (iniciativa sem
NIF à data). Contacto para protecção de dados: janelasparaalma18@gmail.com.

**Finalidades**
1. Rastreio digital de estrabismo (triagem, não diagnóstico) e encaminhamento para
   clínicas parceiras, a pedido do utilizador.
2. Testes de triagem visual e treinos de apoio em casa, com registo da evolução.
3. Marcação de consultas e teleconsultas com clínicas parceiras.
4. Gestão de contas, subscrição Premium (pagamento por transferência) e comunicações
   (confirmação de email, recuperação de password, lembrete de treino se activado).
5. Relatório para o médico, partilhado pelo próprio utilizador por link temporário.
6. Doações, voluntariado e mensagens de contacto.

**Titulares:** adultos (contas só para maiores de 18). Crianças, cujos dados são
tratados através da conta e com o consentimento do pai, mãe ou representante legal.

**Categorias de dados**
- Identificação e contacto: nome, email, telefone, província, data de nascimento e
  género (opcionais).
- Conta: password (guardada só em hash argon2), preferências, estado Premium.
- **Saúde (sensíveis):** medições do alinhamento dos olhos e indicação de ir ou não ao
  oftalmologista (rastreio); resultados por olho dos testes e treinos visuais; perfil
  visual opcional (olho mais fraco, uso de óculos, faixa etária); pedidos de consulta.
- **Imagens do rosto:** captadas pela câmara só durante o rastreio, analisadas e
  **apagadas de imediato**; nunca guardadas.
- Pagamentos: comprovativo de transferência (Premium, loja do jogo), doações.

**Base legal:** consentimento inequívoco, expresso e escrito para os dados de saúde
(art. 13.º e 14.º), pedido num passo próprio antes do primeiro rastreio ou exercício,
com declaração de maioridade e, se for o caso, de representante legal de um menor;
registado com data e versão do texto (tabela `consentimentos_dados_saude`), revogável
nas Definições. Execução do contrato para a conta e a subscrição.

**Destinatários e subcontratantes (art. 23.º)**

| Prestador | Função | Localização |
|---|---|---|
| Google Cloud | Base de dados (Cloud SQL) e servidores da API (Cloud Run) | Bélgica (UE), região `europe-west1` |
| Cloudflare R2 | Ficheiros: fotografias de perfil, comprovativos | Rede global da Cloudflare |
| Resend | Envio de emails | EUA |
| Vercel | Entrega das páginas do site | Rede global |
| Google (opcional) | Entrar com conta Google | Global |
| Serviço de análise do rastreio (`janelas-scanner-api`) | Calcula as medições a partir das imagens, sem as guardar | **A confirmar pelo Lukeny** (onde está alojado) |
| Clínicas parceiras | Recebem o pedido de consulta, só quando o utilizador o faz | Angola |

**Transferências internacionais:** para a UE (Bélgica), país com nível de protecção
equiparável (notificação, art. 33.º); para os EUA e redes globais, com consentimento
expresso pedido no passo de consentimento (art. 34.º) e garantias contratuais dos
prestadores.

**Conservação:** enquanto a conta existir. Imagens do rastreio: nunca guardadas. Links
do relatório: 30 dias. Eliminação da conta: 30 dias depois do pedido, os dados que
identificam a pessoa são apagados e os resultados ficam anonimizados (job diário).

**Medidas de segurança (art. 30.º)**
- Ligações sempre cifradas (HTTPS); sessão em cookies `httpOnly` (inacessíveis a
  scripts); passwords com argon2; tokens de acesso de vida curta.
- Autorização verificada no servidor em cada pedido; área de administração só para
  contas com papel de administrador.
- A API recusa gravar dados de saúde sem consentimento válido.
- Nenhuma fotografia do rastreio é guardada; os ficheiros enviados vão directamente
  para o armazenamento, sem passar pelos servidores da API.
- Segredos no Google Secret Manager; cópia de segurança da base de dados antes de cada
  alteração de estrutura; anonimização automática das contas eliminadas.

**Direitos dos titulares (art. 25.º a 28.º):** informação (Política de Privacidade),
acesso, rectificação e eliminação pelas Definições ou por email; retirada do
consentimento nas Definições.

---

## 4. O que fica em aberto (risco residual, sem jurista)

- A leitura da lei aqui feita é de boa-fé, sem validação jurídica. Se houver
  orçamento no futuro, uma revisão por um jurista angolano continua a ser recomendada.
- Enquanto a APD não responder, a plataforma já cumpre o consentimento escrito
  (art. 14.º), mas a notificação/autorização (art. 35.º) está em falta: **submeter o
  quanto antes.**
- Confirmar onde está alojado o `janelas-scanner-api` e actualizar a tabela de
  subcontratantes e a Política de Privacidade se for fora da UE.

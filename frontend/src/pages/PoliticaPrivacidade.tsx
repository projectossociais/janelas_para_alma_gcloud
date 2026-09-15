import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import {
  Building2,
  Scale,
  Database,
  Target,
  Share2,
  Globe,
  UserCheck,
  ShieldAlert,
  Lock,
  Clock,
  Cookie,
  RefreshCw,
  Mail,
} from "lucide-react";

interface Secao {
  icon: typeof Building2;
  title: string;
  body: React.ReactNode;
}

const SECCOES: Secao[] = [
  {
    icon: Building2,
    title: "1. Identificação do Responsável pelo Tratamento",
    body: (
      <>
        <p>
          O <strong className="text-foreground">Janelas Para a Alma</strong> é o responsável pelo tratamento
          dos dados pessoais recolhidos através deste website e da plataforma associada (rastreio digital de
          estrabismo, exercícios de terapia visual, comunidade de suporte e áreas de utilizador).
        </p>
        <p>
          Para qualquer questão relativa a esta Política de Privacidade ou ao tratamento dos seus dados
          pessoais, pode contactar-nos através de{" "}
          <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium">
            janelasparaalma18@gmail.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    icon: Scale,
    title: "2. Base Legal",
    body: (
      <>
        <p>
          O tratamento de dados pessoais efetuado pelo Janelas Para a Alma rege-se pela{" "}
          <strong className="text-foreground">Lei n.º 22/11, de 17 de Junho</strong> (Lei de Protecção de Dados
          Pessoais da República de Angola), bem como pelo direito à reserva da intimidade da vida privada
          consagrado no <strong className="text-foreground">artigo 32.º da Constituição da República de
          Angola</strong>. Subsidiariamente, aplicam-se as disposições gerais da legislação angolana em vigor
          sobre protecção de dados e comércio electrónico.
        </p>
        <p>
          Nos termos do <strong className="text-foreground">artigo 12.º</strong> da Lei n.º 22/11, todo o
          tratamento de dados assenta no seu consentimento inequívoco e expresso, salvo nas excepções previstas
          na lei (execução de um contrato do qual seja parte, cumprimento de uma obrigação legal, protecção de
          interesse vital do titular, ou prossecução de missão de interesse público). Para dados de saúde, aplica-se
          ainda o regime reforçado do <strong className="text-foreground">artigo 14.º</strong>, descrito na secção
          seguinte.
        </p>
      </>
    ),
  },
  {
    icon: Database,
    title: "3. Dados Pessoais Recolhidos",
    body: (
      <>
        <p>Consoante a forma como utiliza a plataforma, podemos recolher:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Dados de identificação e contacto: nome, email, número de telefone, província de residência;</li>
          <li>Dados de conta: credenciais de acesso e preferências de utilização;</li>
          <li>
            <strong className="text-foreground">Dados de saúde e visuais</strong> — nomeadamente os resultados
            do rastreio digital de estrabismo (imagens ou métricas faciais processadas pelo scanner, tipo de
            estrabismo indicado, histórico de sintomas partilhado voluntariamente) e o progresso registado nos
            exercícios de terapia visual;
          </li>
          <li>Dados de navegação e utilização técnica da plataforma, recolhidos através de cookies (ver secção 10).</li>
        </ul>
        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">
            Os <strong className="text-foreground">dados de saúde</strong> constituem{" "}
            <strong className="text-foreground">dados sensíveis</strong> nos termos do artigo 5.º, alínea c),
            da Lei n.º 22/11. Não são tratados pela simples utilização do website: nos termos do{" "}
            <strong className="text-foreground">artigo 14.º</strong> da mesma lei, só recolhemos e processamos
            dados de saúde mediante{" "}
            <strong className="text-foreground">consentimento inequívoco, expresso e escrito</strong> do
            titular (ou do seu representante legal) — dado de forma livre, específica e informada,
            nomeadamente ao iniciar voluntariamente um rastreio ou ao submeter resultados de exercícios —
            nunca por consentimento implícito ou pré-assinalado, salvo nas excepções estritas previstas na lei
            (designadamente medicina preventiva, diagnóstico ou emergência médica).
          </p>
        </div>
      </>
    ),
  },
  {
    icon: Target,
    title: "4. Finalidade do Tratamento",
    body: (
      <>
        <p>Os dados recolhidos são utilizados exclusivamente para:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Personalizar a sua experiência na plataforma (ex.: recomendar exercícios adequados ao seu perfil);</li>
          <li>
            Estabelecer a ligação a clínicas e profissionais de saúde visual parceiros,{" "}
            <strong className="text-foreground">apenas mediante o seu consentimento explícito</strong> e quando
            solicitar esse encaminhamento;
          </li>
          <li>Enviar comunicações relevantes sobre o projecto, o seu progresso na plataforma e novidades de saúde visual;</li>
          <li>Cumprir obrigações legais e responder a pedidos das autoridades competentes.</li>
        </ul>
      </>
    ),
  },
  {
    icon: Share2,
    title: "5. Partilha de Dados com Terceiros",
    body: (
      <p>
        Não vendemos nem cedemos os seus dados pessoais para fins comerciais de terceiros. Os seus dados só são
        partilhados com clínicas e profissionais de saúde visual parceiros quando demonstra interesse directo
        nesse encaminhamento, e com prestadores de serviços que apoiam o funcionamento técnico da plataforma
        (por exemplo, alojamento e infraestrutura de envio de email), sempre limitados ao estritamente
        necessário e sujeitos a obrigações de confidencialidade equivalentes às aqui descritas.
      </p>
    ),
  },
  {
    icon: Globe,
    title: "6. Transferência Internacional de Dados",
    body: (
      <p>
        A infraestrutura técnica que suporta o Janelas Para a Alma — base de dados e serviços de alojamento —
        pode estar localizada em servidores fora do território angolano, operados pela{" "}
        <strong className="text-foreground">Google Cloud Platform</strong>. Nos termos do{" "}
        <strong className="text-foreground">artigo 33.º</strong> da Lei n.º 22/11, quando o país de destino
        assegure um nível de protecção adequado, a transferência está sujeita a mera notificação prévia à
        Agência de Protecção de Dados (APD). Caso o país de destino não assegure esse nível de protecção
        adequado, aplica-se o regime mais exigente do{" "}
        <strong className="text-foreground">artigo 34.º</strong>, que sujeita a transferência a autorização
        prévia da APD, dependente, entre outras condições, do seu consentimento inequívoco, expresso e escrito.
        Em qualquer dos casos, a transferência é sempre acompanhada de garantias contratuais e técnicas
        adequadas de segurança e confidencialidade.
      </p>
    ),
  },
  {
    icon: UserCheck,
    title: "7. Os Seus Direitos enquanto Titular de Dados Pessoais",
    body: (
      <>
        <p>Nos termos da Lei n.º 22/11, tem, a qualquer momento, o direito de:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Informação</strong> (artigo 25.º) — ser informado sobre a existência e finalidade do tratamento dos seus dados;</li>
          <li><strong className="text-foreground">Acesso</strong> (artigo 26.º) — obter confirmação e cópia dos dados pessoais que tratamos sobre si;</li>
          <li><strong className="text-foreground">Oposição</strong> (artigo 27.º) — opor-se a um tratamento específico dos seus dados;</li>
          <li><strong className="text-foreground">Rectificação, actualização e eliminação</strong> (artigo 28.º) — corrigir dados incompletos ou inexactos, ou solicitar o apagamento dos seus dados e da sua conta; o Janelas Para a Alma tem o dever legal de responder no prazo de 60 dias úteis;</li>
          <li><strong className="text-foreground">Retirada do consentimento</strong> — a qualquer momento, sem afectar a licitude do tratamento já realizado até essa data;</li>
          <li>
            <strong className="text-foreground">Portabilidade</strong> — ainda que a Lei n.º 22/11 não preveja
            expressamente este direito, disponibilizamo-lo como boa prática adicional: pode solicitar a
            entrega dos dados que nos forneceu num formato estruturado.
          </li>
        </ul>
        <p>
          Pode exercer estes direitos através da área de Configurações da sua conta ou contactando-nos
          directamente em{" "}
          <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium">
            janelasparaalma18@gmail.com
          </a>
          . Responderemos ao seu pedido dentro dos prazos legalmente previstos.
        </p>
      </>
    ),
  },
  {
    icon: ShieldAlert,
    title: "8. Entidade de Supervisão",
    body: (
      <p>
        A autoridade de controlo da protecção de dados pessoais em Angola é a{" "}
        <strong className="text-foreground">Agência de Protecção de Dados (APD)</strong>, pessoa colectiva de
        direito público com autonomia administrativa, financeira e patrimonial (artigo 44.º da Lei n.º 22/11).
        Se considerar que o tratamento dos seus dados pessoais pelo Janelas Para a Alma viola a Lei n.º 22/11,
        tem o direito de apresentar reclamação junto da APD, com direito a recurso contencioso administrativo
        das suas decisões, nos termos do artigo 47.º da mesma lei.
      </p>
    ),
  },
  {
    icon: Lock,
    title: "9. Segurança da Informação",
    body: (
      <p>
        Nos termos do <strong className="text-foreground">artigo 30.º</strong> da Lei n.º 22/11, implementamos
        medidas técnicas e organizativas adequadas — incluindo controlo de acesso, encriptação em trânsito e
        autenticação segura — para proteger os seus dados pessoais contra acesso não autorizado, perda,
        alteração ou divulgação indevida. Para dados de saúde, aplicamos ainda as medidas especiais de
        segurança reforçada previstas no <strong className="text-foreground">artigo 31.º</strong>, incluindo a
        separação lógica dos dados de saúde dos restantes dados pessoais. Todos os colaboradores com acesso aos
        seus dados estão sujeitos a dever de sigilo profissional, mesmo após a cessação de funções, nos termos
        do <strong className="text-foreground">artigo 32.º</strong>. Nenhum sistema é absolutamente inviolável;
        caso tome conhecimento de uma utilização indevida dos seus dados, pedimos que nos contacte de imediato.
      </p>
    ),
  },
  {
    icon: Clock,
    title: "10. Conservação de Dados",
    body: (
      <p>
        Conservamos os seus dados pessoais apenas durante o período necessário às finalidades para as quais
        foram recolhidos, ou enquanto a sua conta se mantiver activa. Findo esse período — ou mediante pedido de
        eliminação — os dados são apagados ou anonimizados, salvo quando a lei exija a sua conservação por
        período superior (por exemplo, para efeitos de cumprimento de obrigações legais).
      </p>
    ),
  },
  {
    icon: Cookie,
    title: "11. Cookies",
    body: (
      <p>
        Este website utiliza cookies técnicos essenciais ao seu funcionamento e, quando aplicável, cookies
        estatísticos para compreender como a plataforma é utilizada e melhorar a experiência oferecida. Não
        utilizamos cookies para fins publicitários de terceiros. Pode gerir ou desactivar cookies nas
        preferências do seu navegador, ainda que isso possa limitar algumas funcionalidades do site.
      </p>
    ),
  },
  {
    icon: RefreshCw,
    title: "12. Alterações a Esta Política",
    body: (
      <p>
        Podemos rever e actualizar esta Política de Privacidade periodicamente, para reflectir alterações
        legais ou às nossas práticas. A data da última actualização é sempre indicada no final desta página.
        Recomendamos a sua consulta regular; alterações significativas serão comunicadas de forma visível na
        plataforma.
      </p>
    ),
  },
];

const PoliticaPrivacidade = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              Política de Privacidade
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              O nosso compromisso com a proteção dos seus dados pessoais e de saúde, nos termos da legislação
              angolana de protecção de dados.
            </p>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl shadow-lg p-4 md:p-8 space-y-10">
            {SECCOES.map((s) => {
              const Icon = s.icon;
              return (
                <section key={s.title}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <h2 className="font-semibold text-foreground text-base md:text-lg">{s.title}</h2>
                  </div>
                  <div className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed space-y-3">
                    {s.body}
                  </div>
                </section>
              );
            })}

            <section className="pt-2 border-t border-border/60">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">13. Contacto</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                Para exercer os seus direitos ou esclarecer qualquer dúvida sobre esta Política de Privacidade,
                contacte-nos em{" "}
                <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium">
                  janelasparaalma18@gmail.com
                </a>
                . Consulte também a nossa{" "}
                <a href="/faq" className="text-primary hover:underline font-medium">
                  página de Faq
                </a>{" "}
                para respostas rápidas às questões mais comuns.
              </p>
            </section>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Última atualização: Setembro de 2026. Para dúvidas legais, contacte{" "}
            <a
              href="mailto:janelasparaalma18@gmail.com"
              className="text-primary hover:underline font-medium"
            >
              janelasparaalma18@gmail.com
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PoliticaPrivacidade;

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import {
  Building2,
  FileCheck,
  MonitorSmartphone,
  Copyright,
  AlertTriangle,
  ShieldOff,
  Gavel,
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
    title: "1. Identificação e Natureza Jurídica",
    body: (
      <p>
        O <strong className="text-foreground">Janelas Para a Alma</strong> é uma iniciativa angolana de saúde
        visual e inclusão. Consoante a sua forma jurídica, enquadra-se nos critérios de dimensão para Micro,
        Pequena e Média Empresa (MPME) previstos no{" "}
        <strong className="text-foreground">artigo 5.º</strong> da{" "}
        <strong className="text-foreground">Lei n.º 30/11, de 13 de Setembro</strong>. A sua actividade de
        rastreio digital e tecnologia assistiva em saúde visual enquadra-se no código{" "}
        <strong className="text-foreground">CAE 86903 — "Outras actividades de saúde humana, n.e."</strong>{" "}
        (categoria que inclui expressamente a optometria), e, quanto ao desenvolvimento da própria plataforma
        tecnológica, no código{" "}
        <strong className="text-foreground">CAE 62010 — "Actividades de programação informática"</strong>, nos
        termos da Classificação de Actividades Económicas (CAE-Rev.2) angolana em vigor. Este website é a
        plataforma digital oficial da iniciativa.
      </p>
    ),
  },
  {
    icon: FileCheck,
    title: "2. Aceitação dos Termos",
    body: (
      <p>
        Ao aceder e utilizar este website e a plataforma associada, o utilizador reconhece que leu, compreendeu
        e aceita ficar vinculado a estes Termos de Utilização. Nos termos do{" "}
        <strong className="text-foreground">artigo 234.º do Código Civil</strong>, dada a natureza deste tipo
        de plataforma digital, o contrato considera-se concluído logo que a conduta do utilizador — designadamente
        a criação de conta, o início de um rastreio ou a utilização continuada do site — demonstre a intenção
        de aceitar estes Termos, sem necessidade de uma declaração formal de aceitação. Caso não concorde com
        algum destes termos, não deve utilizar a plataforma.
      </p>
    ),
  },
  {
    icon: MonitorSmartphone,
    title: "3. Utilização da Plataforma",
    body: (
      <>
        <p>
          A plataforma destina-se a uso pessoal e não comercial, para efeitos de rastreio digital de saúde
          visual, acesso a exercícios de terapia visual, participação na comunidade de suporte e ligação a
          clínicas parceiras. O utilizador compromete-se a:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Fornecer informação verdadeira e actualizada ao criar ou gerir a sua conta;</li>
          <li>Não utilizar a plataforma para fins ilícitos, fraudulentos ou que violem direitos de terceiros;</li>
          <li>Não tentar aceder indevidamente a sistemas, contas de outros utilizadores ou dados que não lhe pertençam;</li>
          <li>Manter a confidencialidade das suas credenciais de acesso.</li>
        </ul>
      </>
    ),
  },
  {
    icon: Copyright,
    title: "4. Propriedade Intelectual",
    body: (
      <p>
        Todos os conteúdos disponibilizados no website — textos, imagens, logótipos, código, metodologia dos
        exercícios de terapia visual e demais materiais — são propriedade do Janelas Para a Alma ou dos seus
        licenciadores. Nos termos do princípio da{" "}
        <strong className="text-foreground">liberdade contratual</strong> (artigo 405.º, n.º 1, do Código
        Civil), é concedida ao utilizador uma licença limitada, pessoal, não exclusiva e não transferível de
        utilização destes conteúdos, sendo proibida a sua reprodução, modificação, distribuição ou exploração
        comercial sem autorização prévia e expressa. Esta licença, tal como os demais termos aqui fixados, tem
        força obrigatória entre as partes e só pode ser alterada nos termos previstos nestes Termos de
        Utilização ou por mútuo consentimento, nos termos do{" "}
        <strong className="text-foreground">artigo 406.º, n.º 1, do Código Civil</strong>.
      </p>
    ),
  },
];

const TermosUtilizacao = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">
              Termos de Utilização
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              As regras que regem o acesso e a utilização da plataforma Janelas Para a Alma.
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

            {/* Aviso médico-legal — mantém em destaque visual, alinhado com o aviso já existente
                nos resultados do rastreio (ScannerResultados.tsx). */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">5. Aviso Médico-Legal</h2>
              </div>
              <div className="ml-0 md:ml-[3.25rem] flex items-start gap-3 p-4 md:p-5 rounded-2xl bg-gold/10 border border-gold/30 text-sm text-foreground">
                <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  O rastreio digital de estrabismo e os exercícios interactivos disponibilizados nesta plataforma
                  têm <strong>carácter meramente preventivo, informativo e orientador</strong>, baseando-se em
                  biometria facial e ferramentas de rastreio automatizado. Estes resultados{" "}
                  <strong>não constituem diagnóstico médico</strong> e{" "}
                  <strong>não substituem, em caso algum, uma consulta e avaliação oftalmológica presencial</strong>{" "}
                  com um profissional de saúde qualificado. Em caso de desconforto visual ou suspeita de
                  patologia ocular, procure imediatamente um especialista.
                </p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ShieldOff className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">6. Limitação de Responsabilidade e Direitos do Consumidor</h2>
              </div>
              <div className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed space-y-3">
                <p>
                  O Janelas Para a Alma envida os melhores esforços para assegurar a exactidão, disponibilidade e
                  qualidade da informação e das funcionalidades disponibilizadas, sem contudo garantir que a
                  plataforma estará sempre isenta de erros, interrupções ou indisponibilidades técnicas. Na
                  medida permitida por lei, o Janelas Para a Alma não se responsabiliza por danos indirectos
                  resultantes da utilização da plataforma, nem por decisões médicas tomadas exclusivamente com
                  base nos resultados do rastreio digital, sem confirmação profissional presencial.
                </p>
                <p>
                  Esta limitação não prejudica, nem pretende afastar, os direitos irrenunciáveis do consumidor
                  consagrados na{" "}
                  <strong className="text-foreground">Lei n.º 15/03, de 22 de Julho (Lei de Defesa do
                  Consumidor)</strong>. Nos termos dos artigos 10.º a 12.º dessa lei, o Janelas Para a Alma, como
                  fornecedor de serviços, responde independentemente de culpa por danos causados por deficiências
                  do serviço prestado, mantendo-se sempre garantidos o direito à informação clara e verdadeira
                  (artigo 9.º) e os direitos gerais do consumidor previstos no artigo 4.º — designadamente à
                  qualidade e segurança dos serviços, à protecção contra publicidade enganosa, e ao direito de
                  apresentar reclamação junto do Janelas Para a Alma ou das entidades competentes de defesa do
                  consumidor.
                </p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">7. Alterações aos Termos</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                O Janelas Para a Alma reserva-se o direito de, a qualquer momento e sem aviso prévio, alterar,
                adicionar ou eliminar, no todo ou em parte, os presentes Termos de Utilização. Recomendamos a
                consulta periódica desta página. A utilização continuada da plataforma após uma alteração
                constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Gavel className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">8. Lei Aplicável e Foro Competente</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                Estes Termos de Utilização regem-se pela lei angolana. Para a resolução de qualquer litígio
                emergente da utilização desta plataforma, é competente o foro da comarca de Luanda, com
                renúncia expressa a qualquer outro.
              </p>
            </section>

            <section className="pt-2 border-t border-border/60">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </span>
                <h2 className="font-semibold text-foreground text-base md:text-lg">9. Contacto</h2>
              </div>
              <p className="pl-13 md:pl-[3.25rem] text-muted-foreground text-[15px] leading-relaxed">
                Para qualquer questão sobre estes Termos de Utilização, contacte-nos em{" "}
                <a href="mailto:janelasparaalma18@gmail.com" className="text-primary hover:underline font-medium">
                  janelasparaalma18@gmail.com
                </a>
                . Consulte também a nossa{" "}
                <a href="/politica-de-privacidade" className="text-primary hover:underline font-medium">
                  Política de Privacidade
                </a>{" "}
                e a{" "}
                <a href="/faq" className="text-primary hover:underline font-medium">
                  página de Faq
                </a>
                .
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

export default TermosUtilizacao;

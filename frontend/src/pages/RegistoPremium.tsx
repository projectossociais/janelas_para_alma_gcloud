import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo } from "@/design/componentes/Campo";
import { CampoFicheiro } from "@/design/componentes/CampoFicheiro";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { LinhaCopiar } from "@/design/componentes/LinhaCopiar";
import { TransicaoPasso } from "@/design/componentes/Passos";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { localizar } from "@/i18n/rotas";
import {
  comprovativosApi,
  mensagemDeErroApi,
  premiumApi,
  TIPOS_DE_COMPROVATIVO_ACEITES,
} from "@/lib/apiClient";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";

/**
 * Pedir o Premium, no arquétipo Tarefa (docs/LAYOUTS.md §2.3): escolher o plano
 * → confirmar os dados → pagar por transferência e enviar o comprovativo. Não há
 * gateway: a equipa confirma o pagamento e só então o Premium é activado
 * (`PremiumService`, W-11).
 *
 * Três decisões em relação à versão anterior (5 passos, com painel de marketing):
 * - **Precisa de sessão.** A API só aprova um pedido ligado a uma conta
 *   (`PedidoSemContaError`): quem pagava sem conta ficava sem Premium. Sem sessão,
 *   a página leva primeiro a entrar ou criar conta.
 * - **Já não pergunta o perfil clínico** ("para quem é", "tem diagnóstico?"): nunca
 *   ia para a API, e é um dado de saúde que não precisamos de recolher.
 * - **Sem testemunho nem "validado por oftalmologistas":** não há como o provar.
 *
 * O comprovativo vai em três passos (como o avatar): a API assina o URL, o browser
 * envia os bytes directamente ao R2 e só depois o pedido é criado com a chave.
 * Nunca se mostra "enviado" antes de os três terminarem bem (CLAUDE.md §6).
 */

const TOTAL = 3;
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

type IdPlano = "mensal" | "anual";
type CampoDados = "nome" | "email" | "telefone";

const PLANOS: readonly {
  id: IdPlano;
  rotulo: string;
  preco: string;
  detalhe: string;
  beneficios: readonly string[];
}[] = [
  {
    id: "mensal",
    rotulo: "RegistoPremium.planoMensal",
    preco: "RegistoPremium.n15000Kz",
    detalhe: "RegistoPremium.cobrancaTodosOsMeses",
    beneficios: [
      "RegistoPremium.acessoIlimitadoA8",
      "RegistoPremium.acompanhamentoDeMetricasDe",
      "RegistoPremium.suportePrioritario",
    ],
  },
  {
    id: "anual",
    rotulo: "RegistoPremium.planoAnual",
    preco: "RegistoPremium.n150000Kz",
    detalhe: "RegistoPremium.poupe2Meses",
    beneficios: [
      "RegistoPremium.todosOsBeneficiosDo",
      "RegistoPremium.n2MesesDeOferta",
      "RegistoPremium.sessaoDeTriagemOnline",
    ],
  },
];

const RegistoPremium = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, loading: aVerSessao } = useAuth();
  const { profile } = useProfile();

  const [passo, setPasso] = useState(1);
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const [plano, setPlano] = useState<IdPlano | null>(null);
  const [dados, setDados] = useState<Record<CampoDados, string>>({ nome: "", email: "", telefone: "" });
  const [errosDados, setErrosDados] = useState<Partial<Record<CampoDados, string>>>({});
  const [comprovativo, setComprovativo] = useState<File | null>(null);
  const [erroComprovativo, setErroComprovativo] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const campos = useRef<Partial<Record<CampoDados, HTMLInputElement | null>>>({});

  // Não pedir de novo o que já sabemos (WCAG 3.3.7): pré-preenche com o perfil
  // **uma única vez** (CLAUDE.md §6: um setProfile noutro sítio nunca pode apagar
  // o que a pessoa está a escrever).
  const hidratado = useRef(false);
  useEffect(() => {
    if (hidratado.current || !profile) return;
    hidratado.current = true;
    setDados((d) => ({
      nome: d.nome || profile.nome_completo || "",
      email: d.email || profile.email || "",
      telefone: d.telefone || profile.telefone || "",
    }));
  }, [profile]);

  const ir = (n: number) => {
    setDireccao(n > passo ? 1 : -1);
    setPasso(n);
  };

  // "Sair" regressa à página de onde a pessoa veio (quase sempre /exercicios, pelo
  // botão Premium). Aberto directamente, sem histórico no site, vai para /exercicios.
  const sair = () => {
    if (location.key !== "default") navigate(-1);
    else navigate(localizar("/exercicios"));
  };

  const esquema = z.object({
    nome: z.string().trim().min(2, t("RegistoPremium.nomeMuitoCurto")).max(100),
    email: z.string().trim().email(t("RegistoPremium.emailInvalido")).max(255),
    telefone: z
      .string()
      .trim()
      .min(6, t("RegistoPremium.telefoneInvalido"))
      .max(20, t("RegistoPremium.telefoneInvalido"))
      .regex(/^[+()\d\s-]+$/, t("RegistoPremium.useApenasDigitos")),
  });

  const confirmarDados = (e: FormEvent) => {
    e.preventDefault();
    const r = esquema.safeParse(dados);
    if (r.success) {
      setErrosDados({});
      return ir(3);
    }
    const erros: Partial<Record<CampoDados, string>> = {};
    for (const problema of r.error.issues) {
      const campo = problema.path[0] as CampoDados;
      erros[campo] ??= problema.message;
    }
    setErrosDados(erros);
    // O foco vai ao primeiro campo por corrigir.
    const primeiro = (["nome", "email", "telefone"] as const).find((c) => erros[c]);
    if (primeiro) window.setTimeout(() => campos.current[primeiro]?.focus(), 0);
  };

  const enviar = async () => {
    if (!plano) return;
    if (!comprovativo) {
      setErroComprovativo(t("RegistoPremium.erroSemComprovativo"));
      return;
    }
    if (!TIPOS_DE_COMPROVATIVO_ACEITES.includes(comprovativo.type as never)) {
      setErroComprovativo(t("RegistoPremium.erroTipo"));
      return;
    }
    setErroComprovativo(null);
    setErroEnvio(null);
    setAEnviar(true);
    try {
      const preparado = await comprovativosApi.preparar(comprovativo.type);
      await comprovativosApi.enviarParaStorage(preparado.url_de_upload, comprovativo);
      await premiumApi.pedir({
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        telefone: dados.telefone.trim(),
        plano,
        comprovativo_chave: preparado.chave,
      });
      setConcluido(true);
    } catch (err) {
      console.error("Falha ao processar o pedido Premium:", err);
      setErroEnvio(mensagemDeErroApi(err, t("RegistoPremium.erroEnvioTexto")));
    } finally {
      setAEnviar(false);
    }
  };

  const planoEscolhido = PLANOS.find((p) => p.id === plano) ?? null;

  const comum = {
    tema: "claro" as const,
    sair: { rotulo: t("RegistoPremium.sair"), aoSair: sair },
    textoSaltar: t("RegistoPremium.saltar"),
  };

  // --- Sem sessão: primeiro a conta (o Premium fica ligado a ela) ---
  if (aVerSessao) {
    return (
      <LayoutTarefa {...comum} passo={{ actual: 1, total: TOTAL, rotulo: t("RegistoPremium.passo", { actual: 1, total: TOTAL }) }}>
        <p role="status" className="text-corpo text-tinta-suave">
          {t("RegistoPremium.aPreparar")}
        </p>
      </LayoutTarefa>
    );
  }
  if (!isLoggedIn) {
    const volta = encodeURIComponent("/registo-premium");
    return (
      <LayoutTarefa
        {...comum}
        passo={{ actual: 1, total: TOTAL, rotulo: t("RegistoPremium.passo", { actual: 1, total: TOTAL }) }}
        accao={
          <div className="flex flex-col gap-3">
            <Botao asChild tamanho="g" larguraTotal>
              <Link to={localizar(`/login?next=${volta}`)}>{t("RegistoPremium.gateEntrar")}</Link>
            </Botao>
            <Botao asChild tamanho="g" larguraTotal variante="secundario">
              <Link to={localizar(`/login?modo=registo&next=${volta}`)}>{t("RegistoPremium.gateCriar")}</Link>
            </Botao>
          </div>
        }
      >
        <h1 className="text-titulo-m text-tinta">{t("RegistoPremium.gateTitulo")}</h1>
        <p className="mt-3 text-corpo text-tinta-suave">{t("RegistoPremium.gateTexto")}</p>
      </LayoutTarefa>
    );
  }

  // --- Pedido enviado ---
  if (concluido) {
    return (
      <LayoutTarefa
        {...comum}
        passo={{ actual: TOTAL, total: TOTAL, rotulo: t("RegistoPremium.concluidoRotulo") }}
        accao={
          <Botao asChild tamanho="g" larguraTotal>
            <Link to={localizar("/exercicios")}>{t("RegistoPremium.verExercicios")}</Link>
          </Botao>
        }
      >
        <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-sucesso-suave text-sucesso">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="mt-5 text-titulo-m text-tinta">{t("RegistoPremium.concluidoTitulo")}</h1>
        <p className="mt-3 text-corpo text-tinta-suave">{t("RegistoPremium.concluidoTexto")}</p>
        <Aviso className="mt-6" variante="info">
          {t("RegistoPremium.concluidoPasso")}
        </Aviso>
      </LayoutTarefa>
    );
  }

  const accao =
    passo === 1 ? (
      <Botao tamanho="g" larguraTotal disabled={!plano} onClick={() => ir(2)}>
        {t("RegistoPremium.continuar")} <ArrowRight />
      </Botao>
    ) : passo === 2 ? (
      <Botao tamanho="g" larguraTotal type="submit" form="premium-dados">
        {t("RegistoPremium.continuar")} <ArrowRight />
      </Botao>
    ) : (
      <Botao tamanho="g" larguraTotal aCarregar={aEnviar} onClick={() => void enviar()}>
        {aEnviar ? t("RegistoPremium.aEnviar") : t("RegistoPremium.enviar")}
      </Botao>
    );

  const voltarAtras = (para: number) => (
    <Botao variante="fantasma" className="-ml-3 mb-4 px-3 sm:-ml-5" onClick={() => ir(para)} disabled={aEnviar}>
      <ArrowLeft /> {t("RegistoPremium.voltar")}
    </Botao>
  );

  return (
    <LayoutTarefa
      {...comum}
      passo={{ actual: passo, total: TOTAL, rotulo: t("RegistoPremium.passo", { actual: passo, total: TOTAL }) }}
      confirmarSaida={{
        titulo: t("RegistoPremium.confirmarSaidaTitulo"),
        descricao: t("RegistoPremium.confirmarSaidaTexto"),
        ficar: t("RegistoPremium.ficar"),
        sair: t("RegistoPremium.confirmarSair"),
        fechar: t("RegistoPremium.fechar"),
      }}
      accao={accao}
    >
      <TransicaoPasso chave={passo} direccao={direccao}>
        {passo === 1 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("RegistoPremium.planoTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("RegistoPremium.escolhaOPlanoQue")}</p>
            <GrupoEscolha<IdPlano>
              className="mt-8"
              legenda={t("RegistoPremium.plano")}
              legendaOculta
              opcoes={PLANOS.map((p) => ({
                valor: p.id,
                rotulo: `${t(p.rotulo)} · ${t(p.preco)}`,
                descricao: t(p.detalhe),
              }))}
              valor={plano}
              aoMudar={setPlano}
            />
            {planoEscolhido && (
              <section aria-labelledby="premium-inclui" className="mt-8">
                <h2 id="premium-inclui" className="text-legenda font-medium text-tinta-suave">
                  {t("RegistoPremium.incluiTitulo")}
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {planoEscolhido.beneficios.map((b) => (
                    <li key={b} className="flex gap-3 text-corpo text-tinta">
                      <Check className="mt-1 size-5 shrink-0 text-acento" aria-hidden />
                      {t(b)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {passo === 2 && (
          <form id="premium-dados" onSubmit={confirmarDados} noValidate>
            {voltarAtras(1)}
            <h1 className="text-titulo-m text-tinta">{t("RegistoPremium.dadosTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("RegistoPremium.dadosTexto")}</p>
            <div className="mt-8 flex flex-col gap-6">
              <Campo
                ref={(el) => void (campos.current.nome = el)}
                rotulo={t("RegistoPremium.nomeCompleto")}
                autoComplete="name"
                maxLength={100}
                value={dados.nome}
                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                erro={errosDados.nome}
              />
              <Campo
                ref={(el) => void (campos.current.email = el)}
                rotulo={t("RegistoPremium.email")}
                ajuda={t("RegistoPremium.emailAjuda")}
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={255}
                value={dados.email}
                onChange={(e) => setDados({ ...dados, email: e.target.value })}
                erro={errosDados.email}
              />
              <Campo
                ref={(el) => void (campos.current.telefone = el)}
                rotulo={t("RegistoPremium.telefoneWhatsapp")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                erro={errosDados.telefone}
              />
            </div>
          </form>
        )}

        {passo === 3 && (
          <>
            {voltarAtras(2)}
            <h1 className="text-titulo-m text-tinta">{t("RegistoPremium.pagamentoTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("RegistoPremium.pagamentoTexto")}</p>

            <dl className="mt-8 rounded-cartao border border-linha p-5">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-corpo text-tinta-suave">{planoEscolhido && t(planoEscolhido.rotulo)}</dt>
                <dd className="text-legenda text-tinta-suave">{planoEscolhido && t(planoEscolhido.detalhe)}</dd>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-linha pt-3">
                <dt className="text-corpo font-medium text-tinta">{t("RegistoPremium.totalAPagarHoje")}</dt>
                <dd className="text-titulo-p font-medium text-tinta">{planoEscolhido && t(planoEscolhido.preco)}</dd>
              </div>
            </dl>

            <section aria-labelledby="premium-banco" className="mt-8">
              <h2 id="premium-banco" className="text-legenda font-medium text-tinta-suave">
                {t("RegistoPremium.dadosBancarios")}
              </h2>
              <div className="mt-1 divide-y divide-linha">
                <LinhaCopiar
                  rotulo={t("RegistoPremium.beneficiario")}
                  valor={DEFAULT_BANK_DATA.beneficiario}
                  textos={{ copiar: t("RegistoPremium.copiar"), copiado: t("RegistoPremium.copiado") }}
                />
                <LinhaCopiar
                  rotulo={DEFAULT_BANK_DATA.pagamento_rapido.metodo}
                  valor={DEFAULT_BANK_DATA.pagamento_rapido.telefone}
                  mostrado={ofuscarValor(DEFAULT_BANK_DATA.pagamento_rapido.telefone)}
                  textos={{ copiar: t("RegistoPremium.copiar"), copiado: t("RegistoPremium.copiado") }}
                />
                <LinhaCopiar
                  rotulo={`IBAN ${DEFAULT_BANK_DATA.transferencia_nacional.banco}`}
                  valor={DEFAULT_BANK_DATA.transferencia_nacional.iban}
                  mostrado={ofuscarValor(DEFAULT_BANK_DATA.transferencia_nacional.iban)}
                  textos={{ copiar: t("RegistoPremium.copiar"), copiado: t("RegistoPremium.copiado") }}
                />
              </div>
            </section>

            <CampoFicheiro
              className="mt-8"
              rotulo={t("RegistoPremium.comprovativoRotulo")}
              ajuda={t("RegistoPremium.comprovativoAjuda")}
              erro={erroComprovativo}
              ficheiro={comprovativo}
              aoMudar={(f) => {
                setComprovativo(f);
                setErroComprovativo(null);
              }}
              tiposAceites={TIPOS_DE_COMPROVATIVO_ACEITES}
              tamanhoMaximoBytes={TAMANHO_MAXIMO_BYTES}
              textos={{
                escolher: t("RegistoPremium.escolherFicheiro"),
                trocar: t("RegistoPremium.trocarFicheiro"),
                remover: (nome) => t("RegistoPremium.removerFicheiro", { nome }),
                erroTipo: t("RegistoPremium.erroTipo"),
                erroTamanho: t("RegistoPremium.erroTamanho"),
                tamanho: (kb) => t("RegistoPremium.tamanhoKb", { kb }),
              }}
            />

            {erroEnvio && (
              <Aviso className="mt-6" variante="erro" anunciar titulo={t("RegistoPremium.erroEnvioTitulo")}>
                {erroEnvio}
              </Aviso>
            )}

            <p className="mt-8 flex items-center gap-2 text-legenda text-tinta-suave">
              <Clock className="size-4 shrink-0 text-accao" aria-hidden />
              {t("RegistoPremium.garantia")}
            </p>
          </>
        )}
      </TransicaoPasso>
    </LayoutTarefa>
  );
};

export default RegistoPremium;

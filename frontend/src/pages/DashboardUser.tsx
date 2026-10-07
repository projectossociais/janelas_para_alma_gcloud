import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, ChevronRight, Dumbbell, Home, ScanFace, Settings, TrendingUp, User } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import PremiumRequestBanner from "@/components/PremiumRequestBanner";
import { LigacaoRouter } from "@/components/site/LigacaoRouter";
import { useAcessoExercicios } from "@/contexts/AcessoExerciciosContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Botao } from "@/design/componentes/Botao";
import { Cartao, CartaoLigacao, CartaoTexto, CartaoTitulo } from "@/design/componentes/Cartao";
import { MenuConta } from "@/design/componentes/MenuConta";
import { LayoutApp } from "@/design/layouts/LayoutApp";
import { ProvedorLigacao } from "@/design/Ligacao";
import { Simbolo } from "@/design/marca/Simbolo";
import { formatarData, formatarDataHora } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import {
  agendamentosApi,
  linkDaSalaVideo,
  screeningsApi,
  type ProximaTeleconsulta,
  type ScreeningPublica,
} from "@/lib/apiClient";
import { proximoPasso, type ProximoPasso } from "@/lib/painel/proximoPasso";

/**
 * O painel de quem tem conta, no arquétipo App (docs/LAYOUTS.md §2.4): voltar
 * todos os dias e saber logo o que fazer. No topo, **um** próximo passo
 * (`proximoPasso`, por ordem de importância); por baixo, o resumo real (rastreios,
 * o último resultado, exercícios abertos) e os atalhos.
 *
 * Tudo o que se mostra vem da API: se uma chamada falha, esse número aparece como
 * "—" (nunca um 0 inventado) e o próximo passo não afirma o que não sabe.
 */

const ROTULO_RESULTADO: Record<string, string> = {
  requer_avaliacao: "ResultadoRastreio.rotuloAvaliacao",
  normal: "ResultadoRastreio.rotuloNormal",
  inconclusivo: "ResultadoRastreio.rotuloInconclusivo",
};

const TOTAL_EXERCICIOS = 8;

const DashboardUser = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { profile } = useProfile();
  const { acesso } = useAcessoExercicios();

  const [historico, setHistorico] = useState<ScreeningPublica[] | null>(null);
  const [historicoFalhou, setHistoricoFalhou] = useState(false);
  const [teleconsulta, setTeleconsulta] = useState<ProximaTeleconsulta | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!user) return;
    let activo = true;
    void Promise.all([
      screeningsApi.listarMinhas().then(
        (h) => ({ h }),
        () => ({ h: null }),
      ),
      agendamentosApi.minhaProximaTeleconsulta().catch(() => null),
    ]).then(([{ h }, tele]) => {
      if (!activo) return;
      setHistorico(h);
      setHistoricoFalhou(h === null);
      setTeleconsulta(tele);
      setCarregado(true);
    });
    return () => {
      activo = false;
    };
  }, [user]);

  const nome = profile?.nome_completo || user?.name || "";
  const primeiroNome = nome.split(" ")[0];
  const ultimo = historico?.[0] ?? null;
  const exerciciosDisponiveis = acesso.exercicios_desbloqueados.length;

  const passo: ProximoPasso = proximoPasso({
    temTeleconsulta: !!teleconsulta,
    ultimoRastreio: ultimo ? { id: ultimo.id, diagnostico: ultimo.diagnostico } : null,
    exerciciosDisponiveis,
    estadoAcesso: acesso.estado,
  });

  const destinos = [
    { rotulo: t("PainelApp.inicio"), href: localizar("/dashboard"), icone: <Home />, activo: true },
    { rotulo: t("PainelApp.rastreio"), href: localizar("/scanner"), icone: <ScanFace /> },
    { rotulo: t("PainelApp.treinos"), href: localizar("/exercicios"), icone: <Dumbbell /> },
    { rotulo: t("PainelApp.progresso"), href: localizar("/exercicios/progresso"), icone: <TrendingUp /> },
  ];

  const accaoDoPasso = (): ReactNode => {
    const ir = (para: string, texto: string) => (
      <Botao asChild tamanho="g">
        <Link to={localizar(para)}>{texto}</Link>
      </Botao>
    );
    switch (passo.tipo) {
      case "teleconsulta":
        return (
          <Botao asChild tamanho="g">
            <a href={linkDaSalaVideo(teleconsulta!.sala_video)} target="_blank" rel="noopener noreferrer">
              {t("PainelApp.entrarNaSala")}
            </a>
          </Botao>
        );
      case "marcar-consulta":
        return ir(`/marcar-consulta?rastreio=${encodeURIComponent(passo.rastreioId)}`, t("PainelApp.marcarConsulta"));
      case "primeiro-rastreio":
        return ir("/scanner", t("PainelApp.fazerRastreio"));
      case "repetir-rastreio":
        return ir("/scanner", t("PainelApp.repetirRastreio"));
      case "treinar":
        return ir("/exercicios", t("PainelApp.verTreinos"));
      case "teste-7-dias":
        return ir("/teste-de-7-dias", t("PainelApp.comecarTeste"));
      case "premium":
        return ir("/registo-premium", t("PainelApp.verPremium"));
    }
  };

  const textoDoPasso = (): { titulo: string; texto: ReactNode } => {
    switch (passo.tipo) {
      case "teleconsulta":
        return {
          titulo: t("PainelApp.passoTeleconsultaTitulo"),
          texto: `${formatarDataHora(teleconsulta!.horario_inicio)} · ${teleconsulta!.clinica_nome}`,
        };
      case "marcar-consulta":
        return { titulo: t("PainelApp.passoMarcarTitulo"), texto: t("PainelApp.passoMarcarTexto") };
      case "primeiro-rastreio":
        return { titulo: t("PainelApp.passoRastreioTitulo"), texto: t("PainelApp.passoRastreioTexto") };
      case "repetir-rastreio":
        return { titulo: t("PainelApp.passoRepetirTitulo"), texto: t("PainelApp.passoRepetirTexto") };
      case "treinar":
        return { titulo: t("PainelApp.passoTreinarTitulo"), texto: t("PainelApp.passoTreinarTexto") };
      case "teste-7-dias":
        return { titulo: t("PainelApp.passoTesteTitulo"), texto: t("PainelApp.passoTesteTexto") };
      case "premium":
        return { titulo: t("PainelApp.passoPremiumTitulo"), texto: t("PainelApp.passoPremiumTexto") };
    }
  };

  const factos: { rotulo: string; valor: ReactNode }[] = [
    {
      rotulo: t("PainelApp.rastreiosFeitos"),
      valor: historicoFalhou ? "—" : (historico?.length ?? "—"),
    },
    {
      rotulo: t("PainelApp.ultimoRastreio"),
      valor: ultimo ? (
        <>
          {formatarData(ultimo.criado_em)}
          <span className="mt-1 block text-corpo font-normal text-tinta-suave">
            {ROTULO_RESULTADO[ultimo.diagnostico] ? t(ROTULO_RESULTADO[ultimo.diagnostico]!) : ""}
          </span>
        </>
      ) : (
        "—"
      ),
    },
    {
      rotulo: t("PainelApp.exerciciosAbertos"),
      valor: t("PainelApp.exerciciosDe", { abertos: exerciciosDisponiveis, total: TOTAL_EXERCICIOS }),
    },
  ];

  const atalhos = [
    { icone: <ScanFace />, titulo: t("PainelApp.atalhoRastreio"), texto: t("PainelApp.atalhoRastreioTexto"), href: "/scanner" },
    { icone: <Dumbbell />, titulo: t("PainelApp.atalhoTreinos"), texto: t("PainelApp.atalhoTreinosTexto"), href: "/exercicios" },
    { icone: <Activity />, titulo: t("PainelApp.atalhoProgresso"), texto: t("PainelApp.atalhoProgressoTexto"), href: "/exercicios/progresso" },
  ];

  const { titulo, texto } = carregado ? textoDoPasso() : { titulo: "", texto: "" };

  return (
    <ProvedorLigacao componente={LigacaoRouter}>
      <LayoutApp
        destinos={destinos}
        rotuloNavegacao={t("PainelApp.navegacao")}
        simbolo={<Simbolo fundo="claro" />}
        saudacao={primeiroNome ? t("DashboardUser.saudacao", { nome: primeiroNome }) : t("DashboardUser.saudacaoSemNome")}
        subtitulo={t("DashboardUser.oSeuEspacoDe")}
        conta={
          <>
            <NotificationBell claro={false} />
            <MenuConta
              nome={nome}
              avatarUrl={profile?.avatar_url || user?.avatarUrl}
              rotulo={t("PainelApp.contaDe", { nome: nome || t("PainelApp.contaSemNome") })}
              itens={[
                { rotulo: t("Navbar.editarPerfil"), href: localizar("/editar-perfil"), icone: <User /> },
                { rotulo: t("Navbar.configuracoes"), href: localizar("/configuracoes"), icone: <Settings /> },
              ]}
              sair={{
                rotulo: t("Navbar.sair"),
                aoSair: () => {
                  logout();
                  navigate(localizar("/"));
                },
              }}
            />
          </>
        }
        textoSaltar={t("PainelApp.saltar")}
      >
        <div className="flex flex-col gap-8">
          <PremiumRequestBanner />

          <section aria-labelledby="proximo-passo">
            <Cartao className="border-0 bg-accao-suave p-6 sm:p-8">
              <h2 id="proximo-passo" className="text-legenda font-medium uppercase tracking-wide text-tinta-suave">
                {t("PainelApp.proximoPasso")}
              </h2>
              {carregado ? (
                <>
                  <p className="mt-3 text-titulo-m text-tinta">{titulo}</p>
                  <p className="mt-2 max-w-prose text-corpo text-tinta-suave">{texto}</p>
                  <div className="mt-6">{accaoDoPasso()}</div>
                </>
              ) : (
                <p role="status" className="mt-3 text-corpo text-tinta-suave">
                  {t("PainelApp.aPreparar")}
                </p>
              )}
            </Cartao>
          </section>

          <section aria-labelledby="resumo">
            <h2 id="resumo" className="sr-only">
              {t("PainelApp.resumo")}
            </h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              {factos.map((f) => (
                // Telemóvel: uma linha (nome à esquerda, valor à direita); a partir do tablet, um cartão.
                <Cartao key={f.rotulo} className="flex items-baseline justify-between gap-4 p-4 sm:block sm:p-5">
                  <dt className="text-legenda text-tinta-suave">{f.rotulo}</dt>
                  <dd className="text-right text-titulo-p text-tinta sm:mt-2 sm:text-left">{f.valor}</dd>
                </Cartao>
              ))}
            </dl>
          </section>

          <section aria-labelledby="atalhos">
            <h2 id="atalhos" className="text-titulo-p text-tinta">
              {t("PainelApp.atalhos")}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {atalhos.map((a) => (
                <li key={a.href}>
                  <Cartao interactivo className="h-full">
                    <span aria-hidden className="flex size-10 items-center justify-center rounded-pilula bg-superficie-alt text-accao [&_svg]:size-5">
                      {a.icone}
                    </span>
                    <CartaoTitulo como="h3" className="mt-4 flex items-center justify-between gap-2">
                      <CartaoLigacao asChild>
                        <Link to={localizar(a.href)}>{a.titulo}</Link>
                      </CartaoLigacao>
                      <ChevronRight className="size-5 shrink-0 text-tinta-suave" aria-hidden />
                    </CartaoTitulo>
                    <CartaoTexto>{a.texto}</CartaoTexto>
                  </Cartao>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </LayoutApp>
    </ProvedorLigacao>
  );
};

export default DashboardUser;

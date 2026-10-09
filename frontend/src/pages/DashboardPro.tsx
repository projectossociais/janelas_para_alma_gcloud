import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, Clock, Crown, LogOut, Mail, MapPinned, Phone, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ConfirmarAccao } from "@/components/admin/ConfirmarAccao";
import RequireClinica from "@/components/admin/RequireClinica";
import { useDadosAdmin } from "@/components/admin/useDadosAdmin";
import { EstadoDadosAdmin } from "@/components/admin/DadosAdmin";
import { LigacaoRouter } from "@/components/site/LigacaoRouter";
import { useAuth } from "@/contexts/AuthContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo, CampoTexto } from "@/design/componentes/Campo";
import { Seleccao } from "@/design/componentes/Seleccao";
import { Estado } from "@/design/componentes/Tabela";
import { Ligacao, ProvedorLigacao } from "@/design/Ligacao";
import { estiloAccaoConsola } from "@/design/layouts/estiloConsola";
import { CabecalhoConsola, LayoutConsola } from "@/design/layouts/LayoutConsola";
import { Simbolo } from "@/design/marca/Simbolo";
import { localizar } from "@/i18n/rotas";
import {
  clinicasApi,
  mensagemDeErroApi,
  linkDaSalaVideo,
  type AgendamentoClinicoAdmin,
  type ClinicaParceiraAdmin,
  type TeleconsultaPublica,
} from "@/lib/apiClient";
import { formatarDiaLongo, formatarHora } from "@/lib/marcacao/horarios";

const DIAS_SEMANA_CHAVES = [
  "DashboardPro.segunda",
  "DashboardPro.terca",
  "DashboardPro.quarta",
  "DashboardPro.quinta",
  "DashboardPro.sexta",
  "DashboardPro.sabado",
  "DashboardPro.domingo",
] as const;

const TOM_ESTADO: Record<string, "aviso" | "sucesso" | "erro" | "neutro"> = {
  pendente: "aviso",
  confirmada: "sucesso",
  recusada: "erro",
};

/** Uma consulta é "próxima" se ainda não passou (os pedidos antigos sem hora contam como próximos). */
const aindaNaoPassou = (a: AgendamentoClinicoAdmin, agora: number) =>
  !a.horario_inicio || Date.parse(a.horario_inicio) >= agora;

const ControloTeleconsulta = ({ agendamentoId }: { agendamentoId: string }) => {
  const { t } = useTranslation();
  const [teleconsulta, setTeleconsulta] = useState<TeleconsultaPublica | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [recomendacao, setRecomendacao] = useState("");
  const [tentouConcluir, setTentouConcluir] = useState(false);
  const [erroAccao, setErroAccao] = useState<string | null>(null);
  const [aProcessar, setAProcessar] = useState(false);

  useEffect(() => {
    clinicasApi
      .obterTeleconsulta(agendamentoId)
      .then(setTeleconsulta)
      .catch((err) => setErroCarregar(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelCarregarTeleconsulta"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentoId]);

  const iniciar = async () => {
    setAProcessar(true);
    setErroAccao(null);
    try {
      setTeleconsulta(await clinicasApi.iniciarTeleconsulta(agendamentoId));
    } catch (err) {
      setErroAccao(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelIniciarTeleconsulta")));
    } finally {
      setAProcessar(false);
    }
  };

  const concluir = async (e: FormEvent) => {
    e.preventDefault();
    setTentouConcluir(true);
    setErroAccao(null);
    if (!recomendacao.trim()) return;
    setAProcessar(true);
    try {
      setTeleconsulta(await clinicasApi.concluirTeleconsulta(agendamentoId, recomendacao.trim()));
      toast.success(t("DashboardPro.teleconsultaConcluida"));
    } catch (err) {
      setErroAccao(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelConcluirTeleconsulta")));
    } finally {
      setAProcessar(false);
    }
  };

  if (erroCarregar)
    return (
      <Aviso variante="erro" className="mt-3">
        {erroCarregar}
      </Aviso>
    );
  if (!teleconsulta) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-linha pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Botao asChild variante="secundario">
          <a href={linkDaSalaVideo(teleconsulta.sala_video)} target="_blank" rel="noopener noreferrer">
            <Video aria-hidden />
            {t("DashboardPro.entrarNaSala")}
          </a>
        </Botao>
        <Estado tom={teleconsulta.estado === "concluida" ? "sucesso" : teleconsulta.estado === "em_curso" ? "info" : "neutro"}>
          {t(`DashboardPro.teleconsultaEstado.${teleconsulta.estado}`)}
        </Estado>
        {teleconsulta.estado === "agendada" && (
          <Botao aCarregar={aProcessar} onClick={() => void iniciar()}>
            {t("DashboardPro.iniciarConsulta")}
          </Botao>
        )}
      </div>
      {teleconsulta.estado === "em_curso" && (
        <form onSubmit={(e) => void concluir(e)} noValidate className="space-y-3">
          <CampoTexto
            rotulo={t("DashboardPro.recomendacao")}
            placeholder={t("DashboardPro.recomendacaoClinicaPlaceholder")}
            rows={3}
            value={recomendacao}
            erro={tentouConcluir && !recomendacao.trim() ? t("DashboardPro.indiqueUmaRecomendacao") : undefined}
            onChange={(e) => setRecomendacao(e.target.value)}
          />
          <Botao type="submit" aCarregar={aProcessar}>
            {t("DashboardPro.concluirEEnviarRecomendacao")}
          </Botao>
        </form>
      )}
      {teleconsulta.estado === "concluida" && teleconsulta.recomendacao_clinica && (
        <p className="text-corpo text-tinta-suave">
          <span className="font-medium text-tinta">{t("DashboardPro.recomendacao")}:</span> {teleconsulta.recomendacao_clinica}
        </p>
      )}
      {erroAccao && (
        <Aviso variante="erro" anunciar>
          {erroAccao}
        </Aviso>
      )}
    </div>
  );
};

/** Um pedido de consulta: quem, quando (hora de Luanda), como, e a teleconsulta se for online. */
const Consulta = ({ a }: { a: AgendamentoClinicoAdmin }) => {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language;
  const quando = a.horario_inicio
    ? t("DashboardPro.quandoHora", {
        dia: formatarDiaLongo(a.horario_inicio, idioma),
        hora: formatarHora(a.horario_inicio, idioma),
      })
    : a.data_preferida
      ? t("DashboardPro.quandoPreferencia", { dia: a.data_preferida, periodo: a.periodo_preferido ?? "" })
      : "—";
  return (
    <li className="rounded-cartao border border-linha bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{a.nome}</span>
        <Estado tom={TOM_ESTADO[a.estado] ?? "neutro"}>{t(`DashboardPro.estado.${a.estado}`, { defaultValue: a.estado })}</Estado>
        {a.premium && (
          <Estado tom="info">
            <Crown className="mr-1 size-3.5" aria-hidden />
            {t("DashboardPro.premium")}
          </Estado>
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-corpo text-tinta">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4 text-tinta-suave" aria-hidden />
          {quando}
        </span>
        <span className="inline-flex items-center gap-1.5 text-tinta-suave">
          {a.modalidade === "online" ? <Video className="size-4" aria-hidden /> : <MapPinned className="size-4" aria-hidden />}
          {a.modalidade === "online" ? t("DashboardPro.online") : t("DashboardPro.presencial")}
        </span>
      </p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-legenda text-tinta-suave">
        <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
          <Mail className="size-3.5" aria-hidden />
          {a.email}
        </a>
        <a href={`tel:${a.telefone}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
          <Phone className="size-3.5" aria-hidden />
          {a.telefone}
        </a>
      </p>
      {a.motivo && <p className="mt-2 whitespace-pre-wrap text-corpo text-tinta-suave">{a.motivo}</p>}
      {a.modalidade === "online" && a.estado === "confirmada" && <ControloTeleconsulta agendamentoId={a.id} />}
    </li>
  );
};

const Grupo = ({ titulo, ajuda, vazio, lista }: { titulo: string; ajuda?: string; vazio?: string; lista: AgendamentoClinicoAdmin[] }) => {
  if (!lista.length && !vazio) return null;
  return (
    <section className="mt-6">
      <h3 className="text-corpo font-medium text-tinta">
        {titulo} ({lista.length})
      </h3>
      {ajuda && <p className="text-legenda text-tinta-suave">{ajuda}</p>}
      {lista.length ? (
        <ul className="mt-3 space-y-3">
          {lista.map((a) => (
            <Consulta key={a.id} a={a} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-tinta-suave">{vazio}</p>
      )}
    </section>
  );
};

const Metrica = ({ icone, valor, rotulo }: { icone: ReactNode; valor: string; rotulo: string }) => (
  <div className="rounded-cartao border border-linha bg-superficie p-4">
    <span aria-hidden className="text-tinta-suave [&_svg]:size-5">
      {icone}
    </span>
    <span className="mt-2 block text-titulo-p font-medium tabular-nums text-tinta">{valor}</span>
    <span className="mt-0.5 block text-legenda text-tinta-suave">{rotulo}</span>
  </div>
);

interface NovaJanela {
  diaSemana: string;
  horaInicio: string;
  horaFim: string;
  modalidade: "presencial" | "online";
}

const NOVA_JANELA_VAZIA: NovaJanela = { diaSemana: "0", horaInicio: "08:00", horaFim: "12:00", modalidade: "presencial" };

const ConteudoDashboardPro = ({ clinica }: { clinica: ClinicaParceiraAdmin }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const agendamentos = useDadosAdmin(() => clinicasApi.meusAgendamentos(), t("DashboardPro.naoFoiPossivelCarregar"), []);
  const disponibilidade = useDadosAdmin(
    () => clinicasApi.minhaDisponibilidade(),
    t("DashboardPro.naoFoiPossivelCarregarDisponibilidade"),
    [],
  );
  const [novaJanela, setNovaJanela] = useState(NOVA_JANELA_VAZIA);
  const [aGuardarJanela, setAGuardarJanela] = useState(false);
  const [erroJanela, setErroJanela] = useState<string | null>(null);
  const textosConfirmar = { cancelar: t("DashboardPro.cancelar"), fechar: t("DashboardPro.fechar") };

  // "08:00" < "12:00" compara bem como texto (sempre HH:MM).
  const fimAntesDoInicio = novaJanela.horaFim <= novaJanela.horaInicio;

  const adicionarJanela = async (e: FormEvent) => {
    e.preventDefault();
    setErroJanela(null);
    if (fimAntesDoInicio) return;
    setAGuardarJanela(true);
    try {
      const criada = await clinicasApi.adicionarDisponibilidade({
        dia_semana: Number(novaJanela.diaSemana),
        hora_inicio: `${novaJanela.horaInicio}:00`,
        hora_fim: `${novaJanela.horaFim}:00`,
        modalidade: novaJanela.modalidade,
      });
      disponibilidade.setDados((atual) => [...(atual ?? []), criada]);
      toast.success(t("DashboardPro.disponibilidadeAdicionada"));
    } catch (err) {
      setErroJanela(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelGuardarDisponibilidade")));
    } finally {
      setAGuardarJanela(false);
    }
  };

  const removerJanela = async (id: string) => {
    try {
      await clinicasApi.removerDisponibilidade(id);
      disponibilidade.setDados((atual) => (atual ?? []).filter((j) => j.id !== id));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelRemoverDisponibilidade")));
    }
  };

  const agora = Date.now();
  const lista = agendamentos.dados ?? [];
  const porHora = (x: AgendamentoClinicoAdmin, y: AgendamentoClinicoAdmin) =>
    (x.horario_inicio ? Date.parse(x.horario_inicio) : Infinity) - (y.horario_inicio ? Date.parse(y.horario_inicio) : Infinity);
  const proximas = lista.filter((a) => a.estado === "confirmada" && aindaNaoPassou(a, agora)).sort(porHora);
  const porConfirmar = lista.filter((a) => a.estado === "pendente").sort(porHora);
  const anteriores = lista.filter((a) => (a.estado === "confirmada" && !aindaNaoPassou(a, agora)) || a.estado === "recusada");
  // Teleconsultas marcadas: online, confirmadas e ainda por acontecer (antes contava todas as confirmadas).
  const teleconsultasMarcadas = proximas.filter((a) => a.modalidade === "online").length;
  const n = (v: number) => (agendamentos.dados ? String(v) : "—");

  const janelas = [...(disponibilidade.dados ?? [])].sort(
    (x, y) => x.dia_semana - y.dia_semana || x.hora_inicio.localeCompare(y.hora_inicio),
  );

  return (
    <ProvedorLigacao componente={LigacaoRouter}>
      <LayoutConsola
        nome={clinica.nome}
        simbolo={<Simbolo fundo="claro" />}
        rotuloNavegacao={t("DashboardPro.navegacao")}
        textoSaltar={t("DashboardPro.saltar")}
        textosMenu={{ abrir: t("DashboardPro.menu"), fechar: t("DashboardPro.fecharMenu") }}
        grupos={[
          {
            destinos: [
              { rotulo: t("DashboardPro.pedidosDeConsulta"), href: "#consultas", icone: <CalendarClock /> },
              { rotulo: t("DashboardPro.disponibilidadeSemanal"), href: "#horarios", icone: <Clock /> },
            ],
          },
        ]}
        rodapeNavegacao={
          <>
            <Ligacao href={localizar("/")} className={estiloAccaoConsola}>
              <ArrowLeft aria-hidden />
              {t("DashboardPro.voltarAoSite")}
            </Ligacao>
            <button
              type="button"
              className={`${estiloAccaoConsola} w-full`}
              onClick={() => {
                logout();
                navigate(localizar("/"));
              }}
            >
              <LogOut aria-hidden />
              {t("DashboardPro.terminarSessao")}
            </button>
          </>
        }
      >
        <CabecalhoConsola
          titulo={t("DashboardPro.areaClinica")}
          descricao={t("DashboardPro.bemVindo", { nome: user?.name || "", clinica: clinica.nome })}
        />

        <div className="grid grid-cols-2 gap-3 md:max-w-xl">
          <Metrica icone={<Clock />} valor={n(porConfirmar.length)} rotulo={t("DashboardPro.pedidosPorConfirmar")} />
          <Metrica icone={<Video />} valor={n(teleconsultasMarcadas)} rotulo={t("DashboardPro.teleconsultasAgendadas")} />
        </div>

        <section id="consultas" aria-labelledby="pro-consultas" className="mt-10 scroll-mt-20">
          <h2 id="pro-consultas" className="text-titulo-p text-tinta">
            {t("DashboardPro.pedidosDeConsulta")}
          </h2>
          <div className="mt-2">
            <EstadoDadosAdmin
              aCarregar={agendamentos.aCarregar}
              erro={agendamentos.erro}
              aoTentarDeNovo={() => void agendamentos.recarregar()}
              temDados={!!agendamentos.dados}
            >
              {lista.length ? (
                <>
                  <Grupo titulo={t("DashboardPro.proximasConsultas")} lista={proximas} vazio={t("DashboardPro.semProximas")} />
                  <Grupo titulo={t("DashboardPro.porConfirmar")} ajuda={t("DashboardPro.porConfirmarAjuda")} lista={porConfirmar} />
                  <Grupo titulo={t("DashboardPro.anteriores")} lista={anteriores} />
                </>
              ) : (
                <p className="text-tinta-suave">{t("DashboardPro.aindaSemPedidos")}</p>
              )}
            </EstadoDadosAdmin>
          </div>
        </section>

        <section id="horarios" aria-labelledby="pro-horarios" className="mt-12 scroll-mt-20">
          <h2 id="pro-horarios" className="text-titulo-p text-tinta">
            {t("DashboardPro.disponibilidadeSemanal")}
          </h2>
          <p className="text-legenda text-tinta-suave">{t("DashboardPro.horasDeLuanda")}</p>
          <div className="mt-3">
            <EstadoDadosAdmin
              aCarregar={disponibilidade.aCarregar}
              erro={disponibilidade.erro}
              aoTentarDeNovo={() => void disponibilidade.recarregar()}
              temDados={!!disponibilidade.dados}
            >
              {janelas.length ? (
                <ul className="divide-y divide-linha rounded-cartao border border-linha bg-superficie md:max-w-xl">
                  {janelas.map((j) => {
                    const dia = t(DIAS_SEMANA_CHAVES[j.dia_semana]);
                    const inicio = j.hora_inicio.slice(0, 5);
                    const fim = j.hora_fim.slice(0, 5);
                    const modalidade = j.modalidade === "online" ? t("DashboardPro.online") : t("DashboardPro.presencial");
                    return (
                      <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="w-32 font-medium">{dia}</span>
                          <span className="tabular-nums">
                            {inicio} — {fim}
                          </span>
                          <Estado>{modalidade}</Estado>
                        </span>
                        <ConfirmarAccao
                          soIcone
                          icone={<Trash2 aria-hidden />}
                          rotulo={t("DashboardPro.removerHorario", { dia, inicio, fim, modalidade })}
                          titulo={t("DashboardPro.removerHorarioTitulo")}
                          descricao={t("DashboardPro.removerHorarioTexto")}
                          confirmar={t("DashboardPro.remover")}
                          textos={textosConfirmar}
                          aoConfirmar={() => void removerJanela(j.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-tinta-suave">{t("DashboardPro.aindaSemDisponibilidade")}</p>
              )}
            </EstadoDadosAdmin>
          </div>

          <form
            onSubmit={(e) => void adicionarJanela(e)}
            noValidate
            className="mt-6 space-y-4 rounded-cartao border border-linha bg-superficie p-5 md:max-w-3xl"
          >
            <h3 className="text-corpo font-medium text-tinta">{t("DashboardPro.adicionarHorario")}</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <Seleccao
                rotulo={t("DashboardPro.diaDaSemana")}
                marcador={t("DashboardPro.escolher")}
                value={novaJanela.diaSemana}
                onChange={(e) => setNovaJanela((p) => ({ ...p, diaSemana: e.target.value }))}
                opcoes={DIAS_SEMANA_CHAVES.map((chave, i) => ({ valor: String(i), rotulo: t(chave) }))}
              />
              <Campo
                rotulo={t("DashboardPro.horaInicio")}
                type="time"
                value={novaJanela.horaInicio}
                onChange={(e) => setNovaJanela((p) => ({ ...p, horaInicio: e.target.value }))}
              />
              <Campo
                rotulo={t("DashboardPro.horaFim")}
                type="time"
                value={novaJanela.horaFim}
                erro={fimAntesDoInicio ? t("DashboardPro.fimDepoisDoInicio") : undefined}
                onChange={(e) => setNovaJanela((p) => ({ ...p, horaFim: e.target.value }))}
              />
              <Seleccao
                rotulo={t("DashboardPro.modalidade")}
                marcador={t("DashboardPro.escolher")}
                value={novaJanela.modalidade}
                onChange={(e) => setNovaJanela((p) => ({ ...p, modalidade: e.target.value as "presencial" | "online" }))}
                opcoes={[
                  { valor: "presencial", rotulo: t("DashboardPro.presencial") },
                  { valor: "online", rotulo: t("DashboardPro.online") },
                ]}
              />
            </div>
            {erroJanela && (
              <Aviso variante="erro" anunciar>
                {erroJanela}
              </Aviso>
            )}
            <Botao type="submit" aCarregar={aGuardarJanela} disabled={fimAntesDoInicio}>
              <Plus aria-hidden />
              {t("DashboardPro.adicionarHorario")}
            </Botao>
          </form>
        </section>

        <Aviso className="mt-12 md:max-w-3xl" titulo={t("DashboardPro.emBreve")}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("DashboardPro.listaDePacientesQue")}</li>
            <li>{t("DashboardPro.visualizacaoDeRelatoriosDo")}</li>
          </ul>
        </Aviso>
      </LayoutConsola>
    </ProvedorLigacao>
  );
};

const DashboardPro = () => (
  <RequireClinica>{(clinica) => <ConteudoDashboardPro clinica={clinica} />}</RequireClinica>
);

export default DashboardPro;

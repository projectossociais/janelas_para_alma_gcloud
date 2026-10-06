import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarCheck, House, MapPin, Phone, RefreshCw, Send, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo, CampoTexto } from "@/design/componentes/Campo";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { TransicaoPasso } from "@/design/componentes/Passos";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { optioptika } from "@/data/optioptika";
import { localizar } from "@/i18n/rotas";
import { agendamentosApi, type AgendamentoClinicoPublico, type HorarioDisponivel } from "@/lib/apiClient";
import {
  MAX_MOTIVO,
  MAX_NOME,
  ORDEM_CAMPOS,
  validarContacto,
  type CampoContacto,
  type DadosContacto,
  type ErrosContacto,
} from "@/lib/marcacao/dados";
import { agruparPorDia, formatarDiaCurto, formatarDiaLongo, formatarHora } from "@/lib/marcacao/horarios";

/**
 * Marcar consulta, no arquétipo Tarefa (docs/PESQUISA_UX.md §4.2): como →
 * quando → os seus dados → confirmar → enviado.
 *
 * Substitui o diálogo antigo (`OptioptikaBookingDialog`), onde uma falha de
 * rede nos horários aparecia como "sem horários", uma falha a carregar a
 * clínica aparecia como "verifique os campos", e o título dizia "consulta
 * confirmada" quando a clínica ainda não tinha confirmado nada.
 *
 * Os horários vêm só de `GET /clinicas/{id}/horarios` (nunca texto livre) e
 * mostram-se sempre na hora de Luanda. Chegando do resultado de um rastreio
 * (`?rastreio=<id>`), o pedido fica ligado a ele; a clínica não recebe os
 * resultados.
 */

type Modalidade = "presencial" | "online";
type EstadoHorarios = "a-carregar" | "erro" | "pronto";
type ErroEnvio = null | "rede" | "ocupado";

const TOTAL = 4;
const TELEFONE_CLINICA = optioptika.phone;

const MarcarConsulta = () => {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const { profile } = useProfile();

  const [passo, setPasso] = useState(1);
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const [modalidade, setModalidade] = useState<Modalidade | null>(null);
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([]);
  const [estadoHorarios, setEstadoHorarios] = useState<EstadoHorarios>("a-carregar");
  const [dia, setDia] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosContacto>({ nome: "", email: "", telefone: "", motivo: "" });
  const [erros, setErros] = useState<ErrosContacto>({});
  const [aEnviar, setAEnviar] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<ErroEnvio>(null);
  const [enviado, setEnviado] = useState<AgendamentoClinicoPublico | null>(null);
  const campos = useRef<Partial<Record<CampoContacto, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  // Pré-preenche com o perfil **uma única vez** (CLAUDE.md §6: um setProfile
  // noutro sítio nunca pode apagar o que a pessoa está a escrever).
  const hidratado = useRef(false);
  useEffect(() => {
    if (hidratado.current || !profile) return;
    hidratado.current = true;
    setDados((d) => ({
      ...d,
      nome: d.nome || profile.nome_completo || "",
      email: d.email || profile.email || "",
      telefone: d.telefone || profile.telefone || "",
    }));
  }, [profile]);

  const ir = (n: number) => {
    setDireccao(n > passo ? 1 : -1);
    setPasso(n);
  };

  const carregarHorarios = useCallback(async (m: Modalidade) => {
    setEstadoHorarios("a-carregar");
    try {
      let id = clinicaId;
      if (!id) {
        // Por agora há uma clínica parceira (a Optioptika); o id vem da API.
        id = (await agendamentosApi.listarClinicas())[0]?.id ?? null;
        if (!id) {
          // Nenhuma clínica activa não é uma falha: é não haver horários. Diz-se
          // isso, com o telefone da clínica (bug real: aparecia "não foi possível").
          setHorarios([]);
          setEstadoHorarios("pronto");
          return;
        }
        setClinicaId(id);
      }
      const lista = await agendamentosApi.horariosDisponiveis(id, m);
      setHorarios(lista);
      const primeiro = agruparPorDia(lista)[0]?.chave ?? null;
      setDia((actual) => (actual && agruparPorDia(lista).some((d) => d.chave === actual) ? actual : primeiro));
      setHorario((actual) => (actual && lista.some((h) => h.inicio === actual) ? actual : null));
      setEstadoHorarios("pronto");
    } catch {
      // Uma falha nunca se mostra como "sem horários": diz-se que falhou.
      setEstadoHorarios("erro");
    }
  }, [clinicaId]);

  const irParaQuando = () => {
    if (!modalidade) return;
    ir(2);
    void carregarHorarios(modalidade);
  };

  const irParaConfirmar = () => {
    const encontrados = validarContacto(dados);
    setErros(encontrados);
    const primeiro = ORDEM_CAMPOS.find((c) => encontrados[c]);
    if (primeiro) {
      campos.current[primeiro]?.focus();
      return;
    }
    setErroEnvio(null);
    ir(4);
  };

  const enviar = async () => {
    if (!clinicaId || !modalidade || !horario) return;
    setAEnviar(true);
    setErroEnvio(null);
    try {
      const pedido = await agendamentosApi.pedir({
        clinica_id: clinicaId,
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        telefone: dados.telefone.trim(),
        modalidade,
        horario_inicio: horario,
        motivo: dados.motivo.trim() || null,
        screening_id: isLoggedIn ? params.get("rastreio") : null,
      });
      // Só depois de a API responder (CLAUDE.md §6: nunca sucesso antes).
      setEnviado(pedido);
      setDireccao(1);
    } catch (err) {
      if ((err as { status?: unknown } | null)?.status === 409) {
        // Outra pessoa ficou com o horário: volta-se à escolha, com a lista nova.
        setErroEnvio("ocupado");
        setHorario(null);
        ir(2);
        void carregarHorarios(modalidade);
      } else {
        setErroEnvio("rede");
      }
    } finally {
      setAEnviar(false);
    }
  };

  const sair = () => navigate(localizar("/"));
  const destino = localizar(isLoggedIn ? "/dashboard" : "/");
  const dias = agruparPorDia(horarios);
  const horariosDoDia = dias.find((d) => d.chave === dia)?.horarios ?? [];
  const quando = horario
    ? t("MarcarConsulta.quandoValor", { dia: formatarDiaLongo(horario, idioma), hora: formatarHora(horario, idioma) })
    : "";
  const nomeModalidade = modalidade ? t(`MarcarConsulta.${modalidade}`) : "";
  const mudar = (campo: CampoContacto, valor: string) => {
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  };

  // ------------------------------------------------------------ Enviado
  if (enviado) {
    return (
      <LayoutTarefa
        tema="claro"
        passo={{ actual: TOTAL, total: TOTAL, rotulo: t("MarcarConsulta.passoEnviado") }}
        sair={{ rotulo: t("MarcarConsulta.sair"), aoSair: sair }}
        textoSaltar={t("MarcarConsulta.saltar")}
        accao={
          <Botao asChild tamanho="g" larguraTotal>
            <Link to={destino}>
              <House aria-hidden /> {t(isLoggedIn ? "MarcarConsulta.minhaArea" : "MarcarConsulta.voltarInicio")}
            </Link>
          </Botao>
        }
      >
        <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-sucesso-suave text-sucesso">
          <CalendarCheck className="size-6" />
        </span>
        <h1 className="mt-5 text-titulo-m text-tinta">{t("MarcarConsulta.enviadoTitulo")}</h1>
        <p className="mt-3 text-corpo text-tinta-suave">
          {t("MarcarConsulta.enviadoTexto", { email: enviado.email })}
        </p>
        {enviado.modalidade === "online" && (
          <p className="mt-3 text-corpo text-tinta-suave">{t("MarcarConsulta.enviadoOnline")}</p>
        )}
        <dl className="mt-6 divide-y divide-linha rounded-cartao border border-linha">
          <Linha rotulo={t("MarcarConsulta.rotuloQuando")} valor={quando} />
          <Linha rotulo={t("MarcarConsulta.rotuloComo")} valor={nomeModalidade} />
          <Linha rotulo={t("MarcarConsulta.numeroPedido")} valor={enviado.id.slice(0, 8).toUpperCase()} />
        </dl>
      </LayoutTarefa>
    );
  }

  // ------------------------------------------------------------ Passos
  const accao =
    passo === 1 ? (
      <Botao tamanho="g" larguraTotal disabled={!modalidade} onClick={irParaQuando}>
        {t("MarcarConsulta.continuar")} <ArrowRight aria-hidden />
      </Botao>
    ) : passo === 2 ? (
      <Botao tamanho="g" larguraTotal disabled={!horario} onClick={() => ir(3)}>
        {t("MarcarConsulta.continuar")} <ArrowRight aria-hidden />
      </Botao>
    ) : passo === 3 ? (
      <Botao tamanho="g" larguraTotal onClick={irParaConfirmar}>
        {t("MarcarConsulta.continuar")} <ArrowRight aria-hidden />
      </Botao>
    ) : (
      <Botao tamanho="g" larguraTotal aCarregar={aEnviar} onClick={() => void enviar()}>
        <Send aria-hidden /> {aEnviar ? t("MarcarConsulta.aEnviar") : t("MarcarConsulta.enviar")}
      </Botao>
    );

  return (
    <LayoutTarefa
      tema="claro"
      passo={{ actual: passo, total: TOTAL, rotulo: t("MarcarConsulta.passo", { actual: passo, total: TOTAL }) }}
      sair={{ rotulo: t("MarcarConsulta.sair"), aoSair: sair }}
      confirmarSaida={
        passo > 1
          ? {
              titulo: t("MarcarConsulta.confirmarSaidaTitulo"),
              descricao: t("MarcarConsulta.confirmarSaidaTexto"),
              ficar: t("MarcarConsulta.ficar"),
              sair: t("MarcarConsulta.confirmarSair"),
              fechar: t("MarcarConsulta.fechar"),
            }
          : undefined
      }
      accao={accao}
      textoSaltar={t("MarcarConsulta.saltar")}
    >
      <TransicaoPasso chave={passo} direccao={direccao}>
        {passo === 1 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("MarcarConsulta.comoTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("MarcarConsulta.comoTexto")}</p>
            <GrupoEscolha
              className="mt-8"
              legenda={t("MarcarConsulta.comoLegenda")}
              legendaOculta
              valor={modalidade}
              aoMudar={(m) => {
                setModalidade(m);
                setHorario(null);
              }}
              opcoes={[
                {
                  valor: "presencial",
                  rotulo: t("MarcarConsulta.presencial"),
                  descricao: t("MarcarConsulta.presencialDescricao"),
                  icone: <MapPin />,
                },
                {
                  valor: "online",
                  rotulo: t("MarcarConsulta.online"),
                  descricao: t("MarcarConsulta.onlineDescricao"),
                  icone: <Video />,
                },
              ]}
            />
            {!modalidade && (
              <p role="status" className="mt-4 text-legenda text-tinta-suave">
                {t("MarcarConsulta.escolhaComo")}
              </p>
            )}
          </>
        )}

        {passo === 2 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("MarcarConsulta.quandoTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("MarcarConsulta.quandoTexto")}</p>
            {erroEnvio === "ocupado" && (
              <Aviso className="mt-6" variante="aviso" anunciar>
                {t("MarcarConsulta.horarioOcupado")}
              </Aviso>
            )}

            {estadoHorarios === "a-carregar" && (
              <p role="status" className="mt-8 text-corpo text-tinta-suave">
                {t("MarcarConsulta.aCarregarHorarios")}
              </p>
            )}

            {estadoHorarios === "erro" && (
              <Aviso
                className="mt-8"
                variante="erro"
                anunciar
                titulo={t("MarcarConsulta.erroHorariosTitulo")}
                accao={
                  <Botao variante="secundario" onClick={() => modalidade && void carregarHorarios(modalidade)}>
                    <RefreshCw aria-hidden /> {t("MarcarConsulta.tentarDeNovo")}
                  </Botao>
                }
              >
                {t("MarcarConsulta.erroHorariosTexto")}
              </Aviso>
            )}

            {estadoHorarios === "pronto" && dias.length === 0 && (
              <Aviso
                className="mt-8"
                variante="info"
                titulo={t("MarcarConsulta.semHorariosTitulo")}
                accao={
                  <div className="flex flex-col items-start gap-1">
                    <Botao variante="fantasma" className="-ml-3 sm:-ml-5" onClick={() => ir(1)}>
                      {t("MarcarConsulta.trocarModalidade")}
                    </Botao>
                    <Botao asChild variante="fantasma" className="-ml-3 sm:-ml-5">
                      <a href={`tel:${TELEFONE_CLINICA.replace(/\s/g, "")}`}>
                        <Phone aria-hidden /> {t("MarcarConsulta.ligarClinica", { telefone: TELEFONE_CLINICA })}
                      </a>
                    </Botao>
                  </div>
                }
              >
                {t(modalidade === "online" ? "MarcarConsulta.semHorariosOnline" : "MarcarConsulta.semHorariosPresencial")}
              </Aviso>
            )}

            {estadoHorarios === "pronto" && dias.length > 0 && (
              <>
                <GrupoEscolha
                  className="mt-8"
                  aparencia="pastilha"
                  legenda={t("MarcarConsulta.legendaDia")}
                  valor={dia}
                  aoMudar={(d) => {
                    setDia(d);
                    setHorario(null);
                  }}
                  opcoes={dias.map((d) => {
                    const primeiro = d.horarios[0]!.inicio;
                    const curto = formatarDiaCurto(primeiro, idioma);
                    return {
                      valor: d.chave,
                      rotuloAcessivel: formatarDiaLongo(primeiro, idioma),
                      rotulo: (
                        <span className="flex flex-col leading-tight">
                          <span className="text-legenda">{curto.semana}</span>
                          <span>{curto.data}</span>
                        </span>
                      ),
                    };
                  })}
                />
                <GrupoEscolha
                  className="mt-8"
                  aparencia="pastilha"
                  legenda={t("MarcarConsulta.legendaHora")}
                  valor={horario}
                  aoMudar={setHorario}
                  opcoes={horariosDoDia.map((h) => ({ valor: h.inicio, rotulo: formatarHora(h.inicio, idioma) }))}
                />
                {!horario && (
                  <p role="status" className="mt-4 text-legenda text-tinta-suave">
                    {t("MarcarConsulta.escolhaHora")}
                  </p>
                )}
              </>
            )}
          </>
        )}

        {passo === 3 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("MarcarConsulta.dadosTitulo")}</h1>
            <p className="mt-3 text-corpo text-tinta-suave">{t("MarcarConsulta.dadosTexto")}</p>
            <div className="mt-8 flex flex-col gap-6">
              <Campo
                ref={(el) => void (campos.current.nome = el)}
                rotulo={t("MarcarConsulta.nome")}
                ajuda={t("MarcarConsulta.nomeAjuda")}
                erro={erros.nome && t("MarcarConsulta.erroNomeCurto")}
                value={dados.nome}
                onChange={(e) => mudar("nome", e.target.value)}
                maxLength={MAX_NOME}
                autoComplete="name"
              />
              <Campo
                ref={(el) => void (campos.current.email = el)}
                rotulo={t("MarcarConsulta.email")}
                ajuda={t("MarcarConsulta.emailAjuda")}
                erro={erros.email && t("MarcarConsulta.erroEmailInvalido")}
                value={dados.email}
                onChange={(e) => mudar("email", e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={255}
              />
              <Campo
                ref={(el) => void (campos.current.telefone = el)}
                rotulo={t("MarcarConsulta.telefone")}
                ajuda={t("MarcarConsulta.telefoneAjuda")}
                erro={erros.telefone && t("MarcarConsulta.erroTelefoneInvalido")}
                value={dados.telefone}
                onChange={(e) => mudar("telefone", e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={30}
              />
              <CampoTexto
                ref={(el) => void (campos.current.motivo = el)}
                rotulo={t("MarcarConsulta.motivo")}
                ajuda={t("MarcarConsulta.motivoAjuda")}
                erro={erros.motivo && t("MarcarConsulta.erroMotivoLongo")}
                value={dados.motivo}
                onChange={(e) => mudar("motivo", e.target.value)}
                maxLength={MAX_MOTIVO}
                textoRestantes={(n) => t("MarcarConsulta.restantes", { n })}
              />
            </div>
          </>
        )}

        {passo === 4 && (
          <>
            <h1 className="text-titulo-m text-tinta">{t("MarcarConsulta.confirmarTitulo")}</h1>
            <dl className="mt-8 divide-y divide-linha rounded-cartao border border-linha">
              <Linha rotulo={t("MarcarConsulta.rotuloClinica")} valor={t("MarcarConsulta.clinicaNome")} />
              <Linha
                rotulo={t("MarcarConsulta.rotuloComo")}
                valor={nomeModalidade}
                alterar={{ rotulo: t("MarcarConsulta.alterarRotulo", { campo: t("MarcarConsulta.rotuloComo") }), aoAlterar: () => ir(1) }}
              />
              <Linha
                rotulo={t("MarcarConsulta.rotuloQuando")}
                valor={quando}
                alterar={{ rotulo: t("MarcarConsulta.alterarRotulo", { campo: t("MarcarConsulta.rotuloQuando") }), aoAlterar: () => ir(2) }}
              />
              {(["nome", "email", "telefone", "motivo"] as const).map((c) => {
                const rotulo = t(`MarcarConsulta.rotulo${c[0]!.toUpperCase()}${c.slice(1)}`);
                return (
                  <Linha
                    key={c}
                    rotulo={rotulo}
                    valor={dados[c].trim() || t("MarcarConsulta.semMotivo")}
                    alterar={{ rotulo: t("MarcarConsulta.alterarRotulo", { campo: rotulo }), aoAlterar: () => ir(3) }}
                  />
                );
              })}
            </dl>
            <p className="mt-6 text-legenda text-tinta-suave">{t("MarcarConsulta.partilhado")}</p>
            {erroEnvio === "rede" && (
              <Aviso className="mt-6" variante="erro" anunciar titulo={t("MarcarConsulta.erroEnvioTitulo")}>
                {t("MarcarConsulta.erroEnvioTexto")}
              </Aviso>
            )}
          </>
        )}
      </TransicaoPasso>
    </LayoutTarefa>
  );
};

/** Uma linha do resumo: rótulo, valor e, se se puder, "Alterar". */
const Linha = ({
  rotulo,
  valor,
  alterar,
}: {
  rotulo: string;
  valor: string;
  alterar?: { rotulo: string; aoAlterar: () => void };
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <dt className="text-legenda text-tinta-suave">{rotulo}</dt>
        <dd className="mt-0.5 break-words text-corpo text-tinta">{valor}</dd>
      </div>
      {alterar && (
        <Botao variante="fantasma" className="-mr-3 -mt-1 shrink-0 px-3" aria-label={alterar.rotulo} onClick={alterar.aoAlterar}>
          {t("MarcarConsulta.alterar")}
        </Botao>
      )}
    </div>
  );
};

export default MarcarConsulta;

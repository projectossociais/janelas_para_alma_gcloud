import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, Ban, Check, Mail, Phone, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarAccao } from "@/components/admin/ConfirmarAccao";
import { EstadoDadosAdmin } from "@/components/admin/DadosAdmin";
import { useDadosAdmin } from "@/components/admin/useDadosAdmin";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Campo, CampoTexto } from "@/design/componentes/Campo";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";
import { GrupoEscolha } from "@/design/componentes/Escolha";
import { Seleccao } from "@/design/componentes/Seleccao";
import { Estado } from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import {
  voluntariadoApi,
  mensagemDeErroApi,
  type AtividadeVoluntariadoAdmin,
  type InscricaoAtividadeAdmin,
} from "@/lib/apiClient";
import { deHoraDeLuanda, formatarDataHoraLuanda } from "@/lib/marcacao/horarios";

type Vista = "candidaturas" | "atividades";

const ESTADO: Record<string, { rotulo: string; tom: "aviso" | "sucesso" | "erro" | "neutro" }> = {
  pendente: { rotulo: "Por decidir", tom: "aviso" },
  aprovada: { rotulo: "Aprovada", tom: "sucesso" },
  rejeitada: { rotulo: "Rejeitada", tom: "erro" },
  publicada: { rotulo: "Publicada", tom: "sucesso" },
  cancelada: { rotulo: "Cancelada", tom: "erro" },
  arquivada: { rotulo: "Arquivada", tom: "neutro" },
};
const EstadoDe = ({ estado }: { estado: string }) => {
  const e = ESTADO[estado] ?? { rotulo: estado, tom: "neutro" as const };
  return <Estado tom={e.tom}>{e.rotulo}</Estado>;
};

const FORM_VAZIO = { titulo: "", descricao: "", local: "", data_inicio: "", data_fim: "", vagas: "" };

const AdminVoluntariado = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const vista: Vista = searchParams.get("tab") === "atividades" ? "atividades" : "candidaturas";
  const mudarVista = (v: Vista) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", v);
    setSearchParams(p, { replace: true });
  };

  const candidaturasDados = useDadosAdmin(
    () => voluntariadoApi.listarCandidaturas(),
    "Não foi possível carregar as candidaturas.",
    [],
  );
  const atividadesDados = useDadosAdmin(
    () => voluntariadoApi.listarTodasAsAtividades(),
    "Não foi possível carregar as actividades.",
    [],
  );
  const candidaturas = candidaturasDados.dados ?? [];
  const atividades = atividadesDados.dados ?? [];
  const carregarCandidaturas = candidaturasDados.recarregar;
  const carregarAtividades = atividadesDados.recarregar;
  const [form, setForm] = useState(FORM_VAZIO);
  const [tentouPublicar, setTentouPublicar] = useState(false);
  const [erroPublicar, setErroPublicar] = useState<string | null>(null);
  const [aPublicar, setAPublicar] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [inscritosDe, setInscritosDe] = useState<AtividadeVoluntariadoAdmin | null>(null);
  // `null` = a carregar; nunca a lista de outra actividade nem "0" por causa de um erro.
  const [inscritos, setInscritos] = useState<InscricaoAtividadeAdmin[] | null>(null);
  const [erroInscritos, setErroInscritos] = useState<string | null>(null);
  // Filtros só do lado do cliente -- a lista já vem inteira da API
  // (gestão de admin, volume baixo); não há razão para um endpoint novo
  // só para isto. "Este mês" e "Futuras/Passadas" olham a `data_inicio`.
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "publicada" | "cancelada" | "arquivada">("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todas" | "mes" | "futuras" | "passadas">("todas");

  const decidirCandidatura = async (id: string, aprovar: boolean) => {
    setOcupado(id);
    try {
      if (aprovar) await voluntariadoApi.aprovarCandidatura(id);
      else await voluntariadoApi.rejeitarCandidatura(id);
      toast.success(aprovar ? "Candidatura aprovada. Já é voluntário activo." : "Candidatura rejeitada.");
      await carregarCandidaturas();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível decidir a candidatura."));
    } finally {
      setOcupado(null);
    }
  };

  // As datas escrevem-se em hora de Luanda, seja qual for o fuso deste computador.
  const inicioIso = deHoraDeLuanda(form.data_inicio);
  const fimIso = form.data_fim ? deHoraDeLuanda(form.data_fim) : null;
  const errosForm = {
    titulo: !form.titulo.trim() ? "Escreva um título." : undefined,
    local: !form.local.trim() ? "Diga onde é." : undefined,
    descricao: !form.descricao.trim() ? "Descreva a actividade." : undefined,
    data_inicio: !inicioIso ? "Escolha o dia e a hora de início." : undefined,
    data_fim: form.data_fim && fimIso && inicioIso && fimIso <= inicioIso ? "O fim tem de ser depois do início." : undefined,
  };

  const publicarAtividade = async (e: FormEvent) => {
    e.preventDefault();
    setTentouPublicar(true);
    setErroPublicar(null);
    if (Object.values(errosForm).some(Boolean) || !inicioIso) return;
    setAPublicar(true);
    try {
      await voluntariadoApi.publicarAtividade({
        titulo: form.titulo,
        descricao: form.descricao,
        local: form.local,
        data_inicio: inicioIso,
        data_fim: fimIso,
        vagas: form.vagas ? Number(form.vagas) : null,
      });
      toast.success("Actividade publicada. Os voluntários activos foram notificados por email.");
      setForm(FORM_VAZIO);
      setTentouPublicar(false);
      await carregarAtividades();
    } catch (err) {
      setErroPublicar(mensagemDeErroApi(err, "Não foi possível publicar a actividade."));
    } finally {
      setAPublicar(false);
    }
  };
  const erroDe = (campo: keyof typeof errosForm) => (tentouPublicar ? errosForm[campo] : undefined);

  const cancelarAtividade = async (id: string) => {
    try {
      await voluntariadoApi.cancelarAtividade(id);
      toast.success("Actividade cancelada.");
      await carregarAtividades();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível cancelar a actividade."));
    }
  };

  const arquivarAtividade = async (id: string) => {
    try {
      await voluntariadoApi.arquivarAtividade(id);
      toast.success("Actividade arquivada.");
      await carregarAtividades();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível arquivar a actividade."));
    }
  };

  const apagarAtividade = async (id: string) => {
    try {
      await voluntariadoApi.apagarAtividade(id);
      toast.success("Actividade apagada.");
      await carregarAtividades();
    } catch (err) {
      toast.error(
        mensagemDeErroApi(err, "Não foi possível apagar a actividade. Se já tiver inscrições, arquive em vez de apagar."),
      );
    }
  };

  const verInscritos = async (atividade: AtividadeVoluntariadoAdmin) => {
    setInscritosDe(atividade);
    setInscritos(null);
    setErroInscritos(null);
    try {
      setInscritos(await voluntariadoApi.listarInscritos(atividade.id));
    } catch (err) {
      setErroInscritos(mensagemDeErroApi(err, "Não foi possível carregar os inscritos."));
    }
  };

  const pendentes = candidaturas.filter((c) => c.status === "pendente");
  const decididas = candidaturas.filter((c) => c.status !== "pendente");

  const agora = Date.now();
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  const fimDoMes = new Date(inicioDoMes);
  fimDoMes.setMonth(fimDoMes.getMonth() + 1);

  const atividadesFiltradas = atividades
    // "Todos os estados" esconde as arquivadas de propósito -- é o próprio
    // objectivo de arquivar (a lista não cresce sem fim); "Arquivadas" no
    // filtro continua a poder consultá-las quando precisar.
    .filter((a) => (filtroEstado === "todas" ? a.estado !== "arquivada" : a.estado === filtroEstado))
    .filter((a) => {
      const inicio = new Date(a.data_inicio).getTime();
      if (filtroPeriodo === "mes") return inicio >= inicioDoMes.getTime() && inicio < fimDoMes.getTime();
      if (filtroPeriodo === "futuras") return inicio >= agora;
      if (filtroPeriodo === "passadas") return inicio < agora;
      return true;
    })
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

  return (
    <>
      <CabecalhoConsola
        titulo="Voluntariado"
        descricao="Candidaturas a voluntário (entre parênteses, as que estão por decidir) e actividades publicadas."
      />

      <GrupoEscolha<Vista>
        legenda="Mostrar"
        legendaOculta
        aparencia="pastilha"
        valor={vista}
        aoMudar={mudarVista}
        className="mb-5"
        opcoes={[
          { valor: "candidaturas", rotulo: `Candidaturas${candidaturasDados.dados ? ` (${pendentes.length})` : ""}` },
          { valor: "atividades", rotulo: `Actividades${atividadesDados.dados ? ` (${atividades.length})` : ""}` },
        ]}
      />

      {vista === "candidaturas" && (
        <EstadoDadosAdmin
          aCarregar={candidaturasDados.aCarregar}
          erro={candidaturasDados.erro}
          aoTentarDeNovo={() => void carregarCandidaturas()}
          temDados={!!candidaturasDados.dados}
        >
          {pendentes.length ? (
            <ul className="space-y-3">
              {pendentes.map((c) => (
                <li key={c.id} className="rounded-cartao border border-linha bg-superficie p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.utilizador_nome || c.utilizador_email}</span>
                        <EstadoDe estado={c.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-legenda text-tinta-suave">
                        <a href={`mailto:${c.utilizador_email}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                          <Mail className="size-3.5" aria-hidden />
                          {c.utilizador_email}
                        </a>
                        {c.telefone && (
                          <a href={`tel:${c.telefone}`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                            <Phone className="size-3.5" aria-hidden />
                            {c.telefone}
                          </a>
                        )}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-tinta-suave">{c.motivacao}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Botao aCarregar={ocupado === c.id} disabled={ocupado !== null && ocupado !== c.id} onClick={() => void decidirCandidatura(c.id, true)}>
                        <Check aria-hidden /> Aprovar
                      </Botao>
                      <ConfirmarAccao
                        rotulo="Rejeitar"
                        titulo="Rejeitar a candidatura?"
                        descricao={`${c.utilizador_nome || c.utilizador_email} não passa a voluntário.`}
                        confirmar="Rejeitar"
                        desactivado={ocupado !== null}
                        aoConfirmar={() => void decidirCandidatura(c.id, false)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Sem candidaturas pendentes.</p>
          )}

          {decididas.length > 0 && (
            <section aria-labelledby="voluntariado-decididas" className="mt-8">
              <h2 id="voluntariado-decididas" className="mb-3 text-titulo-p text-tinta">
                Já decididas
              </h2>
              <ul className="divide-y divide-linha rounded-cartao border border-linha bg-superficie">
                {decididas.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{c.utilizador_nome || c.utilizador_email}</span>
                      <span className="block text-legenda text-tinta-suave">{c.utilizador_email}</span>
                    </span>
                    <EstadoDe estado={c.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </EstadoDadosAdmin>
      )}

      {vista === "atividades" && (
        <div className="space-y-8">
          <form
            onSubmit={(e) => void publicarAtividade(e)}
            noValidate
            className="max-w-3xl space-y-4 rounded-cartao border border-linha bg-superficie p-5"
          >
            <h2 className="text-titulo-p text-tinta">Publicar actividade</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Campo rotulo="Título" value={form.titulo} erro={erroDe("titulo")} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              <Campo rotulo="Local" value={form.local} erro={erroDe("local")} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            </div>
            <CampoTexto
              rotulo="Descrição"
              value={form.descricao}
              erro={erroDe("descricao")}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <Campo
                rotulo="Data de início"
                ajuda="Hora de Luanda."
                type="datetime-local"
                value={form.data_inicio}
                erro={erroDe("data_inicio")}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
              <Campo
                rotulo="Data de fim (opcional)"
                ajuda="Hora de Luanda."
                type="datetime-local"
                value={form.data_fim}
                erro={erroDe("data_fim")}
                onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
              />
              <Campo
                rotulo="Vagas (opcional)"
                ajuda="Vazio: sem limite."
                type="number"
                min={1}
                value={form.vagas}
                onChange={(e) => setForm({ ...form, vagas: e.target.value })}
              />
            </div>
            {erroPublicar && (
              <Aviso variante="erro" anunciar titulo="A actividade não foi publicada">
                {erroPublicar}
              </Aviso>
            )}
            <Botao type="submit" aCarregar={aPublicar}>
              <Plus aria-hidden /> Publicar actividade
            </Botao>
          </form>

          <section aria-labelledby="voluntariado-atividades">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="voluntariado-atividades" className="text-titulo-p text-tinta">
                Actividades
                {atividadesDados.dados && (
                  <span className="text-corpo font-normal text-tinta-suave">
                    {" "}
                    ({atividadesFiltradas.length}
                    {atividadesFiltradas.length !== atividades.length ? ` de ${atividades.length}` : ""})
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap gap-3">
                <Seleccao
                  rotulo="Estado"
                  tamanho="compacto"
                  marcador="Escolher…"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
                  opcoes={[
                    { valor: "todas", rotulo: "Todos os estados" },
                    { valor: "publicada", rotulo: "Publicadas" },
                    { valor: "cancelada", rotulo: "Canceladas" },
                    { valor: "arquivada", rotulo: "Arquivadas" },
                  ]}
                  className="w-44"
                />
                <Seleccao
                  rotulo="Quando"
                  tamanho="compacto"
                  marcador="Escolher…"
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value as typeof filtroPeriodo)}
                  opcoes={[
                    { valor: "todas", rotulo: "Qualquer altura" },
                    { valor: "mes", rotulo: "Este mês" },
                    { valor: "futuras", rotulo: "Por acontecer" },
                    { valor: "passadas", rotulo: "Já aconteceram" },
                  ]}
                  className="w-44"
                />
              </div>
            </div>

            <div className="mt-4">
              <EstadoDadosAdmin
                aCarregar={atividadesDados.aCarregar}
                erro={atividadesDados.erro}
                aoTentarDeNovo={() => void carregarAtividades()}
                temDados={!!atividadesDados.dados}
              >
                {atividadesFiltradas.length > 0 && (
                  <ul className="divide-y divide-linha rounded-cartao border border-linha bg-superficie">
                    {atividadesFiltradas.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{a.titulo}</span>
                            <EstadoDe estado={a.estado} />
                          </div>
                          <p className="mt-1 text-legenda text-tinta-suave">
                            {a.local} · {formatarDataHoraLuanda(a.data_inicio)} (hora de Luanda) · {a.inscritos} inscrito
                            {a.inscritos === 1 ? "" : "s"}
                            {a.vagas != null && ` de ${a.vagas}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Botao variante="secundario" onClick={() => void verInscritos(a)}>
                            <Users aria-hidden /> Inscritos
                          </Botao>
                          {a.estado === "publicada" && (
                            <ConfirmarAccao
                              soIcone
                              icone={<Ban aria-hidden />}
                              rotulo={`Cancelar «${a.titulo}»`}
                              titulo="Cancelar a actividade?"
                              descricao="Os voluntários já inscritos não são avisados automaticamente: avise-os."
                              confirmar="Cancelar actividade"
                              aoConfirmar={() => void cancelarAtividade(a.id)}
                            />
                          )}
                          {a.estado !== "arquivada" && (
                            <ConfirmarAccao
                              soIcone
                              icone={<Archive aria-hidden />}
                              rotulo={`Arquivar «${a.titulo}»`}
                              titulo="Arquivar a actividade?"
                              descricao="Sai da lista por omissão; continua em «Arquivadas», com o histórico de inscrições."
                              confirmar="Arquivar"
                              aoConfirmar={() => void arquivarAtividade(a.id)}
                            />
                          )}
                          <ConfirmarAccao
                            soIcone
                            icone={<Trash2 aria-hidden />}
                            rotulo={`Apagar «${a.titulo}»`}
                            titulo={`Apagar «${a.titulo}»?`}
                            descricao="Não se pode desfazer. Se a actividade já tiver inscrições, a API recusa apagar: arquive-a, para não perder o histórico de quem se inscreveu."
                            confirmar="Apagar"
                            aoConfirmar={() => void apagarAtividade(a.id)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!atividades.length && <p className="text-tinta-suave">Nenhuma actividade ainda.</p>}
                {!!atividades.length && !atividadesFiltradas.length && (
                  <p className="text-tinta-suave">Nenhuma actividade corresponde aos filtros.</p>
                )}
              </EstadoDadosAdmin>
            </div>
          </section>
        </div>
      )}

      <Dialogo open={!!inscritosDe} onOpenChange={(open) => !open && setInscritosDe(null)}>
        <DialogoConteudo
          titulo={`Inscritos em ${inscritosDe?.titulo ?? ""}`}
          descricao={
            inscritos
              ? `${inscritos.length} voluntário${inscritos.length === 1 ? "" : "s"} inscrito${inscritos.length === 1 ? "" : "s"}.`
              : undefined
          }
          rotuloFechar="Fechar"
        >
          {erroInscritos ? (
            <Aviso variante="erro" anunciar titulo="Não foi possível carregar os inscritos">
              {erroInscritos}
            </Aviso>
          ) : inscritos === null ? (
            <p role="status" className="text-tinta-suave">
              A carregar…
            </p>
          ) : inscritos.length ? (
            <ul className="max-h-96 divide-y divide-linha overflow-y-auto rounded-controlo border border-linha">
              {inscritos.map((i) => (
                <li key={i.id} className="px-3 py-2">
                  <span className="block font-medium">{i.utilizador_nome || "—"}</span>
                  <span className="block text-legenda text-tinta-suave">{i.utilizador_email}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Ainda sem inscritos.</p>
          )}
        </DialogoConteudo>
      </Dialogo>
    </>
  );
};

export default AdminVoluntariado;

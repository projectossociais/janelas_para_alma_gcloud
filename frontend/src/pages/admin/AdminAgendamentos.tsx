import { useState } from "react";
import { Check, Crown, Mail, MapPinned, Phone, Video, X } from "lucide-react";
import { toast } from "sonner";
import { EstadoDadosAdmin, useDadosAdmin } from "@/components/admin/DadosAdmin";
import { Botao } from "@/design/componentes/Botao";
import {
  Estado,
  Tabela,
  TabelaCabecalho,
  TabelaCelula,
  TabelaCorpo,
  TabelaLinha,
  TabelaTitulo,
} from "@/design/componentes/Tabela";
import { CabecalhoConsola } from "@/design/layouts/LayoutConsola";
import { agendamentosApi, mensagemDeErroApi, type AgendamentoClinicoAdmin } from "@/lib/apiClient";
import { formatarDiaLongo, formatarHora } from "@/lib/marcacao/horarios";

const ESTADO: Record<string, { rotulo: string; tom: "aviso" | "sucesso" | "erro" | "neutro" }> = {
  pendente: { rotulo: "Por decidir", tom: "aviso" },
  confirmada: { rotulo: "Confirmada", tom: "sucesso" },
  recusada: { rotulo: "Recusada", tom: "erro" },
};

const EstadoAgendamento = ({ estado }: { estado: string }) => {
  const e = ESTADO[estado] ?? { rotulo: estado, tom: "neutro" as const };
  return <Estado tom={e.tom}>{e.rotulo}</Estado>;
};

/**
 * Quando é a consulta. Sempre em hora de Luanda (o horário que o paciente
 * escolheu), nunca no fuso do computador de quem abre o painel. Pedidos
 * antigos (antes dos horários reais) só têm o dia e o período preferidos.
 */
const quando = (a: AgendamentoClinicoAdmin) => {
  if (a.horario_inicio) return `${formatarDiaLongo(a.horario_inicio, "pt-PT")}, ${formatarHora(a.horario_inicio, "pt-PT")} (hora de Luanda)`;
  if (a.data_preferida) return `${a.data_preferida}${a.periodo_preferido ? ` · ${a.periodo_preferido}` : ""} (preferência)`;
  return "—";
};

const AdminAgendamentos = () => {
  const { dados, erro, aCarregar, recarregar } = useDadosAdmin(
    () => agendamentosApi.listarAgendamentos(),
    "Não foi possível carregar os agendamentos.",
    [],
  );
  const [ocupado, setOcupado] = useState<string | null>(null);

  const decidir = async (id: string, confirmar: boolean) => {
    setOcupado(id);
    try {
      if (confirmar) await agendamentosApi.confirmar(id);
      else await agendamentosApi.recusar(id);
      toast.success(confirmar ? "Consulta confirmada. O paciente foi notificado." : "Pedido recusado.");
      await recarregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível decidir o agendamento."));
    } finally {
      setOcupado(null);
    }
  };

  const pendentes = (dados ?? []).filter((a) => a.estado === "pendente");
  const decididos = (dados ?? []).filter((a) => a.estado !== "pendente");

  return (
    <>
      <CabecalhoConsola titulo="Agendamentos clínicos" descricao="Pedidos de consulta recebidos pelas clínicas parceiras." />

      <EstadoDadosAdmin aCarregar={aCarregar} erro={erro} aoTentarDeNovo={() => void recarregar()} temDados={!!dados}>
        <section aria-labelledby="agendamentos-pendentes">
          <h2 id="agendamentos-pendentes" className="text-titulo-p text-tinta">
            Por decidir ({pendentes.length})
          </h2>
          {pendentes.length ? (
            <ul className="mt-3 space-y-3">
              {pendentes.map((a) => (
                <li key={a.id} className="rounded-cartao border border-linha bg-superficie p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-corpo font-medium text-tinta">{a.nome}</span>
                        {a.premium && (
                          <Estado tom="info">
                            <Crown className="mr-1 size-3.5" aria-hidden />
                            Premium
                          </Estado>
                        )}
                        <span className="inline-flex items-center gap-1 text-legenda text-tinta-suave">
                          {a.modalidade === "online" ? <Video className="size-3.5" aria-hidden /> : <MapPinned className="size-3.5" aria-hidden />}
                          {a.modalidade === "online" ? "Teleconsulta" : "Presencial"}
                        </span>
                      </div>
                      <p className="mt-1 text-corpo text-tinta">{quando(a)}</p>
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
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Botao aCarregar={ocupado === a.id} disabled={ocupado !== null && ocupado !== a.id} onClick={() => void decidir(a.id, true)}>
                        <Check aria-hidden /> Confirmar
                      </Botao>
                      <Botao variante="secundario" disabled={ocupado !== null} onClick={() => void decidir(a.id, false)}>
                        <X aria-hidden /> Recusar
                      </Botao>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-corpo text-tinta-suave">Sem pedidos pendentes.</p>
          )}
        </section>

        {decididos.length > 0 && (
          <section aria-labelledby="agendamentos-decididos" className="mt-10">
            <h2 id="agendamentos-decididos" className="mb-3 text-titulo-p text-tinta">
              Já decididos
            </h2>
            <Tabela legenda="Agendamentos já decididos">
              <TabelaCabecalho>
                <TabelaLinha>
                  <TabelaTitulo>Paciente</TabelaTitulo>
                  <TabelaTitulo>Consulta</TabelaTitulo>
                  <TabelaTitulo>Estado</TabelaTitulo>
                </TabelaLinha>
              </TabelaCabecalho>
              <TabelaCorpo>
                {decididos.map((a) => (
                  <TabelaLinha key={a.id}>
                    <TabelaCelula>
                      <span className="block font-medium">{a.nome}</span>
                      <span className="block text-legenda text-tinta-suave">{a.email}</span>
                    </TabelaCelula>
                    <TabelaCelula className="text-tinta-suave">{quando(a)}</TabelaCelula>
                    <TabelaCelula>
                      <EstadoAgendamento estado={a.estado} />
                    </TabelaCelula>
                  </TabelaLinha>
                ))}
              </TabelaCorpo>
            </Tabela>
          </section>
        )}
      </EstadoDadosAdmin>
    </>
  );
};

export default AdminAgendamentos;

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  agendamentosApi,
  mensagemDeErroApi,
  type AgendamentoClinicoAdmin,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Check, X, Mail, Phone, MapPinned, Video } from "lucide-react";

const estadoBadge = (estado: string) => {
  const variantes: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    confirmada: "default",
    pendente: "secondary",
    recusada: "destructive",
  };
  return <Badge variant={variantes[estado] ?? "outline"}>{estado}</Badge>;
};

const AdminAgendamentos = () => {
  const [agendamentos, setAgendamentos] = useState<AgendamentoClinicoAdmin[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = async () => {
    try {
      setAgendamentos(await agendamentosApi.listarAgendamentos());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os agendamentos."));
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const decidir = async (id: string, confirmar: boolean) => {
    setOcupado(id);
    try {
      if (confirmar) await agendamentosApi.confirmar(id);
      else await agendamentosApi.recusar(id);
      toast.success(confirmar ? "Consulta confirmada. O paciente foi notificado." : "Pedido recusado.");
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível decidir o agendamento."));
    } finally {
      setOcupado(null);
    }
  };

  const pendentes = agendamentos.filter((a) => a.estado === "pendente");
  const decididos = agendamentos.filter((a) => a.estado !== "pendente");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Agendamentos clínicos</h2>
        <p className="text-sm text-muted-foreground">
          Pedidos de consulta recebidos pelas clínicas parceiras.
        </p>
      </div>

      <div className="space-y-3">
        {pendentes.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{a.nome}</span>
                    {estadoBadge(a.estado)}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {a.modalidade === "online" ? <Video className="w-3 h-3" /> : <MapPinned className="w-3 h-3" />}
                      {a.modalidade}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{a.telefone}</span>
                    {a.horario_inicio ? (
                      <span>{new Date(a.horario_inicio).toLocaleString("pt-AO")}</span>
                    ) : (
                      a.data_preferida && (
                        <span>
                          {a.data_preferida}
                          {a.periodo_preferido && ` · ${a.periodo_preferido}`}
                        </span>
                      )
                    )}
                  </div>
                  {a.motivo && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{a.motivo}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" disabled={ocupado === a.id} onClick={() => decidir(a.id, true)}>
                    <Check className="w-3 h-3" /> Confirmar
                  </Button>
                  <Button size="sm" variant="outline" disabled={ocupado === a.id} onClick={() => decidir(a.id, false)}>
                    <X className="w-3 h-3" /> Recusar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!pendentes.length && <p className="text-center text-muted-foreground py-6">Sem pedidos pendentes.</p>}

        {decididos.length > 0 && (
          <div className="pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Já decididos</h3>
            <div className="space-y-2">
              {decididos.map((a) => (
                <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                  <div>
                    <span className="font-medium">{a.nome}</span>
                    <span className="text-xs text-muted-foreground ml-2">{a.email}</span>
                  </div>
                  {estadoBadge(a.estado)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAgendamentos;

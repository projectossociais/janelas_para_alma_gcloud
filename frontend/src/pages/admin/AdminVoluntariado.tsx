import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  voluntariadoApi,
  mensagemDeErroApi,
  type CandidaturaVoluntariadoAdmin,
  type AtividadeVoluntariadoAdmin,
  type InscricaoAtividadeAdmin,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { Check, X, Plus, Users, Ban, Mail, Phone } from "lucide-react";

const estadoBadge = (estado: string) => {
  const variantes: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    aprovada: "default",
    publicada: "default",
    pendente: "secondary",
    rejeitada: "destructive",
    cancelada: "destructive",
  };
  return <Badge variant={variantes[estado] ?? "outline"}>{estado}</Badge>;
};

const FORM_VAZIO = { titulo: "", descricao: "", local: "", data_inicio: "", data_fim: "", vagas: "" };

const AdminVoluntariado = () => {
  const [searchParams] = useSearchParams();
  const tabInicial = searchParams.get("tab") === "atividades" ? "atividades" : "candidaturas";

  const [candidaturas, setCandidaturas] = useState<CandidaturaVoluntariadoAdmin[]>([]);
  const [atividades, setAtividades] = useState<AtividadeVoluntariadoAdmin[]>([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [aPublicar, setAPublicar] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [inscritosDe, setInscritosDe] = useState<AtividadeVoluntariadoAdmin | null>(null);
  const [inscritos, setInscritos] = useState<InscricaoAtividadeAdmin[]>([]);

  const carregarCandidaturas = async () => {
    try {
      setCandidaturas(await voluntariadoApi.listarCandidaturas());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar as candidaturas."));
    }
  };

  const carregarAtividades = async () => {
    try {
      setAtividades(await voluntariadoApi.listarTodasAsAtividades());
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar as actividades."));
    }
  };

  useEffect(() => {
    carregarCandidaturas();
    carregarAtividades();
  }, []);

  const decidirCandidatura = async (id: string, aprovar: boolean) => {
    setOcupado(id);
    try {
      if (aprovar) await voluntariadoApi.aprovarCandidatura(id);
      else await voluntariadoApi.rejeitarCandidatura(id);
      toast.success(aprovar ? "Candidatura aprovada — já é voluntário activo." : "Candidatura rejeitada.");
      await carregarCandidaturas();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível decidir a candidatura."));
    } finally {
      setOcupado(null);
    }
  };

  const publicarAtividade = async () => {
    if (!form.titulo || !form.descricao || !form.local || !form.data_inicio) {
      toast.error("Título, descrição, local e data de início são obrigatórios.");
      return;
    }
    setAPublicar(true);
    try {
      await voluntariadoApi.publicarAtividade({
        titulo: form.titulo,
        descricao: form.descricao,
        local: form.local,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        vagas: form.vagas ? Number(form.vagas) : null,
      });
      toast.success("Actividade publicada — os voluntários activos foram notificados por email.");
      setForm(FORM_VAZIO);
      await carregarAtividades();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível publicar a actividade."));
    } finally {
      setAPublicar(false);
    }
  };

  const cancelarAtividade = async (id: string) => {
    if (!confirm("Cancelar esta actividade? Os voluntários já inscritos não são notificados automaticamente.")) return;
    try {
      await voluntariadoApi.cancelarAtividade(id);
      toast.success("Actividade cancelada.");
      await carregarAtividades();
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível cancelar a actividade."));
    }
  };

  const verInscritos = async (atividade: AtividadeVoluntariadoAdmin) => {
    setInscritosDe(atividade);
    try {
      setInscritos(await voluntariadoApi.listarInscritos(atividade.id));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível carregar os inscritos."));
    }
  };

  const pendentes = candidaturas.filter((c) => c.status === "pendente");
  const decididas = candidaturas.filter((c) => c.status !== "pendente");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Voluntariado</h2>
        <p className="text-sm text-muted-foreground">Candidaturas a voluntário e actividades publicadas.</p>
      </div>

      <Tabs defaultValue={tabInicial}>
        <TabsList>
          <TabsTrigger value="candidaturas">
            Candidaturas {pendentes.length > 0 && <Badge variant="destructive" className="ml-2">{pendentes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="atividades">Actividades ({atividades.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="candidaturas" className="space-y-3 mt-4">
          {pendentes.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c.utilizador_nome || c.utilizador_email}</span>
                      {estadoBadge(c.status)}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{c.utilizador_email}</span>
                      {c.telefone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefone}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{c.motivacao}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" disabled={ocupado === c.id} onClick={() => decidirCandidatura(c.id, true)}>
                      <Check className="w-3 h-3" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" disabled={ocupado === c.id} onClick={() => decidirCandidatura(c.id, false)}>
                      <X className="w-3 h-3" /> Rejeitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!pendentes.length && <p className="text-center text-muted-foreground py-6">Sem candidaturas pendentes.</p>}

          {decididas.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Já decididas</h3>
              <div className="space-y-2">
                {decididas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                    <div>
                      <span className="font-medium">{c.utilizador_nome || c.utilizador_email}</span>
                      <span className="text-xs text-muted-foreground ml-2">{c.utilizador_email}</span>
                    </div>
                    {estadoBadge(c.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="atividades" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Publicar actividade</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ativ-titulo">Título</Label>
                  <Input id="ativ-titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ativ-local">Local</Label>
                  <Input id="ativ-local" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="ativ-descricao">Descrição</Label>
                <Textarea id="ativ-descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ativ-data-inicio">Data de início</Label>
                  <Input id="ativ-data-inicio" type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ativ-data-fim">Data de fim (opcional)</Label>
                  <Input id="ativ-data-fim" type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ativ-vagas">Vagas (opcional)</Label>
                  <Input id="ativ-vagas" type="number" min={1} value={form.vagas} onChange={(e) => setForm({ ...form, vagas: e.target.value })} placeholder="Sem limite" />
                </div>
              </div>
              <Button onClick={publicarAtividade} disabled={aPublicar}>
                <Plus className="w-4 h-4" /> {aPublicar ? "A publicar..." : "Publicar actividade"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actividades publicadas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {atividades.map((a) => (
                <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      {a.titulo}
                      {estadoBadge(a.estado)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.local} · {new Date(a.data_inicio).toLocaleString("pt-PT")} · {a.inscritos} inscrito{a.inscritos === 1 ? "" : "s"}
                      {a.vagas != null && ` de ${a.vagas}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => verInscritos(a)}>
                      <Users className="w-3 h-3" /> Inscritos
                    </Button>
                    {a.estado === "publicada" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelarAtividade(a.id)}>
                        <Ban className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!atividades.length && <p className="text-center text-muted-foreground py-6">Nenhuma actividade ainda.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!inscritosDe} onOpenChange={(open) => !open && setInscritosDe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inscritos — {inscritosDe?.titulo}</DialogTitle>
            <DialogDescription>{inscritos.length} voluntário{inscritos.length === 1 ? "" : "s"} inscrito{inscritos.length === 1 ? "" : "s"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {inscritos.map((i) => (
              <div key={i.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-medium">{i.utilizador_nome || "—"}</div>
                  <div className="text-xs text-muted-foreground">{i.utilizador_email}</div>
                </div>
              </div>
            ))}
            {!inscritos.length && <p className="text-center text-muted-foreground py-4">Ainda sem inscritos.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVoluntariado;

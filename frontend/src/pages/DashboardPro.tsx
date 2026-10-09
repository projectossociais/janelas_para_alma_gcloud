import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Stethoscope, Users, Calendar, FileText, Mail, Phone, Trash2, Video, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import RequireClinica from "@/components/admin/RequireClinica";
import {
  clinicasApi,
  mensagemDeErroApi,
  linkDaSalaVideo,
  type AgendamentoClinicoAdmin,
  type ClinicaParceiraAdmin,
  type DisponibilidadeClinicaPublica,
  type TeleconsultaPublica,
} from "@/lib/apiClient";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const DIAS_SEMANA_CHAVES = [
  "DashboardPro.segunda",
  "DashboardPro.terca",
  "DashboardPro.quarta",
  "DashboardPro.quinta",
  "DashboardPro.sexta",
  "DashboardPro.sabado",
  "DashboardPro.domingo",
] as const;

const estadoBadge = (estado: string) => {
  const variantes: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    confirmada: "default",
    pendente: "secondary",
    recusada: "destructive",
  };
  return <Badge variant={variantes[estado] ?? "outline"}>{estado}</Badge>;
};

const ControloTeleconsulta = ({ agendamentoId }: { agendamentoId: string }) => {
  const { t } = useTranslation();
  const [teleconsulta, setTeleconsulta] = useState<TeleconsultaPublica | null>(null);
  const [recomendacao, setRecomendacao] = useState("");
  const [aProcessar, setAProcessar] = useState(false);

  useEffect(() => {
    clinicasApi
      .obterTeleconsulta(agendamentoId)
      .then(setTeleconsulta)
      .catch((err) => toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelCarregarTeleconsulta"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentoId]);

  const iniciar = async () => {
    setAProcessar(true);
    try {
      setTeleconsulta(await clinicasApi.iniciarTeleconsulta(agendamentoId));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelIniciarTeleconsulta")));
    } finally {
      setAProcessar(false);
    }
  };

  const concluir = async () => {
    if (!recomendacao.trim()) {
      toast.error(t("DashboardPro.indiqueUmaRecomendacao"));
      return;
    }
    setAProcessar(true);
    try {
      setTeleconsulta(await clinicasApi.concluirTeleconsulta(agendamentoId, recomendacao.trim()));
      toast.success(t("DashboardPro.teleconsultaConcluida"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelConcluirTeleconsulta")));
    } finally {
      setAProcessar(false);
    }
  };

  if (!teleconsulta) return null;

  return (
    <div className="mt-2 pt-2 border-t space-y-2 w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={linkDaSalaVideo(teleconsulta.sala_video)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary underline"
        >
          <Video className="w-3.5 h-3.5" />{t("DashboardPro.entrarNaSala")}
        </a>
        <Badge variant="outline">{t(`DashboardPro.teleconsultaEstado.${teleconsulta.estado}`)}</Badge>
      </div>
      {teleconsulta.estado === "agendada" && (
        <Button size="sm" onClick={iniciar} disabled={aProcessar}>{t("DashboardPro.iniciarConsulta")}</Button>
      )}
      {teleconsulta.estado === "em_curso" && (
        <div className="space-y-2">
          <Textarea
            value={recomendacao}
            onChange={(e) => setRecomendacao(e.target.value)}
            placeholder={t("DashboardPro.recomendacaoClinicaPlaceholder")}
            rows={3}
          />
          <Button size="sm" onClick={concluir} disabled={aProcessar}>
            {t("DashboardPro.concluirEEnviarRecomendacao")}
          </Button>
        </div>
      )}
      {teleconsulta.estado === "concluida" && teleconsulta.recomendacao_clinica && (
        <p className="text-sm text-muted-foreground">
          <strong>{t("DashboardPro.recomendacao")}:</strong> {teleconsulta.recomendacao_clinica}
        </p>
      )}
    </div>
  );
};

interface NovaJanela {
  diaSemana: string;
  horaInicio: string;
  horaFim: string;
  modalidade: "presencial" | "online";
}

const NOVA_JANELA_VAZIA: NovaJanela = { diaSemana: "0", horaInicio: "08:00", horaFim: "12:00", modalidade: "presencial" };

const ConteudoDashboardPro = ({ clinica }: { clinica: ClinicaParceiraAdmin }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoClinicoAdmin[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeClinicaPublica[]>([]);
  const [novaJanela, setNovaJanela] = useState(NOVA_JANELA_VAZIA);
  const [aGuardarJanela, setAGuardarJanela] = useState(false);

  useEffect(() => {
    clinicasApi
      .meusAgendamentos()
      .then(setAgendamentos)
      .catch((err) => toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelCarregar"))));
    clinicasApi
      .minhaDisponibilidade()
      .then(setDisponibilidade)
      .catch((err) => toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelCarregarDisponibilidade"))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adicionarJanela = async () => {
    setAGuardarJanela(true);
    try {
      const criada = await clinicasApi.adicionarDisponibilidade({
        dia_semana: Number(novaJanela.diaSemana),
        hora_inicio: `${novaJanela.horaInicio}:00`,
        hora_fim: `${novaJanela.horaFim}:00`,
        modalidade: novaJanela.modalidade,
      });
      setDisponibilidade((atual) => [...atual, criada]);
      toast.success(t("DashboardPro.disponibilidadeAdicionada"));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelGuardarDisponibilidade")));
    } finally {
      setAGuardarJanela(false);
    }
  };

  const removerJanela = async (id: string) => {
    try {
      await clinicasApi.removerDisponibilidade(id);
      setDisponibilidade((atual) => atual.filter((j) => j.id !== id));
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("DashboardPro.naoFoiPossivelRemoverDisponibilidade")));
    }
  };

  const pendentes = agendamentos.filter((a) => a.estado === "pendente");
  const confirmados = agendamentos.filter((a) => a.estado === "confirmada");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="flex-1 container pt-28 pb-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-navy" />{" "}{t("DashboardPro.areaClinica")}
          </h1>
          <p className="text-muted-foreground">
            {t("DashboardPro.bemVindoADr")} {user?.name || ""} — {clinica.nome}.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardContent className="p-6">
            <Users className="w-6 h-6 text-teal mb-2" /><div className="text-2xl font-bold">{pendentes.length}</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.pedidosPorDecidir")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <Calendar className="w-6 h-6 text-navy mb-2" /><div className="text-2xl font-bold">{confirmados.length}</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.teleconsultasAgendadas")}</div>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <FileText className="w-6 h-6 text-gold mb-2" />
            <div className="text-2xl font-bold text-muted-foreground">{t("DashboardPro.emBreve")}</div>
            <div className="text-sm text-muted-foreground">{t("DashboardPro.relatoriosPendentes")}</div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("DashboardPro.pedidosDeConsulta")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {agendamentos.map((a) => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{a.nome}</span>
                    {estadoBadge(a.estado)}
                    {a.premium && (
                      <Badge className="bg-gold text-navy hover:bg-gold gap-1">
                        <Crown className="w-3 h-3" /> {t("DashboardPro.premium")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{a.email}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{a.telefone}</span>
                  </div>
                  {a.modalidade === "online" && a.estado === "confirmada" && (
                    <ControloTeleconsulta agendamentoId={a.id} />
                  )}
                </div>
              </div>
            ))}
            {!agendamentos.length && (
              <p className="text-center text-muted-foreground py-6">{t("DashboardPro.aindaSemPedidos")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("DashboardPro.disponibilidadeSemanal")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {disponibilidade.map((j) => (
                <div key={j.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-semibold">{t(DIAS_SEMANA_CHAVES[j.dia_semana])}</span>
                    <span>{j.hora_inicio.slice(0, 5)} — {j.hora_fim.slice(0, 5)}</span>
                    <Badge variant="outline">{j.modalidade}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removerJanela(j.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {!disponibilidade.length && (
                <p className="text-sm text-muted-foreground">{t("DashboardPro.aindaSemDisponibilidade")}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-4 gap-3 items-end border-t pt-4">
              <div className="space-y-1.5">
                <Label>{t("DashboardPro.diaDaSemana")}</Label>
                <Select value={novaJanela.diaSemana} onValueChange={(v) => setNovaJanela((p) => ({ ...p, diaSemana: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA_CHAVES.map((chave, i) => (
                      <SelectItem key={chave} value={String(i)}>{t(chave)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="disp-inicio">{t("DashboardPro.horaInicio")}</Label>
                <Input
                  id="disp-inicio"
                  type="time"
                  value={novaJanela.horaInicio}
                  onChange={(e) => setNovaJanela((p) => ({ ...p, horaInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="disp-fim">{t("DashboardPro.horaFim")}</Label>
                <Input
                  id="disp-fim"
                  type="time"
                  value={novaJanela.horaFim}
                  onChange={(e) => setNovaJanela((p) => ({ ...p, horaFim: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("DashboardPro.modalidade")}</Label>
                <Select
                  value={novaJanela.modalidade}
                  onValueChange={(v) => setNovaJanela((p) => ({ ...p, modalidade: v as "presencial" | "online" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">{t("DashboardPro.presencial")}</SelectItem>
                    <SelectItem value="online">{t("DashboardPro.online")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={adicionarJanela} disabled={aGuardarJanela}>
              {t("DashboardPro.adicionarHorario")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("DashboardPro.emBreve")}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>{t("DashboardPro.listaDePacientesQue")}</p>
            <p>{t("DashboardPro.visualizacaoDeRelatoriosDo")}</p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const DashboardPro = () => (
  <RequireClinica>{(clinica) => <ConteudoDashboardPro clinica={clinica} />}</RequireClinica>
);

export default DashboardPro;

import { useEffect, useState } from "react";
import { z } from "zod";
import { CalendarPlus, Video, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { optioptika, OPTIOPTIKA_YELLOW } from "@/data/optioptika";
import { agendamentosApi, mensagemDeErroApi, type HorarioDisponivel } from "@/lib/apiClient";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { formatarDataHora } from "@/i18n/formatar";

const appointmentSchema = () => z.object({
  name: z
    .string()
    .trim()
    .min(2, i18n.t("OptioptikaBookingDialog.indiqueOSeuNome"))
    .max(100, i18n.t("OptioptikaBookingDialog.maximo100Caracteres")),
  email: z
    .string()
    .trim()
    .email(i18n.t("OptioptikaBookingDialog.emailInvalido"))
    .max(255, i18n.t("OptioptikaBookingDialog.maximo255Caracteres")),
  phone: z
    .string()
    .trim()
    .min(6, i18n.t("OptioptikaBookingDialog.telefoneInvalido"))
    .max(30, i18n.t("OptioptikaBookingDialog.maximo30Caracteres")),
  horario: z.string().min(1, i18n.t("OptioptikaBookingDialog.escolhaUmHorario")),
  notes: z.string().trim().max(500, i18n.t("OptioptikaBookingDialog.maximo500Caracteres")).optional(),
});

type Mode = "online" | "presencial";

interface BookingReceipt {
  id: string;
  createdAt: string;
  mode: Mode;
  name: string;
  email: string;
  phone: string;
  horario: string;
  notes?: string;
}

const emptyForm = { name: "", email: "", phone: "", horario: "", notes: "" };

interface OptioptikaBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OptioptikaBookingDialog = ({ open, onOpenChange }: OptioptikaBookingDialogProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("presencial");
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [enviando, setEnviando] = useState(false);
  // A clínica é sempre a Optioptika por agora (Fase 0 do matchmaker -- ver
  // docs/BACKLOG.md, Sprint 4) -- o id real vem da API própria em vez de
  // ficar fixo no código, para não ter de mudar isto quando houver mais
  // parceiros.
  const [clinicaId, setClinicaId] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([]);
  const [aCarregarHorarios, setACarregarHorarios] = useState(false);

  const update = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!open) return;
    agendamentosApi
      .listarClinicas()
      .then((clinicas) => setClinicaId(clinicas[0]?.id ?? null))
      .catch(() => setClinicaId(null));
  }, [open]);

  useEffect(() => {
    if (!open || !clinicaId) return;
    setACarregarHorarios(true);
    update("horario", "");
    agendamentosApi
      .horariosDisponiveis(clinicaId, mode)
      .then(setHorarios)
      .catch(() => setHorarios([]))
      .finally(() => setACarregarHorarios(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clinicaId, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = appointmentSchema().safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? t("OptioptikaBookingDialog.verifiqueOsCamposDo"));
      return;
    }
    if (!clinicaId) {
      toast.error(t("OptioptikaBookingDialog.verifiqueOsCamposDo"));
      return;
    }

    setEnviando(true);
    try {
      const agendamento = await agendamentosApi.pedir({
        clinica_id: clinicaId,
        nome: result.data.name,
        email: result.data.email,
        telefone: result.data.phone,
        modalidade: mode,
        horario_inicio: result.data.horario,
        motivo: result.data.notes || null,
      });
      // Só mostra o "recibo" depois da API confirmar a gravação -- nunca
      // antes (CLAUDE.md, "nunca mostrar sucesso antes de verificar erro").
      setReceipt({
        id: agendamento.id,
        createdAt: formatarDataHora(new Date(agendamento.created_at)),
        mode,
        ...result.data,
      });
      toast.success(
        t("OptioptikaBookingDialog.pedidoEnviadoAEntraremos", { name: optioptika.name, valor: mode === "online" ? t("OptioptikaBookingDialog.modalidadeOnline") : t("OptioptikaBookingDialog.modalidadePresencial") }),
      );
      setForm(emptyForm);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, t("OptioptikaBookingDialog.esteHorarioJaNao")));
      // Um horário pode ter sido ocupado por outro pedido entretanto --
      // a lista tem de ser recarregada, nunca deixar o utilizador tentar o
      // mesmo horário forjado outra vez.
      if (clinicaId) {
        agendamentosApi.horariosDisponiveis(clinicaId, mode).then(setHorarios).catch(() => setHorarios([]));
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setReceipt(null);
      setForm(emptyForm);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {receipt ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CalendarPlus className="w-5 h-5 text-black" />
                {t("OptioptikaBookingDialog.pedidoDeConsultaConfirmado")}
              </DialogTitle>
              <DialogDescription>
                <Trans i18nKey="OptioptikaBookingDialog.aEntraraEmContacto" values={{ name: optioptika.name }} />
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("OptioptikaBookingDialog.nDoPedido")}</span>
                <span className="font-mono font-semibold">{receipt.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("OptioptikaBookingDialog.emitido")}</span>
                <span>{receipt.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("OptioptikaBookingDialog.modalidade")}</span>
                <span className="capitalize">{receipt.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("OptioptikaBookingDialog.nome")}</span>
                <span>{receipt.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("OptioptikaBookingDialog.contactos")}</span>
                <span className="text-right">{receipt.email}<br/>{receipt.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("OptioptikaBookingDialog.horario")}</span>
                <span>{formatarDataHora(new Date(receipt.horario))}</span>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => handleOpenChange(false)}
                className="w-full bg-black text-white hover:bg-black/80"
              >
                {t("OptioptikaBookingDialog.fechar")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CalendarPlus className="w-5 h-5 text-black" />
                <Trans i18nKey="OptioptikaBookingDialog.agendarConsultaNa" values={{ name: optioptika.name }} />
              </DialogTitle>
              <DialogDescription>
                {t("OptioptikaBookingDialog.escolhaAModalidadeE")}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
              <TabsList className="grid grid-cols-2 w-full h-auto p-1.5 mb-4">
                <TabsTrigger
                  value="presencial"
                  className="flex items-center gap-2 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white"
                >
                  <MapPinned className="w-4 h-4" />
                  {t("OptioptikaBookingDialog.presencial")}
                </TabsTrigger>
                <TabsTrigger
                  value="online"
                  className="flex items-center gap-2 py-2.5 data-[state=active]:bg-[#FFD500] data-[state=active]:text-black"
                >
                  <Video className="w-4 h-4" />
                  {t("OptioptikaBookingDialog.online")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="presencial" className="mt-0 mb-4">
                <div className="rounded-lg border border-black/20 bg-black/5 p-4 text-sm text-muted-foreground">
                  <Trans i18nKey="OptioptikaBookingDialog.consultaPresencialNaClinica" components={{ strong: <strong className="text-foreground" /> }} values={{ name: optioptika.name, location: optioptika.location }} />
                </div>
              </TabsContent>
              <TabsContent value="online" className="mt-0 mb-4">
                <div className="rounded-lg border border-[#FFD500]/50 bg-[#FFD500]/10 p-4 text-sm text-muted-foreground">
                  {t("OptioptikaBookingDialog.consultaPorVideochamadaRecebera")}
                </div>
              </TabsContent>
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ap-name">{t("OptioptikaBookingDialog.nomeCompleto")}</Label>
                  <Input
                    id="ap-name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    maxLength={100}
                    required
                    placeholder={t("OptioptikaBookingDialog.exAnaSilva")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-email">{t("OptioptikaBookingDialog.email")}</Label>
                  <Input
                    id="ap-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    maxLength={255}
                    required
                    placeholder="seu@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-phone">{t("OptioptikaBookingDialog.telefone")}</Label>
                  <Input
                    id="ap-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    maxLength={30}
                    required
                    placeholder="+244 900 000 000"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ap-horario">{t("OptioptikaBookingDialog.horario")}</Label>
                  <Select
                    value={form.horario}
                    onValueChange={(v) => update("horario", v)}
                    disabled={aCarregarHorarios || horarios.length === 0}
                  >
                    <SelectTrigger id="ap-horario">
                      <SelectValue
                        placeholder={
                          aCarregarHorarios
                            ? t("OptioptikaBookingDialog.aCarregarHorarios")
                            : horarios.length === 0
                              ? t("OptioptikaBookingDialog.semHorariosDisponiveis")
                              : t("OptioptikaBookingDialog.escolherHorario")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {horarios.map((h) => (
                        <SelectItem key={h.inicio} value={h.inicio}>
                          {formatarDataHora(new Date(h.inicio))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ap-notes">{t("OptioptikaBookingDialog.motivoDaConsultaOpcional")}</Label>
                  <Textarea
                    id="ap-notes"
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder={t("OptioptikaBookingDialog.descrevaSintomasHistoricoOu")}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={enviando}
                  className={`w-full font-semibold ${mode === "online" ? "bg-[#FFD500] text-black hover:opacity-90" : "bg-black text-white hover:bg-black/80"}`}
                >
                  {enviando
                    ? t("OptioptikaBookingDialog.aEnviarOSeuPedido")
                    : `${t("OptioptikaBookingDialog.solicitarConsulta")} ${mode === "online" ? t("OptioptikaBookingDialog.online") : t("OptioptikaBookingDialog.presencial")}`}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OptioptikaBookingDialog;

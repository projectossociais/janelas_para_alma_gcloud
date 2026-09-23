import { useState } from "react";
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
  date: z.string().min(1, i18n.t("OptioptikaBookingDialog.escolhaUmaData")),
  period: z.string().min(1, i18n.t("OptioptikaBookingDialog.escolhaUmPeriodo")),
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
  date: string;
  period: string;
  notes?: string;
}

const emptyForm = { name: "", email: "", phone: "", date: "", period: "", notes: "" };

interface OptioptikaBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OptioptikaBookingDialog = ({ open, onOpenChange }: OptioptikaBookingDialogProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("presencial");
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [form, setForm] = useState(emptyForm);

  const update = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = appointmentSchema().safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? t("OptioptikaBookingDialog.verifiqueOsCamposDo"));
      return;
    }
    // Optimistic UI: create + show booking receipt instantly.
    const booking: BookingReceipt = {
      id: `OPT-${Date.now().toString(36).toUpperCase()}`,
      createdAt: formatarDataHora(new Date()),
      mode,
      ...result.data,
    };
    setReceipt(booking);
    toast.success(
      t("OptioptikaBookingDialog.pedidoEnviadoAEntraremos", { name: optioptika.name, valor: mode === "online" ? t("OptioptikaBookingDialog.modalidadeOnline") : t("OptioptikaBookingDialog.modalidadePresencial") }),
    );
    setForm(emptyForm);
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
                <span className="font-mono font-semibold">{receipt.id}</span>
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
                <span className="text-muted-foreground">{t("OptioptikaBookingDialog.dataPeriodo")}</span>
                <span>{receipt.date}, {receipt.period}</span>
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
                <div className="space-y-1.5">
                  <Label htmlFor="ap-date">{t("OptioptikaBookingDialog.dataPreferida")}</Label>
                  <Input
                    id="ap-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-period">{t("OptioptikaBookingDialog.periodo")}</Label>
                  <Select
                    value={form.period}
                    onValueChange={(v) => update("period", v)}
                  >
                    <SelectTrigger id="ap-period">
                      <SelectValue placeholder={t("OptioptikaBookingDialog.escolherPeriodo")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manha">{t("OptioptikaBookingDialog.manha08h30As12h00")}</SelectItem>
                      <SelectItem value="tarde">{t("OptioptikaBookingDialog.tarde14h00As18h00")}</SelectItem>
                      <SelectItem value="sabado">{t("OptioptikaBookingDialog.sabado09h00As13h00")}</SelectItem>
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
                  className={`w-full font-semibold ${mode === "online" ? "bg-[#FFD500] text-black hover:opacity-90" : "bg-black text-white hover:bg-black/80"}`}
                >
                  {t("OptioptikaBookingDialog.solicitarConsulta")}{" "}{mode === "online" ? t("OptioptikaBookingDialog.online") : t("OptioptikaBookingDialog.presencial")}
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

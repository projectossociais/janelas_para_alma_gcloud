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

const appointmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Indique o seu nome")
    .max(100, "Máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Máximo 255 caracteres"),
  phone: z
    .string()
    .trim()
    .min(6, "Telefone inválido")
    .max(30, "Máximo 30 caracteres"),
  date: z.string().min(1, "Escolha uma data"),
  period: z.string().min(1, "Escolha um período"),
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
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
  const [mode, setMode] = useState<Mode>("presencial");
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [form, setForm] = useState(emptyForm);

  const update = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = appointmentSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Verifique os campos do formulário.");
      return;
    }
    // Optimistic UI: create + show booking receipt instantly.
    const booking: BookingReceipt = {
      id: `OPT-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toLocaleString("pt-PT"),
      mode,
      ...result.data,
    };
    setReceipt(booking);
    toast.success(
      `Pedido enviado à ${optioptika.name}. Entraremos em contacto para confirmar a sua consulta ${mode === "online" ? "online" : "presencial"}.`,
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
                Pedido de Consulta Confirmado
              </DialogTitle>
              <DialogDescription>
                A {optioptika.name} entrará em contacto por email ou telefone para
                confirmar o horário definitivo.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nº do pedido</span>
                <span className="font-mono font-semibold">{receipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Emitido</span>
                <span>{receipt.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modalidade</span>
                <span className="capitalize">{receipt.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome</span>
                <span>{receipt.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contactos</span>
                <span className="text-right">{receipt.email}<br/>{receipt.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data / Período</span>
                <span>{receipt.date}, {receipt.period}</span>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => handleOpenChange(false)}
                className="w-full bg-black text-white hover:bg-black/80"
              >
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CalendarPlus className="w-5 h-5 text-black" />
                Agendar Consulta na {optioptika.name}
              </DialogTitle>
              <DialogDescription>
                Escolha a modalidade e preencha os seus dados. A clínica confirmará o horário por email ou telefone.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
              <TabsList className="grid grid-cols-2 w-full h-auto p-1.5 mb-4">
                <TabsTrigger
                  value="presencial"
                  className="flex items-center gap-2 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white"
                >
                  <MapPinned className="w-4 h-4" />
                  Presencial
                </TabsTrigger>
                <TabsTrigger
                  value="online"
                  className="flex items-center gap-2 py-2.5 data-[state=active]:bg-[#FFD500] data-[state=active]:text-black"
                >
                  <Video className="w-4 h-4" />
                  Online
                </TabsTrigger>
              </TabsList>

              <TabsContent value="presencial" className="mt-0 mb-4">
                <div className="rounded-lg border border-black/20 bg-black/5 p-4 text-sm text-muted-foreground">
                  Consulta presencial na clínica <strong className="text-foreground">{optioptika.name}</strong> em {optioptika.location}. Traga documento de identificação e prescrições anteriores, se disponíveis.
                </div>
              </TabsContent>
              <TabsContent value="online" className="mt-0 mb-4">
                <div className="rounded-lg border border-[#FFD500]/50 bg-[#FFD500]/10 p-4 text-sm text-muted-foreground">
                  Consulta por videochamada. Receberá um link seguro por email antes da hora marcada. Ideal para triagem inicial e acompanhamento.
                </div>
              </TabsContent>
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ap-name">Nome completo</Label>
                  <Input
                    id="ap-name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    maxLength={100}
                    required
                    placeholder="Ex.: Ana Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-email">Email</Label>
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
                  <Label htmlFor="ap-phone">Telefone</Label>
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
                  <Label htmlFor="ap-date">Data preferida</Label>
                  <Input
                    id="ap-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ap-period">Período</Label>
                  <Select
                    value={form.period}
                    onValueChange={(v) => update("period", v)}
                  >
                    <SelectTrigger id="ap-period">
                      <SelectValue placeholder="Escolher período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manha">Manhã (08h30 às 12h00)</SelectItem>
                      <SelectItem value="tarde">Tarde (14h00 às 18h00)</SelectItem>
                      <SelectItem value="sabado">Sábado (09h00 às 13h00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ap-notes">Motivo da consulta (opcional)</Label>
                  <Textarea
                    id="ap-notes"
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Descreva sintomas, histórico ou dúvidas específicas."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  className={`w-full font-semibold ${mode === "online" ? "bg-[#FFD500] text-black hover:opacity-90" : "bg-black text-white hover:bg-black/80"}`}
                >
                  Solicitar Consulta {mode === "online" ? "Online" : "Presencial"}
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

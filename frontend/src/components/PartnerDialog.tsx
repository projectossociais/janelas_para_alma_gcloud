import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const partnershipTypes = () => [
  i18n.t("PartnerDialog.clinicaOftalmologica"),
  i18n.t("PartnerDialog.medicoEspecialista"),
  i18n.t("PartnerDialog.optica"),
  i18n.t("PartnerDialog.investidor"),
  i18n.t("PartnerDialog.voluntario"),
  i18n.t("PartnerDialog.outro"),
];

const initialFormData = {
  Nome: "",
  "Pessoa de Contacto": "",
  Email: "",
  Telefone: "",
  "Tipo de Parceria": "",
  Mensagem: "",
};

type PartnerFormData = typeof initialFormData;

const PartnerDialog = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<PartnerFormData>(initialFormData);

  const updateField = (field: keyof PartnerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(
        "https://formsubmit.co/ajax/b5d00747e55e83039bef54d4a0d3c922",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...formData,
            _captcha: "false",
            _template: "table",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(t("PartnerDialog.erroAoEnviarProposta"));
      }

      setFormData(initialFormData);
      setOpen(false);
      toast.success(
        t("PartnerDialog.obrigadoASuaProposta"),
      );
    } catch {
      toast.error(t("PartnerDialog.ocorreuUmErroAo"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="inline-flex h-auto items-center gap-2 rounded-xl bg-teal px-8 py-4 text-lg font-semibold text-teal-foreground shadow-elevated transition-all hover:-translate-y-0.5 hover:opacity-90">
          {t("PartnerDialog.queroSerParceiro")}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto pb-16 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("PartnerDialog.sejaNossoParceiro")}</DialogTitle>
          <DialogDescription>
            {t("PartnerDialog.junteSeANossa")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="partner-nome">{t("PartnerDialog.nome")}</Label>
            <Input
              id="partner-nome"
              required
              value={formData.Nome}
              onChange={(event) => updateField("Nome", event.target.value)}
              placeholder={t("PartnerDialog.nomeDaInstituicaoOu")}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="partner-contacto">{t("PartnerDialog.pessoaDeContacto")}</Label>
            <Input
              id="partner-contacto"
              required
              value={formData["Pessoa de Contacto"]}
              onChange={(event) =>
                updateField("Pessoa de Contacto", event.target.value)
              }
              placeholder={t("PartnerDialog.nomeCompleto")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="partner-email">{t("PartnerDialog.email")}</Label>
              <Input
                id="partner-email"
                type="email"
                required
                value={formData.Email}
                onChange={(event) => updateField("Email", event.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partner-telefone">{t("PartnerDialog.telefone")}</Label>
              <Input
                id="partner-telefone"
                required
                value={formData.Telefone}
                onChange={(event) => updateField("Telefone", event.target.value)}
                placeholder={t("PartnerDialog.n2449xxXxxXxx")}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="partner-tipo">{t("PartnerDialog.tipoDeParceria")}</Label>
            <Select
              required
              value={formData["Tipo de Parceria"]}
              onValueChange={(value) => updateField("Tipo de Parceria", value)}
            >
              <SelectTrigger id="partner-tipo" aria-label={t("PartnerDialog.tipoDeParceria")}>
                <SelectValue placeholder={t("PartnerDialog.seleccioneUmaOpcao")} />
              </SelectTrigger>
              <SelectContent>
                {partnershipTypes().map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="partner-mensagem">{t("PartnerDialog.mensagem")}</Label>
            <Textarea
              id="partner-mensagem"
              required
              rows={4}
              value={formData.Mensagem}
              onChange={(event) => updateField("Mensagem", event.target.value)}
              placeholder={t("PartnerDialog.conteNosComoGostaria")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal text-teal-foreground hover:opacity-90 sm:w-auto"
            >
              {submitting ? t("PartnerDialog.aEnviar") : t("PartnerDialog.enviarProposta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PartnerDialog;
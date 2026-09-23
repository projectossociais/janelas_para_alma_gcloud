import { useState } from "react";
import { z } from "zod";
import { HeartHandshake } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sendToEdgeFunction } from "@/lib/edgeFunction";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import KambaHeroCarousel from "@/components/kamba/KambaHeroCarousel";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const volunteerSchema = () => z.object({
  name: z.string().trim().min(1, i18n.t("VolunteerSection.nomeEObrigatorio")).max(100, i18n.t("VolunteerSection.maximo100Caracteres")),
  email: z.string().trim().email(i18n.t("VolunteerSection.emailInvalido")).max(255, i18n.t("VolunteerSection.maximo255Caracteres")),
  phone: z.string().trim().min(1, i18n.t("VolunteerSection.telefoneEObrigatorio")).max(20, i18n.t("VolunteerSection.maximo20Caracteres")),
  motivation: z.string().trim().min(1, i18n.t("VolunteerSection.motivacaoEObrigatoria")).max(1000, i18n.t("VolunteerSection.maximo1000Caracteres")),
});


const VolunteerSection = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      motivation: formData.get("motivation") as string,
    };

    const result = volunteerSchema().safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const resp = await sendToEdgeFunction("send-volunteer-email", result.data);
      if (resp?.error) throw new Error(resp.error);
      toast({
        title: t("VolunteerSection.inscricaoSubmetidaComSucesso"),
        description: t("VolunteerSection.bemVindoAA"),
      });
      setOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      console.error("Volunteer form error:", err);
      toast({
        title: t("VolunteerSection.erroAoSubmeter"),
        description: err instanceof Error ? err.message : t("VolunteerSection.verifiqueASuaLigacao"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="voluntariado" className="py-20 md:py-28 bg-navy text-navy-foreground">
      <KambaHeroCarousel
        onOpenForm={() => { setOpen(true); setErrors({}); }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal/10 text-teal">
                <HeartHandshake className="w-5 h-5" />
              </div>
              {t("VolunteerSection.formularioDeInscricao")}
            </DialogTitle>
            <DialogDescription>
              {t("VolunteerSection.preencheOsCamposAbaixo")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("VolunteerSection.nomeCompleto")}</label>
                <Input name="name" placeholder={t("VolunteerSection.oTeuNome")} maxLength={100} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("VolunteerSection.email")}</label>
                <Input name="email" type="email" placeholder={t("VolunteerSection.exemploEmail")} maxLength={255} />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("VolunteerSection.telefone")}</label>
              <Input name="phone" placeholder={t("VolunteerSection.n2449xxXxxXxx")} maxLength={20} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("VolunteerSection.breveMotivacao")}</label>
              <Textarea name="motivation" placeholder={t("VolunteerSection.porqueQueresSerUm")} maxLength={1000} rows={4} />
              {errors.motivation && <p className="text-sm text-destructive">{errors.motivation}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal text-teal-foreground font-medium transition-all hover:opacity-90 shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("VolunteerSection.aSubmeter") : t("VolunteerSection.inscreverMeComoKamba")}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default VolunteerSection;

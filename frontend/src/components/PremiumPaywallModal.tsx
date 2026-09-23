import { Check, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

interface PremiumPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const benefits = () => [
  i18n.t("PremiumPaywallModal.acessoIlimitadoAExercicios"),
  i18n.t("PremiumPaywallModal.acompanhamentoDeMetricasKpis"),
  i18n.t("PremiumPaywallModal.redirecionamentoExclusivoETeleconsulta"),
  i18n.t("PremiumPaywallModal.videosExplicativosComMedicos"),
];

const PremiumPaywallModal = ({ open, onOpenChange }: PremiumPaywallModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goToRegistration = () => {
    onOpenChange(false);
    navigate(localizar("/registo-premium"));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal to-navy flex items-center justify-center mb-3 shadow-elevated">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl md:text-3xl font-bold text-center">
            {t("PremiumPaywallModal.desbloqueieOSeuPotencial")}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {t("PremiumPaywallModal.facaUpgradeParaAceder")}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 my-4">
          {benefits().map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-teal/15 text-teal flex items-center justify-center">
                <Check className="w-4 h-4" strokeWidth={3} />
              </span>
              <span className="text-sm text-foreground leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button
            size="lg"
            onClick={goToRegistration}
            className="w-full bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="w-4 h-4" />
            {t("PremiumPaywallModal.registarParaAcessoPremium")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PremiumPaywallModal;

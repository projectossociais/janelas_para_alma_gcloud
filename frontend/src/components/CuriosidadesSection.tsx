import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, Gamepad2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { disponivelNoIdiomaActual, localizar } from "@/i18n/rotas";

const CURIOSIDADES = () => [
  i18n.t("CuriosidadesSection.oEstrabismoAfectaCerca"),
  i18n.t("CuriosidadesSection.cercaDe80De"),
  i18n.t("CuriosidadesSection.aAmbliopiaOlhoPreguicoso"),
  i18n.t("CuriosidadesSection.oculosUsadosEDevidamente"),
  i18n.t("CuriosidadesSection.osDoisOlhosTrabalham"),
  i18n.t("CuriosidadesSection.emAngolaAMaioria"),
  i18n.t("CuriosidadesSection.piscarOsOlhosRegularmente"),
];

const getDailyCuriosidade = () => {
  const dayOfMonth = new Date().getDate();
  return CURIOSIDADES()[dayOfMonth % CURIOSIDADES().length];
};

const CuriosidadesSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const curiosidade = useMemo(getDailyCuriosidade, []);

  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container px-4">
        <div className="max-w-2xl mx-auto rounded-2xl bg-card border border-border/50 shadow-card p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-teal/10 text-teal">
              <Lightbulb className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium tracking-widest uppercase text-teal">
              {t("CuriosidadesSection.curiosidades")}
            </span>
          </div>

          <p className="text-base md:text-lg font-semibold text-foreground leading-relaxed">
            {curiosidade}
          </p>

          {disponivelNoIdiomaActual("/jogo-curiosidades") && (
          <div className="border-t border-border/50 pt-5">
            <button
              onClick={() => navigate(localizar("/jogo-curiosidades"))}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold text-gold-foreground font-bold transition-all hover:opacity-90 hover:translate-y-[-2px]"
            >
              <Gamepad2 className="w-5 h-5" />
              {t("CuriosidadesSection.tenteONossoJogo")}
            </button>
          </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CuriosidadesSection;

import i18n from "@/i18n";
export const OPTIOPTIKA_YELLOW = "#FFD500";

export const optioptika = {
  get name() {
    return i18n.t("optioptika.opticaOptioptika");
  },
  get tagline() {
    return i18n.t("optioptika.visaoDaBanda");
  },
  get location() {
    return i18n.t("optioptika.urbanizacaoNovaVidaRua");
  },
  phone: "+244 931 240 304",
  email: "geral@optioptika.com",
  get hours() {
    return i18n.t("optioptika.segQui08h17h");
  },
  get description() {
    return i18n.t("optioptika.parceiroClinicoOficialDo");
  },
  get badges() {
    return [i18n.t("optioptika.parceiroOficial"), i18n.t("optioptika.consultasPresenciaisEOnline"), i18n.t("optioptika.equipaCertificada")];
  },
};

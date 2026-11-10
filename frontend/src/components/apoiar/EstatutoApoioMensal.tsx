import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apoiosMensaisApi, type ApoioMensalPublico } from "@/lib/apiClient";
import { formatarKz } from "@/lib/apoioMensal";
import { localizar } from "@/i18n/rotas";

/**
 * O estatuto de Kamba Mensal no painel da conta. Só aparece com um apoio
 * activo; sem ele (ou se a API falhar) não mostra nada -- o painel não
 * depende disto.
 */
const EstatutoApoioMensal = () => {
  const { t } = useTranslation();
  const [apoio, setApoio] = useState<ApoioMensalPublico | null>(null);

  useEffect(() => {
    let activo = true;
    apoiosMensaisApi
      .meu()
      .then((a) => activo && setApoio(a))
      .catch(() => activo && setApoio(null));
    return () => {
      activo = false;
    };
  }, []);

  if (!apoio) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-marca-ouro/60 bg-marca-ouro/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <BadgeCheck className="mt-0.5 h-7 w-7 shrink-0 text-marca-marinho" aria-hidden="true" />
        <div>
          <p className="font-bold text-marca-marinho">{t("ApoioMensal.kambaMensal")}</p>
          <p className="text-sm text-marca-marinho/70">
            {t("ApoioMensal.resumoCurto", { valor: formatarKz(apoio.valor_mensal_kz), meses: apoio.meses_com_comprovativo })}
          </p>
          {apoio.renovacao_em_falta && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-marca-marinho">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {t("ApoioMensal.lembreteCurto")}
            </p>
          )}
        </div>
      </div>
      <Link
        to={localizar("/apoiar?modo=mensal")}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-marca-marinho px-4 py-2 text-sm font-semibold text-marca-marfim hover:bg-marca-marinho/90"
      >
        {apoio.renovacao_em_falta ? t("ApoioMensal.enviarComprovativoDoMes") : t("ApoioMensal.verOMeuApoio")}
      </Link>
    </div>
  );
};

export default EstatutoApoioMensal;

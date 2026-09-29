import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { voluntariadoApi, type AtividadeVoluntariado } from "@/lib/apiClient";
import { formatarDataHora } from "@/i18n/formatar";

/**
 * UX-05 -- `voluntariadoApi.listarAtividades()` já existia mas nenhuma
 * página pública a chamava: o trabalho de publicar actividades em
 * `AdminVoluntariado.tsx` ficava invisível a quem não é admin. A API só
 * devolve actividades `estado == "publicada"` (ver
 * `AtividadeVoluntariadoRepository.listar_publicadas`) -- aqui só se
 * escondem, por cima disso, as que já terminaram.
 */
const UpcomingActivities = () => {
  const { t } = useTranslation();
  const [atividades, setAtividades] = useState<AtividadeVoluntariado[] | null>(null);

  useEffect(() => {
    voluntariadoApi
      .listarAtividades()
      .then(setAtividades)
      .catch(() => setAtividades([]));
  }, []);

  const agora = Date.now();
  const proximas = (atividades ?? [])
    .filter((a) => new Date(a.data_fim ?? a.data_inicio).getTime() >= agora)
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

  if (atividades !== null && proximas.length === 0) return null;

  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-4 mb-12">
          <span className="text-sm font-medium tracking-widest uppercase text-teal">
            {t("UpcomingActivities.proximasAccoes")}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold">{t("UpcomingActivities.junteSeANos")}</h2>
        </div>

        <div className="max-w-3xl mx-auto grid gap-4">
          {proximas.map((atividade) => {
            const vagasRestantes = atividade.vagas !== null ? atividade.vagas - atividade.inscritos : null;
            return (
              <Card key={atividade.id}>
                <CardContent className="p-6 md:p-8 space-y-3">
                  <h3 className="text-xl font-bold">{atividade.titulo}</h3>
                  <p className="text-muted-foreground">{atividade.descricao}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4" />
                      {formatarDataHora(atividade.data_inicio)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {atividade.local}
                    </span>
                    {vagasRestantes !== null && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {vagasRestantes > 0
                          ? t("UpcomingActivities.vagasRestantes", { count: vagasRestantes })
                          : t("UpcomingActivities.semVagas")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UpcomingActivities;

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConteudoRelatorio, {
  CabecalhoRelatorio,
  FolhaRelatorio,
} from "@/components/visao/ConteudoRelatorio";
import PartilharComMedico from "@/components/visao/PartilharComMedico";
import { useHistoricoVisao } from "@/components/visao/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { localizar } from "@/i18n/rotas";

/**
 * Relatório semanal para levar ao oftalmologista: minutos activos por dia,
 * limiares por sessão, sessões de baixa atenção, evolução e últimos resultados
 * dos testes. Imprime-se com `window.print()` (o browser gera o PDF) ou
 * partilha-se por link temporário (Fase B, `PartilharComMedico`). O conteúdo é
 * o mesmo que o médico vê no link (`ConteudoRelatorio`).
 */
const RelatorioSemanal = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { profile } = useProfile();
  const hoje = new Date();
  // O histórico completo é preciso para a evolução e os "últimos resultados".
  const { sessoes, erro, recarregar } = useHistoricoVisao();

  return (
    <div className="min-h-screen bg-background print:bg-white print:text-black">
      <div className="container mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button variant="ghost" asChild>
            <Link to={localizar("/exercicios/progresso")}>
              <ArrowLeft className="h-4 w-4" />
              {t("Visao.voltarAoProgresso")}
            </Link>
          </Button>
          <Button
            onClick={() => window.print()}
            className="gap-2 bg-navy text-navy-foreground hover:bg-navy/90"
            disabled={!sessoes}
          >
            <Printer className="h-4 w-4" />
            {t("Visao.imprimir")}
          </Button>
        </div>

        {isLoggedIn && <PartilharComMedico />}

        <FolhaRelatorio>
          <CabecalhoRelatorio
            hoje={hoje}
            nome={profile ? profile.nome_completo || profile.email : null}
            olhoMaisFraco={profile?.olho_mais_fraco ?? null}
            usaOculos={profile?.usa_oculos ?? null}
          />

          {!isLoggedIn ? (
            <p className="text-[13px] text-neutral-600">
              {t("Visao.progressoSemSessao")}
            </p>
          ) : erro ? (
            <div className="text-sm text-destructive" role="alert">
              <p>{t("Visao.erroACarregar")}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 print:hidden"
                onClick={() => void recarregar()}
              >
                {t("Visao.tentarDeNovo")}
              </Button>
            </div>
          ) : sessoes === null ? (
            <div className="h-40" aria-busy />
          ) : (
            <ConteudoRelatorio sessoes={sessoes} hoje={hoje} />
          )}
        </FolhaRelatorio>
      </div>
    </div>
  );
};

export default RelatorioSemanal;

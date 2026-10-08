import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import ConteudoRelatorio, { CabecalhoRelatorio, FolhaRelatorio } from "@/components/visao/ConteudoRelatorio";
import { MolduraRelatorio } from "@/components/visao/MolduraRelatorio";
import PartilharComMedico from "@/components/visao/PartilharComMedico";
import { useHistoricoVisao } from "@/components/visao/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { localizar } from "@/i18n/rotas";

/**
 * Relatório semanal para levar ao oftalmologista: minutos activos por dia,
 * limiares por sessão, sessões de baixa atenção, evolução e últimos resultados
 * dos testes. Imprime-se com `window.print()` (o browser gera o PDF) ou
 * partilha-se por link temporário (Fase B, `PartilharComMedico`). O conteúdo é
 * o mesmo que o médico vê no link (`ConteudoRelatorio`).
 *
 * Os estados (sem sessão, erro, a carregar) ficam **fora** da folha: a folha é só
 * para o que vai para o médico.
 */
const RelatorioSemanal = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { profile } = useProfile();
  const hoje = new Date();
  // O histórico completo é preciso para a evolução e os "últimos resultados".
  const { sessoes, erro, recarregar } = useHistoricoVisao();

  const voltar = (
    <Botao asChild variante="fantasma" className="-ml-3 px-3">
      <Link to={localizar("/exercicios/progresso")}>
        <ArrowLeft aria-hidden /> {t("Visao.voltarAoProgresso")}
      </Link>
    </Botao>
  );

  if (!isLoggedIn) {
    return (
      <MolduraRelatorio esquerda={voltar} podeImprimir={false}>
        <Aviso variante="info" titulo={t("Visao.relatorioTitulo")}>
          {t("Visao.progressoSemSessao")}
        </Aviso>
        <Botao asChild className="mt-6">
          <Link to={localizar(`/login?next=${encodeURIComponent("/exercicios/relatorio")}`)}>{t("ProgressoApp.entrar")}</Link>
        </Botao>
      </MolduraRelatorio>
    );
  }

  return (
    <MolduraRelatorio esquerda={voltar} podeImprimir={!!sessoes} antesDaFolha={<PartilharComMedico />}>
      {erro ? (
        <Aviso
          variante="erro"
          anunciar
          titulo={t("Visao.erroACarregar")}
          accao={
            <Botao variante="secundario" onClick={() => void recarregar()}>
              {t("Visao.tentarDeNovo")}
            </Botao>
          }
        >
          {t("ProgressoApp.erroTexto")}
        </Aviso>
      ) : sessoes === null ? (
        <p role="status" className="text-corpo text-tinta-suave">
          {t("ProgressoApp.aCarregar")}
        </p>
      ) : (
        <FolhaRelatorio>
          <CabecalhoRelatorio
            hoje={hoje}
            nome={profile ? profile.nome_completo || profile.email : null}
            olhoMaisFraco={profile?.olho_mais_fraco ?? null}
            usaOculos={profile?.usa_oculos ?? null}
          />
          <ConteudoRelatorio sessoes={sessoes} hoje={hoje} />
        </FolhaRelatorio>
      )}
    </MolduraRelatorio>
  );
};

export default RelatorioSemanal;

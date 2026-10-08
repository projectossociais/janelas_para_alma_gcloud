import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ConteudoRelatorio, { CabecalhoRelatorio, FolhaRelatorio } from "@/components/visao/ConteudoRelatorio";
import { MolduraRelatorio } from "@/components/visao/MolduraRelatorio";
import { Simbolo } from "@/design/marca/Simbolo";
import { formatarData } from "@/i18n/formatar";
import { relatoriosApi, type RelatorioPartilhado as Relatorio } from "@/lib/apiClient";

/**
 * O que o médico abre a partir do link que a família lhe enviou (Fase B).
 * Público, sem sessão; só leitura. Não entra no sitemap e pede aos motores de
 * busca para não indexar (dados de saúde, muitas vezes de crianças).
 *
 * A barra de cima diz de onde vem e até quando o link vale; não sai no papel.
 */
const RelatorioPartilhado = () => {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [invalido, setInvalido] = useState(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let activo = true;
    const carregar = async () => {
      try {
        const r = await relatoriosApi.lerPartilhado(token);
        if (activo) setRelatorio(r);
      } catch {
        if (activo) setInvalido(true);
      }
    };
    void carregar();
    return () => {
      activo = false;
    };
  }, [token]);

  const esquerda = (
    <>
      <span className="w-8 shrink-0">
        <Simbolo fundo="claro" />
      </span>
      <p className="min-w-0 text-legenda text-tinta-suave">
        {relatorio ? t("Visao.partilhadoAviso", { expira: formatarData(relatorio.expira_em) }) : t("Visao.partilhadoMarca")}
      </p>
    </>
  );

  if (invalido) {
    return (
      <MolduraRelatorio esquerda={esquerda} podeImprimir={false}>
        <h1 className="text-titulo-m text-tinta">{t("Visao.partilhadoInvalidoTitulo")}</h1>
        <p className="mt-3 max-w-prose text-corpo text-tinta-suave">{t("Visao.partilhadoInvalidoTexto")}</p>
      </MolduraRelatorio>
    );
  }

  return (
    <MolduraRelatorio esquerda={esquerda} podeImprimir={!!relatorio}>
      {!relatorio ? (
        <p role="status" className="text-corpo text-tinta-suave">
          {t("Visao.partilhadoACarregar")}
        </p>
      ) : (
        <FolhaRelatorio>
          <CabecalhoRelatorio
            hoje={new Date(relatorio.gerado_em)}
            nome={relatorio.nome}
            olhoMaisFraco={relatorio.olho_mais_fraco}
            usaOculos={relatorio.usa_oculos}
          />
          <ConteudoRelatorio sessoes={relatorio.sessoes} hoje={new Date(relatorio.gerado_em)} />
        </FolhaRelatorio>
      )}
    </MolduraRelatorio>
  );
};

export default RelatorioPartilhado;

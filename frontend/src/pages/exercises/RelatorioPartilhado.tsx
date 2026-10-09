import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConteudoRelatorio, {
  CabecalhoRelatorio,
  FolhaRelatorio,
} from "@/components/visao/ConteudoRelatorio";
import { formatarData } from "@/i18n/formatar";
import {
  relatoriosApi,
  type RelatorioPartilhado as Relatorio,
} from "@/lib/apiClient";

/**
 * O que o médico abre a partir do link que a família lhe enviou (Fase B).
 * Público, sem sessão; só leitura. Não entra no sitemap e pede aos motores de
 * busca para não indexar (dados de saúde, muitas vezes de crianças).
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

  return (
    <div className="min-h-screen bg-background print:bg-white print:text-black">
      <div className="container mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
        {invalido ? (
          <div className="py-16 text-center">
            <h1 className="mb-2 text-xl font-bold text-foreground">
              {t("Visao.partilhadoInvalidoTitulo")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("Visao.partilhadoInvalidoTexto")}
            </p>
          </div>
        ) : !relatorio ? (
          <div className="h-60" aria-busy />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <p className="text-sm text-muted-foreground">
                {t("Visao.partilhadoAviso", {
                  expira: formatarData(relatorio.expira_em),
                })}
              </p>
              <Button
                onClick={() => window.print()}
                className="gap-2 bg-navy text-navy-foreground hover:bg-navy/90"
              >
                <Printer className="h-4 w-4" />
                {t("Visao.imprimir")}
              </Button>
            </div>
            <FolhaRelatorio>
              <CabecalhoRelatorio
                hoje={new Date(relatorio.gerado_em)}
                nome={relatorio.nome}
                olhoMaisFraco={relatorio.olho_mais_fraco}
                usaOculos={relatorio.usa_oculos}
              />
              <ConteudoRelatorio
                sessoes={relatorio.sessoes}
                hoje={new Date(relatorio.gerado_em)}
              />
            </FolhaRelatorio>
          </>
        )}
      </div>
    </div>
  );
};

export default RelatorioPartilhado;

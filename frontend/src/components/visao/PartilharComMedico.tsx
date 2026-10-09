import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { mensagemDeErroApi, relatoriosApi, type PartilhaRelatorio } from "@/lib/apiClient";

/**
 * Fase B (docs/ANALISE_EXERCICIOS.md; decisão do dono do projecto): o pai gera
 * um link só de leitura e envia-o ele próprio ao médico. O link só se mostra
 * uma vez (a API guarda só o hash); nunca se mostra "criado" antes de a API
 * responder.
 */
const PartilharComMedico = () => {
  const { t } = useTranslation();
  const [activas, setActivas] = useState<PartilhaRelatorio[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setActivas((await relatoriosApi.listarPartilhas()).filter((p) => p.activa));
    } catch {
      // A lista é secundária: sem ela, criar um link continua a funcionar.
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async () => {
    setErro(null);
    setCopiado(false);
    setACriar(true);
    try {
      const criada = await relatoriosApi.criarPartilha();
      setLink(`${window.location.origin}${localizar(`/relatorio-partilhado/${criada.token}`)}`);
      await carregar();
    } catch (e) {
      setLink(null);
      setErro(mensagemDeErroApi(e, t("Visao.partilhaErro")));
    } finally {
      setACriar(false);
    }
  };

  const revogar = async (id: string) => {
    setErro(null);
    try {
      await relatoriosApi.revogarPartilha(id);
      setActivas((xs) => xs.filter((p) => p.id !== id));
    } catch (e) {
      setErro(mensagemDeErroApi(e, t("Visao.partilhaErroRevogar")));
    }
  };

  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  const podePartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-5 print:hidden" aria-labelledby="partilha-titulo">
      <h2 id="partilha-titulo" className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground">
        <Link2 className="h-4 w-4 text-teal" aria-hidden />
        {t("Visao.partilhaTitulo")}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">{t("Visao.partilhaTexto")}</p>

      <Button onClick={() => void criar()} disabled={aCriar} className="bg-teal text-teal-foreground hover:bg-teal/90">
        {t("Visao.partilhaCriar")}
      </Button>

      {erro && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      {link && (
        <div className="mt-4 space-y-2 rounded-lg bg-muted/40 p-3" role="status">
          <p className="text-sm font-medium text-foreground">{t("Visao.partilhaCriado")}</p>
          <p className="break-all rounded bg-background px-2 py-1 font-mono text-xs text-foreground">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void copiar()} className="gap-1.5">
              {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copiado ? t("Visao.partilhaCopiado") : t("Visao.partilhaCopiar")}
            </Button>
            {podePartilhar && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => void navigator.share({ title: t("Visao.relatorioTitulo"), url: link }).catch(() => undefined)}
              >
                <Share2 className="h-4 w-4" aria-hidden />
                {t("Visao.partilhaEnviar")}
              </Button>
            )}
          </div>
        </div>
      )}

      <h3 className="mb-2 mt-5 text-sm font-semibold text-foreground">{t("Visao.partilhaActivos")}</h3>
      {activas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Visao.partilhaNenhum")}</p>
      ) : (
        <ul className="space-y-2">
          {activas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {t("Visao.partilhaValidoAte", { criado: formatarData(p.criado_em), expira: formatarData(p.expira_em) })}
              </span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void revogar(p.id)}>
                {t("Visao.partilhaRevogar")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PartilharComMedico;

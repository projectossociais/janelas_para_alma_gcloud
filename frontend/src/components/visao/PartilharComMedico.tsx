import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Share2 } from "lucide-react";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Cartao } from "@/design/componentes/Cartao";
import { LinhaCopiar } from "@/design/componentes/LinhaCopiar";
import { formatarData } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { mensagemDeErroApi, relatoriosApi, type PartilhaRelatorio } from "@/lib/apiClient";

/**
 * Fase B (docs/ANALISE_EXERCICIOS.md; decisão do dono do projecto): o pai gera
 * um link só de leitura e envia-o ele próprio ao médico. O link só se mostra
 * uma vez (a API guarda só o hash); nunca se mostra "criado" antes de a API
 * responder. Nunca se imprime (fica fora da folha do relatório).
 */
const PartilharComMedico = () => {
  const { t } = useTranslation();
  const [activas, setActivas] = useState<PartilhaRelatorio[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [aCriar, setACriar] = useState(false);
  const [aRevogar, setARevogar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
    setARevogar(id);
    try {
      await relatoriosApi.revogarPartilha(id);
      setActivas((xs) => xs.filter((p) => p.id !== id));
    } catch (e) {
      setErro(mensagemDeErroApi(e, t("Visao.partilhaErroRevogar")));
    } finally {
      setARevogar(null);
    }
  };

  const podePartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Cartao className="print:hidden">
      <section aria-labelledby="partilha-titulo">
        <h2 id="partilha-titulo" className="flex items-center gap-2 text-titulo-p text-tinta">
          <Link2 className="size-5 shrink-0 text-accao" aria-hidden />
          {t("Visao.partilhaTitulo")}
        </h2>
        <p className="mt-2 max-w-prose text-corpo text-tinta-suave">{t("Visao.partilhaTexto")}</p>

        <Botao className="mt-5" aCarregar={aCriar} onClick={() => void criar()}>
          {t("Visao.partilhaCriar")}
        </Botao>

        {erro && (
          <Aviso className="mt-4" variante="erro" anunciar>
            {erro}
          </Aviso>
        )}

        {link && (
          <div role="status" className="mt-5 rounded-cartao bg-sucesso-suave p-4">
            <p className="text-corpo font-medium text-tinta">{t("Visao.partilhaCriado")}</p>
            <LinhaCopiar
              rotulo={t("Visao.partilhaLink")}
              valor={link}
              quebra="qualquer"
              textos={{ copiar: t("Visao.partilhaCopiar"), copiado: t("Visao.partilhaCopiado") }}
            />
            {podePartilhar && (
              <Botao
                variante="secundario"
                onClick={() => void navigator.share({ title: t("Visao.relatorioTitulo"), url: link }).catch(() => undefined)}
              >
                <Share2 aria-hidden /> {t("Visao.partilhaEnviar")}
              </Botao>
            )}
          </div>
        )}

        <h3 className="mt-6 text-legenda font-medium uppercase tracking-wide text-tinta-suave">{t("Visao.partilhaActivos")}</h3>
        {activas.length === 0 ? (
          <p className="mt-2 text-corpo text-tinta-suave">{t("Visao.partilhaNenhum")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-linha">
            {activas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-corpo text-tinta">
                  {t("Visao.partilhaValidoAte", { criado: formatarData(p.criado_em), expira: formatarData(p.expira_em) })}
                </span>
                <Botao variante="fantasma" className="text-erro hover:bg-erro/10" aCarregar={aRevogar === p.id} onClick={() => void revogar(p.id)}>
                  {t("Visao.partilhaRevogar")}
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Cartao>
  );
};

export default PartilharComMedico;

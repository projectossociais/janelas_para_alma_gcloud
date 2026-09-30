import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CheckCircle2, Download, House, RotateCcw, ScanFace, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { cn } from "@/design/cn";
import { LayoutTarefa } from "@/design/layouts/LayoutTarefa";
import { formatarData, formatarDataHora } from "@/i18n/formatar";
import { localizar } from "@/i18n/rotas";
import { CHAVE_RESULTADO, lerResultadoGuardado, type Conclusao, type ResultadoGuardado } from "@/lib/rastreio/rastreio";
import { carregarImagemComoDataUrl, escreverRelatorioRastreio } from "@/lib/rastreio/relatorioRastreio";
import { textoDoScannerNoIdioma } from "@/services/api/screeningApi";

/**
 * Resultado do rastreio: o fim da tarefa, no mesmo arquétipo (docs/LAYOUTS.md
 * §2.3). Diz o que se encontrou em frases simples e dá **um** próximo passo
 * (docs/PESQUISA_UX.md §4.1). Revela-se com calma, sem celebração: é um
 * momento clínico.
 *
 * Três conclusões, todas decididas em `conclusaoDoRastreio` a partir do que a
 * análise mediu. A versão anterior mostrava quatro tipos de estrabismo que o
 * analisador nunca calcula, uma "confiança" que era a qualidade da fotografia
 * (92% inventado quando faltava), clínicas e preços escritos à mão, e
 * recomendava o Treino de Convergência, contra-indicado em parte de quem tem
 * estrabismo.
 */

const ASPECTO: Record<Conclusao, { Icone: LucideIcon; fundo: string; cor: string }> = {
  avaliacao: { Icone: Stethoscope, fundo: "bg-aviso-suave", cor: "text-aviso" },
  normal: { Icone: CheckCircle2, fundo: "bg-sucesso-suave", cor: "text-sucesso" },
  inconclusivo: { Icone: ScanFace, fundo: "bg-accao-suave", cor: "text-accao" },
};

const ScannerResultados = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const [erroPdf, setErroPdf] = useState(false);
  const logo = useRef<ReturnType<typeof carregarImagemComoDataUrl> | null>(null);

  useEffect(() => {
    const lido = lerResultadoGuardado(sessionStorage.getItem(CHAVE_RESULTADO));
    // Sem resultado (entrada directa, sessão nova): o sítio certo é o rastreio.
    if (!lido) navigate(localizar("/scanner"), { replace: true });
    else setResultado(lido);
  }, [navigate]);

  const descarregar = async () => {
    if (!resultado) return;
    setAGerar(true);
    setErroPdf(false);
    try {
      // Carregados só quando se pedem: o jsPDF é pesado e a maioria não descarrega.
      const [{ default: jsPDF }, { RelatorioPdf }] = await Promise.all([
        import("jspdf"),
        import("@/lib/relatorio/pdfRelatorio"),
      ]);
      logo.current ??= carregarImagemComoDataUrl(logoImg);
      const imagem = await logo.current.catch(() => null);
      const quando = formatarDataHora(resultado.data);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const r = new RelatorioPdf(doc);
      r.cabecalho(
        {
          organizacao: "Janelas Para a Alma",
          titulo: t("ResultadoRastreio.pdfTitulo"),
          subtitulo: t("ResultadoRastreio.pdfEmitido", { data: formatarDataHora(new Date()) }),
        },
        imagem,
      );
      r.paragrafo(t("ResultadoRastreio.pdfIntro"), { cinzento: true });
      escreverRelatorioRastreio(r, resultado, t, quando);
      r.rodape(t("ResultadoRastreio.pdfRodape"), (i, total) => t("ResultadoRastreio.pdfPagina", { i, total }));
      doc.save(`${t("ResultadoRastreio.pdfNomeFicheiro")}-${resultado.data.toISOString().slice(0, 10)}.pdf`);
    } catch {
      setErroPdf(true);
    } finally {
      setAGerar(false);
    }
  };

  const sair = () => navigate(localizar("/"));
  const comum = {
    tema: "claro" as const,
    passo: { actual: 4, total: 4, rotulo: t("ResultadoRastreio.passo") },
    sair: { rotulo: t("ResultadoRastreio.sair"), aoSair: sair },
    textoSaltar: t("ResultadoRastreio.saltar"),
  };

  if (!resultado) {
    return (
      <LayoutTarefa {...comum}>
        <p role="status" className="text-corpo text-tinta-suave">
          {t("ResultadoRastreio.aCarregar")}
        </p>
      </LayoutTarefa>
    );
  }

  const { conclusao, analise } = resultado;
  const { Icone, fundo, cor } = ASPECTO[conclusao];
  const nota = textoDoScannerNoIdioma(analise?.recomendacao);
  const consulta = localizar("/parceiros?agendar=optiotica");
  const rastreio = localizar("/scanner");

  // Um só próximo passo, em destaque; o resto fica abaixo, mais discreto.
  const accao =
    conclusao === "avaliacao" ? (
      <Botao asChild tamanho="g" larguraTotal>
        <Link to={consulta}>
          <CalendarCheck aria-hidden /> {t("ResultadoRastreio.marcarConsulta")}
        </Link>
      </Botao>
    ) : conclusao === "inconclusivo" ? (
      <Botao asChild tamanho="g" larguraTotal>
        <Link to={rastreio}>
          <RotateCcw aria-hidden /> {t("ResultadoRastreio.repetir")}
        </Link>
      </Botao>
    ) : (
      <Botao asChild tamanho="g" larguraTotal>
        <Link to={localizar(isLoggedIn ? "/dashboard" : "/")}>
          <House aria-hidden /> {t(isLoggedIn ? "ResultadoRastreio.minhaArea" : "ResultadoRastreio.voltarInicio")}
        </Link>
      </Botao>
    );

  const guardado = params.get("id")
    ? { variante: "sucesso" as const, texto: t("ResultadoRastreio.guardado") }
    : isLoggedIn
      ? { variante: "aviso" as const, texto: t("ResultadoRastreio.naoGuardadoConta") }
      : { variante: "info" as const, texto: t("ResultadoRastreio.naoGuardadoSemSessao") };

  return (
    <LayoutTarefa {...comum} accao={accao}>
      <span aria-hidden className={cn("flex size-12 items-center justify-center rounded-pilula", fundo, cor)}>
        <Icone className="size-6" />
      </span>
      <p className="mt-5 text-legenda font-medium text-tinta-suave">
        {t("ResultadoRastreio.cabecalho", { data: formatarData(resultado.data) })}
      </p>
      <h1 className="mt-1 text-titulo-m text-tinta">{t(`ResultadoRastreio.${conclusao}Titulo`)}</h1>
      <p className="mt-3 text-corpo text-tinta-suave">{t(`ResultadoRastreio.${conclusao}Texto`)}</p>
      {conclusao === "inconclusivo" && (
        <p className="mt-3 text-corpo text-tinta">{t("ResultadoRastreio.inconclusivoDica")}</p>
      )}

      {conclusao !== "inconclusivo" && (
        <Aviso
          className="mt-6"
          variante={conclusao === "avaliacao" ? "aviso" : "info"}
          titulo={t(`ResultadoRastreio.${conclusao}AvisoTitulo`)}
        >
          {t(`ResultadoRastreio.${conclusao}AvisoTexto`)}
        </Aviso>
      )}

      {nota && (
        <section aria-labelledby="nota-analise" className="mt-6">
          <h2 id="nota-analise" className="text-legenda font-medium text-tinta-suave">
            {t("ResultadoRastreio.notaAnalise")}
          </h2>
          <p className="mt-1 text-corpo text-tinta">{nota}</p>
        </section>
      )}

      {conclusao === "avaliacao" && (
        <section aria-labelledby="proximo-passo" className="mt-6 rounded-cartao border border-linha p-5">
          <h2 id="proximo-passo" className="text-legenda font-medium text-tinta-suave">
            {t("ResultadoRastreio.proximoPasso")}
          </h2>
          <p className="mt-2 text-titulo-p text-tinta">{t("ResultadoRastreio.consultaClinica")}</p>
          <p className="mt-1 text-corpo text-tinta-suave">{t("ResultadoRastreio.consultaDetalhe")}</p>
        </section>
      )}

      <div className="mt-8 flex flex-col items-start gap-1 border-t border-linha pt-6">
        <Botao variante="fantasma" className="-ml-5" aCarregar={aGerar} onClick={() => void descarregar()}>
          <Download aria-hidden /> {aGerar ? t("ResultadoRastreio.aPreparar") : t("ResultadoRastreio.descarregar")}
        </Botao>
        {conclusao === "normal" && (
          <Botao asChild variante="fantasma" className="-ml-5">
            <Link to={consulta}>
              <CalendarCheck aria-hidden /> {t("ResultadoRastreio.marcarMesmoAssim")}
            </Link>
          </Botao>
        )}
        {conclusao !== "inconclusivo" && (
          <Botao asChild variante="fantasma" className="-ml-5">
            <Link to={rastreio}>
              <RotateCcw aria-hidden /> {t("ResultadoRastreio.repetir")}
            </Link>
          </Botao>
        )}
      </div>
      {erroPdf && (
        <Aviso className="mt-4" variante="erro" anunciar>
          {t("ResultadoRastreio.erroPdf")}
        </Aviso>
      )}

      <Aviso className="mt-6" variante={guardado.variante}>
        {guardado.texto}
      </Aviso>
    </LayoutTarefa>
  );
};

export default ScannerResultados;

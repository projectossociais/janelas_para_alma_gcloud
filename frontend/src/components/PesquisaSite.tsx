import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { localizar } from "@/i18n/rotas";
import { pedirDadosDaApi, type DadosDaApi } from "@/lib/pesquisa/dadosDaApi";
import { SUGESTOES, entradasDaApi, entradasDoSite } from "@/lib/pesquisa/indiceSite";
import { prepararIndice, procurar, realcar, type EntradaPesquisa, type ResultadoPesquisa } from "@/lib/pesquisa/procurar";

const Realce = ({ texto, consulta }: { texto: string; consulta: string }) => (
  <>
    {realcar(texto, consulta).map((p, i) =>
      p.forte ? (
        <mark key={i} className="bg-transparent font-semibold text-primary">
          {p.texto}
        </mark>
      ) : (
        <span key={i}>{p.texto}</span>
      ),
    )}
  </>
);

interface PesquisaSiteProps {
  aberta: boolean;
  onMudar: (aberta: boolean) => void;
}

/**
 * A lupa do cabeçalho: procura em todo o site (páginas e o texto delas,
 * exercícios, perguntas frequentes, publicações e clínicas parceiras).
 * O índice e as regras vivem em `lib/pesquisa/`; aqui é só o painel.
 * Abre também com Ctrl+K / Cmd+K; setas e Enter escolhem um resultado.
 */
const PesquisaSite = ({ aberta, onMudar }: PesquisaSiteProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [consulta, setConsulta] = useState("");
  const [activo, setActivo] = useState(-1);
  const [daApi, setDaApi] = useState<DadosDaApi | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const idLista = useId();

  useEffect(() => {
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onMudar(true);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onMudar]);

  // Publicações e clínicas só se pedem quando a pesquisa abre.
  useEffect(() => {
    if (!aberta) return;
    let cancelado = false;
    void pedirDadosDaApi().then((dados) => {
      if (!cancelado) setDaApi(dados);
    });
    return () => {
      cancelado = true;
    };
  }, [aberta]);

  const papel = user?.role ?? null;
  const idioma = i18n.language;
  const entradas = useMemo(
    () => [
      ...entradasDoSite(t, { comSessao: isLoggedIn, papel }),
      ...(daApi ? entradasDaApi(t, daApi) : []),
    ],
    // `idioma` entra de propósito: o texto do índice muda com o idioma da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, idioma, isLoggedIn, papel, daApi],
  );
  const indice = useMemo(() => prepararIndice(entradas), [entradas]);

  const aProcurar = consulta.trim() !== "";
  const resultados = useMemo<ResultadoPesquisa[]>(() => procurar(indice, consulta), [indice, consulta]);
  const sugestoes = useMemo<ResultadoPesquisa[]>(
    () =>
      SUGESTOES.flatMap((id) => {
        const entrada = entradas.find((e) => e.id === id);
        return entrada ? [{ entrada, pontos: 0 }] : [];
      }),
    [entradas],
  );
  const semResultados = aProcurar && resultados.length === 0;
  const visiveis = aProcurar && !semResultados ? resultados : sugestoes;

  // Com resultados, o primeiro fica logo escolhido (Enter abre-o). Nas sugestões
  // nada fica escolhido: Enter não leva a uma página que a pessoa não pediu.
  const comResultados = aProcurar && !semResultados;
  useEffect(() => setActivo(comResultados ? 0 : -1), [consulta, comResultados]);
  const escolhidoEm = activo < visiveis.length ? activo : -1;
  useEffect(() => {
    lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [activo]);

  const fechar = () => {
    onMudar(false);
    setConsulta("");
  };

  const abrir = (entrada: EntradaPesquisa) => {
    fechar();
    // O ScrollToTop leva à secção pela âncora, também na mesma página.
    navigate(entrada.caminho);
  };

  const aoTeclarCampo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!visiveis.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => (a + 1) % visiveis.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (a <= 0 ? visiveis.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      const escolhido = visiveis[escolhidoEm];
      if (!escolhido) return;
      e.preventDefault();
      abrir(escolhido.entrada);
    }
  };

  const idOpcao = (i: number) => `${idLista}-opcao-${i}`;
  const estado = !aProcurar
    ? ""
    : semResultados
      ? t("Pesquisa.semResultados", { consulta: consulta.trim() })
      : resultados.length === 1
        ? t("Pesquisa.umResultado")
        : t("Pesquisa.variosResultados", { n: resultados.length });

  return (
    <Dialog open={aberta} onOpenChange={(a) => (a ? onMudar(true) : fechar())}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pb-3 pt-6 text-left">
          <DialogTitle className="flex items-center gap-3">
            <Search className="h-5 w-5 text-teal" aria-hidden="true" />
            {t("Pesquisa.titulo")}
          </DialogTitle>
          <DialogDescription>{t("Pesquisa.descricao")}</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3">
          <div className="relative">
            <input
              ref={campo}
              type="text"
              role="combobox"
              aria-expanded={visiveis.length > 0}
              aria-controls={idLista}
              aria-activedescendant={escolhidoEm >= 0 ? idOpcao(escolhidoEm) : undefined}
              aria-autocomplete="list"
              aria-label={t("Navbar.pesquisar")}
              placeholder={t("Pesquisa.oQueProcura")}
              autoFocus
              autoComplete="off"
              enterKeyHint="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={aoTeclarCampo}
              className="h-11 w-full rounded-md border border-input bg-background px-3 pr-10 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {consulta && (
              <button
                type="button"
                onClick={() => {
                  setConsulta("");
                  campo.current?.focus();
                }}
                aria-label={t("Pesquisa.limpar")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {semResultados ? "" : estado}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {semResultados && (
            <div role="status" className="px-3 pb-3 pt-2 text-sm">
              <p className="font-medium text-foreground">{t("Pesquisa.semResultados", { consulta: consulta.trim() })}</p>
              <p className="mt-1 text-muted-foreground">{t("Pesquisa.semResultadosAjuda")}</p>
            </div>
          )}

          <p className="flex items-baseline justify-between px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{comResultados ? t("Pesquisa.resultados") : t("Pesquisa.sugestoes")}</span>
            {comResultados && <span className="font-normal normal-case tracking-normal">{estado}</span>}
          </p>

          <div ref={lista} id={idLista} role="listbox" aria-label={t("Pesquisa.resultados")}>
            {visiveis.map(({ entrada, excerto }, i) => {
              const escolhido = i === escolhidoEm;
              const linha = excerto ?? entrada.descricao;
              return (
                <div
                  key={entrada.id}
                  id={idOpcao(i)}
                  role="option"
                  aria-selected={escolhido}
                  onClick={() => abrir(entrada)}
                  onMouseMove={() => setActivo(i)}
                  className={`group flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    escolhido ? "bg-muted" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground" lang={entrada.lang !== idioma ? entrada.lang : undefined}>
                      <Realce texto={entrada.titulo} consulta={consulta} />
                    </p>
                    {linha && (
                      <p
                        className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
                        lang={entrada.lang !== idioma ? entrada.lang : undefined}
                      >
                        <Realce texto={linha} consulta={consulta} />
                      </p>
                    )}
                  </div>
                  <span className="mt-0.5 shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t(`Pesquisa.tipo.${entrada.tipo}`)}
                  </span>
                  <ArrowRight
                    className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-opacity ${
                      escolhido ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>

          {daApi?.incompleto && <p className="px-3 pt-3 text-xs text-muted-foreground">{t("Pesquisa.semPublicacoes")}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-6 py-3 text-xs text-muted-foreground">
          <Link to={localizar("/junte-se#contacto")} onClick={fechar} className="font-medium text-primary hover:underline">
            {t("Pesquisa.falarConnosco")}
          </Link>
          <span className="hidden sm:inline">{t("Pesquisa.atalhos")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PesquisaSite;

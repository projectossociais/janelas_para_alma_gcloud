import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarPlus, CheckCircle2, Eye, Loader2, RotateCcw } from "lucide-react";
import { Botao } from "@/design/componentes/Botao";
import { localizar } from "@/i18n/rotas";
import type { EstadoGravacao } from "@/components/visao/hooks";
import { cn } from "@/lib/utils";

export type EstadoOlho = "ok" | "sinal" | "indeterminado";

/** Cartão de resultado de um olho (ou "ambos"), com um ícone de estado. */
export const CartaoOlho = ({
  titulo,
  estado,
  children,
}: {
  titulo: string;
  estado: EstadoOlho;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const Icone = estado === "ok" ? CheckCircle2 : estado === "sinal" ? AlertTriangle : Eye;
  const rotulo =
    estado === "ok" ? t("Visao.estadoOk") : estado === "sinal" ? t("Visao.estadoSinal") : t("Visao.estadoIndeterminado");
  return (
    <article
      className={cn(
        "flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 text-center",
        estado === "ok" && "border-linha bg-sucesso-suave",
        estado === "sinal" && "border-linha bg-aviso-suave",
        estado === "indeterminado" && "border-border bg-muted/30",
      )}
    >
      <Icone
        className={cn("h-8 w-8", estado === "ok" ? "text-sucesso" : estado === "sinal" ? "text-aviso" : "text-muted-foreground")}
        aria-hidden
      />
      <h3 className="font-semibold text-foreground">{titulo}</h3>
      <p className="sr-only">{rotulo}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </article>
  );
};

/** Estado da gravação da sessão -- nunca "guardado" antes da resposta da API. */
export const EstadoDaGravacao = ({ estado, aoTentarDeNovo }: { estado: EstadoGravacao; aoTentarDeNovo: () => void }) => {
  const { t } = useTranslation();
  if (estado === "a_gravar")
    return (
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Visao.aGuardar")}
      </p>
    );
  if (estado === "gravado") return <p className="text-center text-xs text-muted-foreground">{t("Visao.guardadoNoHistorico")}</p>;
  if (estado === "erro")
    return (
      <div className="flex flex-col items-center gap-2 text-center text-xs text-destructive" role="alert">
        <p>{t("Visao.erroAGuardar")}</p>
        <Botao variante="secundario" onClick={aoTentarDeNovo} >
          <RotateCcw className="h-3.5 w-3.5" /> {t("Visao.tentarDeNovo")}
        </Botao>
      </div>
    );
  return null;
};

/** Fim de um teste: cartões por olho, sinais, "Marcar consulta". */
export const EcraResultado = ({
  titulo,
  cartoes,
  sinais,
  notas,
  gravacao,
  aoTentarDeNovo,
  accoesExtra,
}: {
  titulo: string;
  cartoes: ReactNode;
  sinais: string[];
  notas?: ReactNode;
  gravacao: EstadoGravacao;
  aoTentarDeNovo: () => void;
  accoesExtra?: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-5">
      <h2 className="text-center text-xl font-bold text-foreground">{titulo}</h2>
      <div className="flex flex-col gap-3 sm:flex-row">{cartoes}</div>
      {sinais.length > 0 ? (
        <div className="rounded-xl border border-linha bg-aviso-suave p-4 text-sm text-foreground" role="status">
          <p className="mb-1 font-semibold">{t("Visao.sinaisTitulo")}</p>
          <ul className="list-disc space-y-1 pl-5">
            {sinais.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t("Visao.sinalNaoDiagnostica")}</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t("Visao.semSinais")}</p>
      )}
      {notas}
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Botao asChild tamanho="g" className="w-full sm:w-auto">
          <Link to={localizar("/marcar-consulta")}>
            <CalendarPlus className="h-4 w-4" />
            {t("Visao.marcarConsulta")}
          </Link>
        </Botao>
        {accoesExtra}
        <Botao asChild variante="secundario" tamanho="g" className="w-full sm:w-auto">
          <Link to={localizar("/exercicios")}>{t("Visao.voltarAosExercicios")}</Link>
        </Botao>
      </div>
      <EstadoDaGravacao estado={gravacao} aoTentarDeNovo={aoTentarDeNovo} />
    </section>
  );
};

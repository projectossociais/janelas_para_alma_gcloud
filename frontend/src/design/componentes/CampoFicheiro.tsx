import { useId, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { AlertCircle, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "../cn";
import { Botao } from "./Botao";

/**
 * Anexar **um** ficheiro (ex.: o comprovativo de pagamento). Um botão grande
 * "Escolher ficheiro" que funciona com o teclado e no telemóvel (abre a galeria
 * ou a câmara), e a mesma zona aceita um ficheiro largado em cima no computador.
 *
 * Valida o tipo e o tamanho aqui, antes de qualquer envio, e diz porquê no
 * próprio campo, com ícone e texto (nunca só a cor e nunca num aviso que passa).
 * Quem o usa continua a validar a sério no servidor.
 *
 * Sem ficheiro: botão e ajuda. Com ficheiro: nome, tamanho e "Remover".
 */
export interface CampoFicheiroProps {
  rotulo: ReactNode;
  ajuda?: ReactNode;
  /** Erro de quem usa o campo (ex.: "Anexe o comprovativo."). */
  erro?: ReactNode;
  ficheiro: File | null;
  aoMudar: (ficheiro: File | null) => void;
  tiposAceites: readonly string[];
  tamanhoMaximoBytes: number;
  textos: {
    escolher: string;
    trocar: string;
    remover: (nome: string) => string;
    erroTipo: string;
    erroTamanho: string;
    tamanho: (kb: number) => string;
  };
  className?: string;
}

export const CampoFicheiro = ({
  rotulo,
  ajuda,
  erro,
  ficheiro,
  aoMudar,
  tiposAceites,
  tamanhoMaximoBytes,
  textos,
  className,
}: CampoFicheiroProps) => {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [aArrastar, setAArrastar] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const tentar = (candidato: File | undefined | null) => {
    if (!candidato) return;
    if (!tiposAceites.includes(candidato.type)) return setErroLocal(textos.erroTipo);
    if (candidato.size > tamanhoMaximoBytes) return setErroLocal(textos.erroTamanho);
    setErroLocal(null);
    aoMudar(candidato);
  };

  const aoEscolher = (e: ChangeEvent<HTMLInputElement>) => {
    tentar(e.target.files?.[0]);
    e.target.value = ""; // deixa escolher o mesmo ficheiro outra vez
  };

  const aoLargar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setAArrastar(false);
    tentar(e.dataTransfer.files?.[0]);
  };

  const mensagem = erroLocal ?? erro;
  const idErro = mensagem ? `${id}-erro` : undefined;
  const idAjuda = ajuda ? `${id}-ajuda` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={`${id}-rotulo`} className="text-corpo font-medium text-tinta">
        {rotulo}
      </span>
      {ajuda && (
        <p id={idAjuda} className="text-legenda text-tinta-suave">
          {ajuda}
        </p>
      )}
      {mensagem && (
        <p id={idErro} className="flex items-start gap-1.5 text-legenda font-medium text-erro">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{mensagem}</span>
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setAArrastar(true);
        }}
        onDragLeave={() => setAArrastar(false)}
        onDrop={aoLargar}
        className={cn(
          "rounded-controlo border-2 border-dashed p-4 transition-colors duration-feedback ease-padrao",
          aArrastar ? "border-accao bg-accao-suave" : "border-linha-forte bg-superficie",
          mensagem && "border-erro",
        )}
      >
        {/* O campo é nativo e fica por baixo do botão: o teclado e o leitor de ecrã usam-no directamente. */}
        <input
          ref={entrada}
          id={id}
          type="file"
          accept={tiposAceites.join(",")}
          onChange={aoEscolher}
          aria-labelledby={`${id}-rotulo`}
          aria-describedby={[idAjuda, idErro].filter(Boolean).join(" ") || undefined}
          aria-invalid={mensagem ? true : undefined}
          className="sr-only"
        />
        {ficheiro ? (
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-pilula bg-superficie-alt text-accao">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-corpo font-medium text-tinta">{ficheiro.name}</p>
              <p className="text-legenda text-tinta-suave">{textos.tamanho(Math.max(1, Math.round(ficheiro.size / 1024)))}</p>
            </div>
            <Botao
              type="button"
              variante="fantasma"
              className="px-3"
              aria-label={textos.remover(ficheiro.name)}
              onClick={() => aoMudar(null)}
            >
              <X />
            </Botao>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span aria-hidden className="flex size-12 items-center justify-center rounded-pilula bg-superficie-alt text-accao">
              <UploadCloud className="size-6" />
            </span>
            <Botao type="button" variante="secundario" onClick={() => entrada.current?.click()}>
              {textos.escolher}
            </Botao>
          </div>
        )}
        {ficheiro && (
          <Botao type="button" variante="fantasma" className="mt-3 w-full" onClick={() => entrada.current?.click()}>
            {textos.trocar}
          </Botao>
        )}
      </div>
    </div>
  );
};

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CopyRowProps {
  label: string;
  value: string;
  /** Texto mostrado em vez de `value` (ex.: uma versão ofuscada) -- o valor
   * copiado para a área de transferência continua a ser sempre `value`. */
  displayValue?: string;
}

/** Linha de dado bancário com botão "Copiar" -- partilhada entre qualquer
 * fluxo de pagamento manual (doações, checkout Premium). */
const CopyRow = ({ label, value, displayValue }: CopyRowProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-semibold text-foreground break-all">{displayValue ?? value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? t("CopyRow.copiado") : t("CopyRow.copiar")}
      </button>
    </div>
  );
};

export default CopyRow;

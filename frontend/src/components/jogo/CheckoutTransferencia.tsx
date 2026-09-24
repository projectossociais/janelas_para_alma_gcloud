import { useTranslation } from "react-i18next";
import CopyRow from "@/components/CopyRow";
import FileDropzone from "@/components/FileDropzone";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";

interface CheckoutTransferenciaProps {
  comprovativo: File | null;
  onComprovativo: (ficheiro: File | null) => void;
}

/** Dados bancários (os mesmos do Premium e das doações) + comprovativo. */
const CheckoutTransferencia = ({ comprovativo, onComprovativo }: CheckoutTransferenciaProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{t("LojaJogo.n1Transfira")}</p>
        <div className="rounded-lg border border-navy/20 bg-navy/5 p-4 space-y-1 divide-y divide-navy/10">
          <CopyRow label={t("LojaJogo.beneficiario")} value={DEFAULT_BANK_DATA.beneficiario} />
          <CopyRow
            label={DEFAULT_BANK_DATA.pagamento_rapido.metodo}
            value={DEFAULT_BANK_DATA.pagamento_rapido.telefone}
            displayValue={ofuscarValor(DEFAULT_BANK_DATA.pagamento_rapido.telefone)}
          />
          <CopyRow
            label={`IBAN ${DEFAULT_BANK_DATA.transferencia_nacional.banco}`}
            value={DEFAULT_BANK_DATA.transferencia_nacional.iban}
            displayValue={ofuscarValor(DEFAULT_BANK_DATA.transferencia_nacional.iban)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {t("LojaJogo.n2AnexeOComprovativo")}
        </p>
        <FileDropzone file={comprovativo} onFileChange={onComprovativo} />
      </div>
      <p className="text-xs text-muted-foreground">{t("LojaJogo.creditadoAposConfirmacao")}</p>
    </div>
  );
};

export default CheckoutTransferencia;

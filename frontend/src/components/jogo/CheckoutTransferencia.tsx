import { useTranslation } from "react-i18next";
import { CampoFicheiro } from "@/design/componentes/CampoFicheiro";
import { LinhaCopiar } from "@/design/componentes/LinhaCopiar";
import { TIPOS_DE_COMPROVATIVO_ACEITES, type TipoItemLoja } from "@/lib/apiClient";
import { DEFAULT_BANK_DATA, ofuscarValor } from "@/lib/pagamento";

/** O mesmo limite do comprovativo do Premium. */
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

interface CheckoutTransferenciaProps {
  /** O que se está a comprar: o texto final diz o que chega depois de confirmado. */
  tipo: TipoItemLoja;
  comprovativo: File | null;
  onComprovativo: (ficheiro: File | null) => void;
}

/**
 * Dados bancários (os mesmos do Premium e das doações) + comprovativo, com os
 * mesmos componentes do Premium (`LinhaCopiar`, `CampoFicheiro`).
 */
const CheckoutTransferencia = ({ tipo, comprovativo, onComprovativo }: CheckoutTransferenciaProps) => {
  const { t } = useTranslation();
  const textosCopiar = { copiar: t("LojaJogo.copiar"), copiado: t("LojaJogo.copiado") };
  return (
    <div>
      <p className="text-legenda font-medium text-tinta-suave">{t("LojaJogo.n1Transfira")}</p>
      <div className="mt-2 divide-y divide-linha rounded-controlo border border-linha px-4">
        <LinhaCopiar rotulo={t("LojaJogo.beneficiario")} valor={DEFAULT_BANK_DATA.beneficiario} textos={textosCopiar} />
        <LinhaCopiar
          rotulo={DEFAULT_BANK_DATA.pagamento_rapido.metodo}
          valor={DEFAULT_BANK_DATA.pagamento_rapido.telefone}
          mostrado={ofuscarValor(DEFAULT_BANK_DATA.pagamento_rapido.telefone)}
          textos={textosCopiar}
        />
        <LinhaCopiar
          rotulo={`IBAN ${DEFAULT_BANK_DATA.transferencia_nacional.banco}`}
          valor={DEFAULT_BANK_DATA.transferencia_nacional.iban}
          mostrado={ofuscarValor(DEFAULT_BANK_DATA.transferencia_nacional.iban)}
          textos={textosCopiar}
        />
      </div>

      <CampoFicheiro
        className="mt-6"
        rotulo={t("LojaJogo.n2AnexeOComprovativo")}
        ajuda={t("LojaJogo.comprovativoAjuda")}
        ficheiro={comprovativo}
        aoMudar={onComprovativo}
        tiposAceites={TIPOS_DE_COMPROVATIVO_ACEITES}
        tamanhoMaximoBytes={TAMANHO_MAXIMO_BYTES}
        textos={{
          escolher: t("LojaJogo.escolherFicheiro"),
          trocar: t("LojaJogo.trocarFicheiro"),
          remover: (nome) => t("LojaJogo.removerFicheiro", { nome }),
          erroTipo: t("LojaJogo.erroTipo"),
          erroTamanho: t("LojaJogo.erroTamanho"),
          tamanho: (kb) => t("LojaJogo.tamanhoKb", { kb }),
        }}
      />

      <p className="mt-4 text-legenda text-tinta-suave">
        {tipo === "moedas" ? t("LojaJogo.moedasCreditadasAposConfirmacao") : t("LojaJogo.creditadoAposConfirmacao")}
      </p>
    </div>
  );
};

export default CheckoutTransferencia;

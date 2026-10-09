import { Trans, useTranslation } from "react-i18next";
import NotaTraducaoLegal from "@/components/NotaTraducaoLegal";
import { Aviso } from "@/design/componentes/Aviso";
import { Documento, type SeccaoDocumento } from "@/design/layouts/Documento";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

/** As secções dos termos, no arquétipo Documento. O texto legal não muda aqui -- só se lê melhor. */
const SECCOES: SeccaoDocumento[] = [
  {
    id: "seccao-1",
    get titulo() {
      return i18n.t("TermosUtilizacao.n1IdentificacaoENatureza");
    },
    corpo: (
      <p>
      <Trans i18nKey="TermosUtilizacao.oJanelasParaA" components={{ strong: <strong /> }} />
      </p>
    ),
  },
  {
    id: "seccao-2",
    get titulo() {
      return i18n.t("TermosUtilizacao.n2AceitacaoDosTermos");
    },
    corpo: (
      <p>
      <Trans i18nKey="TermosUtilizacao.aoAcederEUtilizar" components={{ strong: <strong /> }} />
      </p>
    ),
  },
  {
    id: "seccao-3",
    get titulo() {
      return i18n.t("TermosUtilizacao.n3UtilizacaoDaPlataforma");
    },
    corpo: (
      <>
      <p>
      <Trans i18nKey="TermosUtilizacao.aPlataformaDestinaSe" />
      </p>
      <ul>
      <li><Trans i18nKey="TermosUtilizacao.terDezoitoAnos" /></li>
      <li><Trans i18nKey="TermosUtilizacao.fornecerInformacaoVerdadeiraE" /></li>
      <li><Trans i18nKey="TermosUtilizacao.naoUtilizarAPlataforma" /></li>
      <li><Trans i18nKey="TermosUtilizacao.naoTentarAcederIndevidamente" /></li>
      <li><Trans i18nKey="TermosUtilizacao.manterAConfidencialidadeDas" /></li>
      </ul>
      </>
    ),
  },
  {
    id: "seccao-4",
    get titulo() {
      return i18n.t("TermosUtilizacao.n4PropriedadeIntelectual");
    },
    corpo: (
      <p>
      <Trans i18nKey="TermosUtilizacao.todosOsConteudosDisponibilizados" components={{ strong: <strong /> }} />
      </p>
    ),
  },
  {
    id: "seccao-5",
    get titulo() {
      return i18n.t("TermosUtilizacao.n5AvisoMedicoLegal");
    },
    corpo: (
      // Aviso médico-legal: em destaque, como o aviso dos resultados do rastreio.
      <Aviso variante="aviso">
        <Trans i18nKey="TermosUtilizacao.oRastreioDigitalDe" components={{ strong: <strong /> }} />
      </Aviso>
    ),
  },
  {
    id: "seccao-6",
    get titulo() {
      return i18n.t("TermosUtilizacao.n6LimitacaoDeResponsabilidade");
    },
    corpo: (
      <>
        <p>{i18n.t("TermosUtilizacao.oJanelasParaA2")}</p>
        <p>
          <Trans i18nKey="TermosUtilizacao.estaLimitacaoNaoPrejudica" components={{ strong: <strong /> }} />
        </p>
      </>
    ),
  },
  {
    id: "seccao-7",
    get titulo() {
      return i18n.t("TermosUtilizacao.n7AlteracoesAosTermos");
    },
    corpo: (
      <p>{i18n.t("TermosUtilizacao.oJanelasParaA3")}</p>
    ),
  },
  {
    id: "seccao-8",
    get titulo() {
      return i18n.t("TermosUtilizacao.n8LeiAplicavelE");
    },
    corpo: (
      <p>{i18n.t("TermosUtilizacao.estesTermosDeUtilizacao")}</p>
    ),
  },
  {
    id: "seccao-9",
    get titulo() {
      return i18n.t("TermosUtilizacao.n9Contacto");
    },
    corpo: (
      <p>
        <Trans
          i18nKey="TermosUtilizacao.paraQualquerQuestaoSobre"
          components={{ a: <a href="mailto:janelasparaalma18@gmail.com" />, a2: <a href={localizar("/politica-de-privacidade")} />, a3: <a href={localizar("/faq")} /> }}
        />
      </p>
    ),
  },
];

const TermosUtilizacao = () => {
  const { t } = useTranslation();
  return (
    <Documento
      titulo={t("TermosUtilizacao.termosDeUtilizacao")}
      introducao={t("TermosUtilizacao.asRegrasQueRegem")}
      nota={<NotaTraducaoLegal />}
      rotuloIndice={t("legal.nestaPagina")}
      seccoes={SECCOES}
      rodape={<Trans i18nKey="TermosUtilizacao.ultimaActualizacaoSetembroDe" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" /> }} />}
    />
  );
};

export default TermosUtilizacao;

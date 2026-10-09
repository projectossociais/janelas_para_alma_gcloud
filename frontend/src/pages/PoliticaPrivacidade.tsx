import { Trans, useTranslation } from "react-i18next";
import NotaTraducaoLegal from "@/components/NotaTraducaoLegal";
import { Aviso } from "@/design/componentes/Aviso";
import { Documento, type SeccaoDocumento } from "@/design/layouts/Documento";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

/** As secções da política, no arquétipo Documento. O texto legal não muda aqui -- só se lê melhor. */
const SECCOES: SeccaoDocumento[] = [
  {
    id: "seccao-1",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n1IdentificacaoDoResponsavel");
    },
    corpo: (
      <>
      <p>
      <Trans i18nKey="PoliticaPrivacidade.oJanelasParaA" components={{ strong: <strong /> }} />
      </p>
      <p>
      <Trans i18nKey="PoliticaPrivacidade.paraQualquerQuestaoRelativa" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" /> }} />
      </p>
      </>
    ),
  },
  {
    id: "seccao-2",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n2BaseLegal");
    },
    corpo: (
      <>
      <p>
      <Trans i18nKey="PoliticaPrivacidade.oTratamentoDeDados" components={{ strong: <strong /> }} />
      </p>
      <p>
      <Trans i18nKey="PoliticaPrivacidade.nosTermosDoArtigo" components={{ strong: <strong /> }} />
      </p>
      <p>
      <Trans i18nKey="PoliticaPrivacidade.menores" components={{ strong: <strong /> }} />
      </p>
      </>
    ),
  },
  {
    id: "seccao-3",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n3DadosPessoaisRecolhidos");
    },
    corpo: (
      <>
      <p><Trans i18nKey="PoliticaPrivacidade.consoanteAFormaComo" /></p>
      <ul>
      <li><Trans i18nKey="PoliticaPrivacidade.dadosDeIdentificacaoE" /></li>
      <li><Trans i18nKey="PoliticaPrivacidade.dadosDeContaCredenciais" /></li>
      <li>
      <Trans i18nKey="PoliticaPrivacidade.dadosDeSaudeE" components={{ strong: <strong /> }} />
      </li>
      <li><Trans i18nKey="PoliticaPrivacidade.dadosDeNavegacaoE" /></li>
      </ul>
      <Aviso variante="aviso" className="mt-4"><Trans i18nKey="PoliticaPrivacidade.osDadosDeSaude" components={{ strong: <strong /> }} /></Aviso>
      </>
    ),
  },
  {
    id: "seccao-4",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n4FinalidadeDoTratamento");
    },
    corpo: (
      <>
      <p><Trans i18nKey="PoliticaPrivacidade.osDadosRecolhidosSao" /></p>
      <ul>
      <li><Trans i18nKey="PoliticaPrivacidade.personalizarASuaExperiencia" /></li>
      <li>
      <Trans i18nKey="PoliticaPrivacidade.estabelecerALigacaoA" components={{ strong: <strong /> }} />
      </li>
      <li><Trans i18nKey="PoliticaPrivacidade.enviarComunicacoesRelevantesSobre" /></li>
      <li><Trans i18nKey="PoliticaPrivacidade.cumprirObrigacoesLegaisE" /></li>
      </ul>
      </>
    ),
  },
  {
    id: "seccao-5",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n5PartilhaDeDados");
    },
    corpo: (
      <p>
      <Trans i18nKey="PoliticaPrivacidade.naoVendemosNemCedemos" />
      </p>
    ),
  },
  {
    id: "seccao-6",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n6TransferenciaInternacionalDe");
    },
    corpo: (
      <p>
      <Trans i18nKey="PoliticaPrivacidade.aInfraEstruturaTecnica" components={{ strong: <strong /> }} />
      </p>
    ),
  },
  {
    id: "seccao-7",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n7OsSeusDireitos");
    },
    corpo: (
      <>
      <p><Trans i18nKey="PoliticaPrivacidade.nosTermosDaLei" /></p>
      <ul>
      <li><Trans i18nKey="PoliticaPrivacidade.informacaoArtigo25Ser" components={{ strong: <strong /> }} /></li>
      <li><Trans i18nKey="PoliticaPrivacidade.acessoArtigo26Obter" components={{ strong: <strong /> }} /></li>
      <li><Trans i18nKey="PoliticaPrivacidade.oposicaoArtigo27Opor" components={{ strong: <strong /> }} /></li>
      <li><Trans i18nKey="PoliticaPrivacidade.rectificacaoActualizacaoEEliminacao" components={{ strong: <strong /> }} /></li>
      <li><Trans i18nKey="PoliticaPrivacidade.retiradaDoConsentimentoA" components={{ strong: <strong /> }} /></li>
      <li>
      <Trans i18nKey="PoliticaPrivacidade.portabilidadeAindaQueA" components={{ strong: <strong /> }} />
      </li>
      </ul>
      <p>
      <Trans i18nKey="PoliticaPrivacidade.podeExercerEstesDireitos" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" /> }} />
      </p>
      </>
    ),
  },
  {
    id: "seccao-8",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n8EntidadeDeSupervisao");
    },
    corpo: (
      <p>
      <Trans i18nKey="PoliticaPrivacidade.aAutoridadeDeControlo" components={{ strong: <strong /> }} />
      </p>
    ),
  },
  {
    id: "seccao-9",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n9SegurancaDaInformacao");
    },
    corpo: (
      <p>
      <Trans i18nKey="PoliticaPrivacidade.nosTermosDoArtigo2" components={{ strong: <strong /> }} />
      </p>
    ),
  },
  {
    id: "seccao-10",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n10ConservacaoDeDados");
    },
    corpo: (
      <p>
      <Trans i18nKey="PoliticaPrivacidade.conservamosOsSeusDados" components={{ strong: <strong /> }} />
      </p>
    ),
  },
  {
    id: "seccao-11",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n11Cookies");
    },
    corpo: (
      <p>
      <Trans i18nKey="PoliticaPrivacidade.esteWebsiteUtilizaCookies" />
      </p>
    ),
  },
  {
    id: "seccao-12",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n12AlteracoesAEsta");
    },
    corpo: (
      <p>
      <Trans i18nKey="PoliticaPrivacidade.podemosReverEActualizar" />
      </p>
    ),
  },
  {
    id: "seccao-13",
    get titulo() {
      return i18n.t("PoliticaPrivacidade.n13Contacto");
    },
    corpo: (
      <p>
        <Trans i18nKey="PoliticaPrivacidade.paraExercerOsSeus" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" />, a2: <a href={localizar("/faq")} /> }} />
      </p>
    ),
  },
];

const PoliticaPrivacidade = () => {
  const { t } = useTranslation();
  return (
    <Documento
      titulo={t("PoliticaPrivacidade.politicaDePrivacidade")}
      introducao={t("PoliticaPrivacidade.oNossoCompromissoCom")}
      nota={<NotaTraducaoLegal />}
      rotuloIndice={t("legal.nestaPagina")}
      seccoes={SECCOES}
      rodape={<Trans i18nKey="PoliticaPrivacidade.ultimaActualizacaoSetembroDe" components={{ a: <a href="mailto:janelasparaalma18@gmail.com" /> }} />}
    />
  );
};

export default PoliticaPrivacidade;

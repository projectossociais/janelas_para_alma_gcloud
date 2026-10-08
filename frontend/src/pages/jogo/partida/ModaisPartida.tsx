import { Home, Loader2, RefreshCw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";
import { OPCOES, TOTAL_PATAMARES } from "../jogoConfig";
import { RecompensaGanha } from "./RecompensaGanha";
import type { RecompensaLocal, ResultadoResposta } from "./usePartidaJogo";

/**
 * Fim da partida por erro ou tempo: a resposta certa e a explicação (o momento
 * de aprender). Fechar (×, Esc, fora) sai para o menu; só "Tentar novamente"
 * recomeça.
 */
export const ModalRespostaErrada = ({
  aberto,
  resultado,
  patamar,
  textoDaOpcao,
  recompensa,
  modoRecompensa,
  comPerguntasOffline,
  aoRecomecar,
  aoSair,
}: {
  aberto: boolean;
  resultado: ResultadoResposta | null;
  patamar: number;
  textoDaOpcao: (opcao: string) => string;
  recompensa: RecompensaLocal | null;
  modoRecompensa: "servidor" | "convidado" | "treino";
  comPerguntasOffline: boolean;
  aoRecomecar: () => void;
  aoSair: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Dialogo
      open={aberto}
      onOpenChange={(open) => {
        // "×", Esc ou clique fora: sair para o menu, nunca recomeçar.
        if (!open) aoSair();
      }}
    >
      <DialogoConteudo
        titulo={resultado?.tempoEsgotado ? t("JogoCuriosidades.tempoEsgotado") : t("JogoCuriosidades.essaNaoEraA")}
        descricao={t("JogoCuriosidades.vejaARespostaCerta")}
        rotuloFechar={t("JogoCuriosidades.fechar")}
        rodape={
          <>
            <Botao variante="secundario" onClick={aoSair}>
              <Home aria-hidden />
              {t("JogoCuriosidades.voltarAoMenu")}
            </Botao>
            <Botao onClick={aoRecomecar}>
              <RefreshCw aria-hidden />
              {t("JogoCuriosidades.tentarNovamente")}
            </Botao>
          </>
        }
      >
        {resultado && (
          <div className="space-y-4">
            <div className="rounded-controlo border-l-4 border-sucesso bg-sucesso-suave p-4">
              <p className="text-legenda text-tinta-suave">{t("JogoCuriosidades.respostaCorrecta")}</p>
              {resultado.resposta_correta ? (
                <p className="mt-1 text-corpo font-medium text-tinta">
                  {resultado.resposta_correta}) {textoDaOpcao(resultado.resposta_correta)}
                </p>
              ) : (
                // Com sessão, a resposta chega com `terminarPartida`.
                <Loader2 className="mt-1 size-5 animate-spin text-sucesso" aria-label={t("JogoCuriosidades.aRevelar")} />
              )}
            </div>
            {resultado.explicacao && <p className="text-corpo text-tinta">{resultado.explicacao}</p>}
            <p className="text-legenda text-tinta-suave">
              <Trans i18nKey="JogoCuriosidades.chegouAoPatamarDe" values={{ patamar, TOTAL_PATAMARES }} />
            </p>
            <RecompensaGanha recompensa={recompensa} modo={modoRecompensa} comPerguntasOffline={comPerguntasOffline} />
          </div>
        )}
      </DialogoConteudo>
    </Dialogo>
  );
};

/** Ajuda "Opinião do público": a percentagem de cada opção, em texto e em barra. */
export const ModalOpiniaoPublico = ({
  aberto,
  aoMudar,
  opiniao,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  opiniao: Record<string, number> | null;
}) => {
  const { t } = useTranslation();
  return (
    <Dialogo open={aberto} onOpenChange={aoMudar}>
      <DialogoConteudo
        className="max-w-md"
        titulo={t("JogoCuriosidades.opiniaoDoPublico")}
        descricao={t("JogoCuriosidades.assimResponderamOutrosJogadores")}
        rotuloFechar={t("JogoCuriosidades.fechar")}
        rodape={
          <Botao larguraTotal onClick={() => aoMudar(false)}>
            {t("JogoCuriosidades.continuarAJogar")}
          </Botao>
        }
      >
        {opiniao && (
          <ul className="space-y-4">
            {OPCOES.map((opcao) => (
              <li key={opcao} className="space-y-1.5">
                <div className="flex items-center justify-between text-corpo text-tinta">
                  <span>
                    <Trans i18nKey="JogoCuriosidades.opcao" values={{ opcao }} />
                  </span>
                  <span className="font-medium tabular-nums">{opiniao[opcao]}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-pilula bg-superficie-alt" aria-hidden>
                  <div
                    className="h-full rounded-pilula bg-accao transition-[width] duration-entrada ease-padrao motion-reduce:transition-none"
                    style={{ width: `${opiniao[opcao]}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogoConteudo>
    </Dialogo>
  );
};

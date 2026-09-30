import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { consentimentoSaudeApi, mensagemDeErroApi } from "@/lib/apiClient";
import { localizar } from "@/i18n/rotas";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { Dialogo, DialogoConteudo } from "@/design/componentes/Dialogo";
import { OpcaoConfirmar } from "@/design/componentes/OpcaoConfirmar";

interface ConsentimentoSaudeContextType {
  /** Com sessão: o que a API diz. Sem sessão: se aceitou nesta visita. */
  consentido: boolean;
  carregando: boolean;
  /** Abre o pedido se ainda não houver consentimento. Resolve `true` só
   *  depois de a API o gravar (com sessão) -- nunca a partir de um erro. */
  garantir: () => Promise<boolean>;
  /** Retira o consentimento (só com sessão). Levanta o erro da API. */
  retirar: () => Promise<void>;
}

const ConsentimentoSaudeContext = createContext<ConsentimentoSaudeContextType | undefined>(undefined);

/**
 * Consentimento para tratar dados de saúde (Lei 22/11, art. 13.º e 14.º):
 * separado dos Termos, dado por um adulto, com a declaração de representante
 * legal quando é para uma criança. A garantia real é a API recusar gravar sem
 * ele (403); aqui só se pede e espelha.
 *
 * Sem sessão (rastreio anónimo) pede-se na mesma, antes de ligar a câmara,
 * mas não há onde o gravar: vale para esta visita, e o resultado também não
 * fica guardado.
 */
export const ConsentimentoSaudeProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [consentido, setConsentido] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [maioridade, setMaioridade] = useState(false);
  const [aceita, setAceita] = useState(false);
  const [representaMenor, setRepresentaMenor] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      setConsentido(false);
      setCarregando(false);
      return;
    }
    let activo = true;
    setCarregando(true);
    consentimentoSaudeApi
      .estado()
      .then((e) => activo && setConsentido(e.consentido))
      // Sem resposta, conta como não consentido: pede-se de novo, nunca se presume.
      .catch(() => activo && setConsentido(false))
      .finally(() => activo && setCarregando(false));
    return () => {
      activo = false;
    };
  }, [authLoading, isLoggedIn]);

  const fechar = useCallback((ok: boolean) => {
    setAberto(false);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const garantir = useCallback(() => {
    if (consentido) return Promise.resolve(true);
    setMaioridade(false);
    setAceita(false);
    setRepresentaMenor(false);
    setErro(null);
    setAberto(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [consentido]);

  const aceitar = async () => {
    if (!maioridade || !aceita) return;
    if (!isLoggedIn) {
      setConsentido(true);
      fechar(true);
      return;
    }
    setAGravar(true);
    setErro(null);
    try {
      const estado = await consentimentoSaudeApi.dar({
        declara_maioridade: maioridade,
        aceita_tratamento: aceita,
        representa_menor: representaMenor,
      });
      setConsentido(estado.consentido);
      fechar(estado.consentido);
    } catch (err) {
      setErro(mensagemDeErroApi(err, t("ConsentimentoSaude.erroAoGravar")));
    } finally {
      setAGravar(false);
    }
  };

  const retirar = useCallback(async () => {
    const estado = await consentimentoSaudeApi.retirar();
    setConsentido(estado.consentido);
  }, []);

  return (
    <ConsentimentoSaudeContext.Provider value={{ consentido, carregando, garantir, retirar }}>
      {children}
      <Dialogo open={aberto} onOpenChange={(abrir) => !abrir && fechar(false)}>
        <DialogoConteudo
          titulo={t("ConsentimentoSaude.titulo")}
          descricao={t("ConsentimentoSaude.explicacao")}
          rotuloFechar={t("ConsentimentoSaude.fechar")}
          rodape={
            <>
              <Botao variante="fantasma" onClick={() => fechar(false)} disabled={aGravar}>
                {t("ConsentimentoSaude.agoraNao")}
              </Botao>
              <Botao onClick={() => void aceitar()} disabled={!maioridade || !aceita} aCarregar={aGravar}>
                {aGravar ? t("ConsentimentoSaude.aGravar") : t("ConsentimentoSaude.aceitarEContinuar")}
              </Botao>
            </>
          }
        >
          <ul className="flex list-disc flex-col gap-2 pl-5 text-legenda text-tinta-suave">
            <li>{t("ConsentimentoSaude.pontoQueDados")}</li>
            <li>{t("ConsentimentoSaude.pontoFotografias")}</li>
            <li>{t("ConsentimentoSaude.pontoQuemVe")}</li>
            <li>{t("ConsentimentoSaude.pontoOnde")}</li>
            <li>{t("ConsentimentoSaude.pontoRetirar")}</li>
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <OpcaoConfirmar
              rotulo={t("ConsentimentoSaude.declaroMaioridade")}
              marcada={maioridade}
              aoMudar={setMaioridade}
            />
            <OpcaoConfirmar
              rotulo={t("ConsentimentoSaude.representaMenor")}
              marcada={representaMenor}
              aoMudar={setRepresentaMenor}
            />
            <OpcaoConfirmar rotulo={t("ConsentimentoSaude.autorizo")} marcada={aceita} aoMudar={setAceita} />
          </div>
          {/* Fora das opções: seguir a ligação nunca marca uma caixa. */}
          <Link
            to={localizar("/politica-de-privacidade")}
            target="_blank"
            className="mt-4 inline-block text-legenda font-medium text-accao underline underline-offset-2"
          >
            {t("ConsentimentoSaude.lerPolitica")}
          </Link>
          {erro && (
            <Aviso className="mt-4" variante="erro" anunciar>
              {erro}
            </Aviso>
          )}
        </DialogoConteudo>
      </Dialogo>
    </ConsentimentoSaudeContext.Provider>
  );
};

export const useConsentimentoSaude = () => {
  const ctx = useContext(ConsentimentoSaudeContext);
  if (!ctx) throw new Error("useConsentimentoSaude tem de estar dentro de ConsentimentoSaudeProvider");
  return ctx;
};

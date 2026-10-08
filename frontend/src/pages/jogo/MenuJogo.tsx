import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Globe, User, UserRound, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import CarteiraJogo from "@/components/jogo/CarteiraJogo";
import { useProfile } from "@/contexts/ProfileContext";
import { Botao } from "@/design/componentes/Botao";
import { Cartao, CartaoLigacao, CartaoTexto, CartaoTitulo } from "@/design/componentes/Cartao";
import { Contentor } from "@/design/layouts/Contentor";
import { localizar } from "@/i18n/rotas";

const IconeModo = ({ children, apagado = false }: { children: ReactNode; apagado?: boolean }) => (
  <span
    aria-hidden
    className={
      apagado
        ? "flex size-12 items-center justify-center rounded-pilula bg-superficie-alt text-tinta-suave [&_svg]:size-6"
        : "flex size-12 items-center justify-center rounded-pilula bg-accao-suave text-accao [&_svg]:size-6"
    }
  >
    {children}
  </span>
);

/** Um modo que ainda não existe: diz-se já o que vai ser, sem clique que não leva a lado nenhum. */
const ModoEmBreve = ({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) => {
  const { t } = useTranslation();
  return (
    <Cartao className="bg-superficie-alt shadow-none">
      <div className="flex items-start justify-between gap-3">
        <IconeModo apagado>{icone}</IconeModo>
        <span className="rounded-pilula border border-linha bg-superficie px-2.5 py-0.5 text-legenda font-medium text-tinta-suave">
          {t("MenuJogo.emBreve")}
        </span>
      </div>
      <CartaoTitulo className="mt-4 text-tinta-suave">{titulo}</CartaoTitulo>
      <CartaoTexto>{texto}</CartaoTexto>
    </Cartao>
  );
};

/**
 * Entrada do jogo Inclusivamente (arquétipo Site, como a lista dos exercícios:
 * quem não tem conta também joga). Quem é o jogador e o saldo, e os modos de
 * jogo -- um a funcionar, dois anunciados.
 */
const MenuJogo = () => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const nome = profile ? profile.nome_completo || profile.email : "";

  return (
    <Contentor className="py-12 lg:py-16">
      <header className="max-w-2xl">
        <p className="text-legenda font-medium text-accao">{t("MenuJogo.inclusivamente")}</p>
        <h1 className="mt-2 text-titulo-g text-tinta">{t("MenuJogo.oJogoDaSaude")}</h1>
        <p className="mt-4 text-corpo-g text-tinta-suave">{t("MenuJogo.escolhaComoQuerJogar")}</p>
      </header>

      {/* Quem joga e o saldo */}
      <Cartao className="mt-10 flex flex-wrap items-center justify-between gap-4 p-5">
        {profile ? (
          <Link
            to={localizar("/jogo-curiosidades/perfil")}
            className="group flex min-w-0 items-center gap-3 rounded-controlo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="size-12 shrink-0 rounded-pilula object-cover" />
            ) : (
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-pilula bg-accao text-corpo-g font-medium text-sobre-accao"
              >
                {nome[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-corpo font-medium text-tinta">{nome}</span>
              <span className="flex items-center gap-1 text-legenda text-accao group-hover:underline">
                {t("MenuJogo.verPerfilEEstatisticas")} <ChevronRight className="size-4" aria-hidden />
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-pilula bg-superficie-alt text-tinta-suave">
              <UserRound className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-corpo font-medium text-tinta">{t("MenuJogo.convidado")}</span>
              <span className="block text-legenda text-tinta-suave">{t("MenuJogo.inicieSessaoParaGuardar")}</span>
            </span>
          </div>
        )}

        {profile ? (
          <CarteiraJogo className="shrink-0" />
        ) : (
          <Botao asChild variante="secundario">
            <Link to={localizar("/auth")}>{t("MenuJogo.entrar")}</Link>
          </Botao>
        )}
      </Cartao>

      {/* Modos de jogo */}
      <h2 className="mt-12 text-titulo-m text-tinta">{t("MenuJogo.modosDeJogo")}</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Cartao interactivo className="border-accao">
          <IconeModo>
            <User />
          </IconeModo>
          <CartaoTitulo className="mt-4">
            <CartaoLigacao asChild>
              <Link to={localizar("/jogo-curiosidades/jogar")}>{t("MenuJogo.umJogador")}</Link>
            </CartaoLigacao>
          </CartaoTitulo>
          <CartaoTexto>{t("MenuJogo.subaOs15Patamares")}</CartaoTexto>
          <p className="mt-4 flex items-center gap-1 text-corpo font-medium text-accao" aria-hidden>
            {t("MenuJogo.jogar")} <ChevronRight className="size-5" />
          </p>
        </Cartao>
        <ModoEmBreve icone={<Users />} titulo={t("MenuJogo.multijogadorLocal")} texto={t("MenuJogo.emBreveVaiPoder")} />
        <ModoEmBreve icone={<Globe />} titulo={t("MenuJogo.multijogadorOnline")} texto={t("MenuJogo.estamosAConstruirO")} />
      </div>
    </Contentor>
  );
};

export default MenuJogo;

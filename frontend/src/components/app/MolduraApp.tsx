import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dumbbell, Home, ScanFace, Settings, TrendingUp, User } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { LigacaoRouter } from "@/components/site/LigacaoRouter";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { MenuConta } from "@/design/componentes/MenuConta";
import { LayoutApp } from "@/design/layouts/LayoutApp";
import { ProvedorLigacao } from "@/design/Ligacao";
import { Simbolo } from "@/design/marca/Simbolo";
import { localizar } from "@/i18n/rotas";

/**
 * A moldura da app de quem tem conta (arquétipo App, docs/LAYOUTS.md §2.4): a
 * mesma navegação, o sino e o menu da conta em todos os ecrãs do dia-a-dia
 * (painel, progresso). Uma só fonte, para os separadores nunca divergirem.
 */
export type SeparadorApp = "inicio" | "rastreio" | "treinos" | "progresso";

export const MolduraApp = ({
  activo,
  titulo,
  subtitulo,
  children,
}: {
  /** O separador do ecrã; sem ele (ex.: definições, perfil), nenhum fica marcado. */
  activo?: SeparadorApp;
  /** O `h1` do ecrã (no painel, a saudação). */
  titulo: ReactNode;
  subtitulo?: ReactNode;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { profile } = useProfile();
  const nome = profile?.nome_completo || user?.name || "";

  const destinos = [
    { chave: "inicio", rotulo: t("PainelApp.inicio"), href: localizar("/dashboard"), icone: <Home /> },
    { chave: "rastreio", rotulo: t("PainelApp.rastreio"), href: localizar("/scanner"), icone: <ScanFace /> },
    { chave: "treinos", rotulo: t("PainelApp.treinos"), href: localizar("/exercicios"), icone: <Dumbbell /> },
    { chave: "progresso", rotulo: t("PainelApp.progresso"), href: localizar("/exercicios/progresso"), icone: <TrendingUp /> },
  ].map(({ chave, ...d }) => ({ ...d, activo: chave === activo }));

  return (
    <ProvedorLigacao componente={LigacaoRouter}>
      <LayoutApp
        destinos={destinos}
        rotuloNavegacao={t("PainelApp.navegacao")}
        simbolo={<Simbolo fundo="claro" />}
        saudacao={titulo}
        subtitulo={subtitulo}
        conta={
          <>
            <NotificationBell claro={false} />
            <MenuConta
              nome={nome}
              avatarUrl={profile?.avatar_url || user?.avatarUrl}
              rotulo={t("PainelApp.contaDe", { nome: nome || t("PainelApp.contaSemNome") })}
              itens={[
                { rotulo: t("Navbar.editarPerfil"), href: localizar("/editar-perfil"), icone: <User /> },
                { rotulo: t("Navbar.configuracoes"), href: localizar("/configuracoes"), icone: <Settings /> },
              ]}
              sair={{
                rotulo: t("Navbar.sair"),
                aoSair: () => {
                  logout();
                  navigate(localizar("/"));
                },
              }}
            />
          </>
        }
        textoSaltar={t("PainelApp.saltar")}
      >
        {children}
      </LayoutApp>
    </ProvedorLigacao>
  );
};

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Bell,
  CalendarPlus,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Newspaper,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import RequireAdmin from "@/components/admin/RequireAdmin";
import { LigacaoRouter } from "@/components/site/LigacaoRouter";
import { useAuth } from "@/contexts/AuthContext";
import { Ligacao, ProvedorLigacao } from "@/design/Ligacao";
import { LayoutConsola, estiloAccaoConsola, type GrupoConsola } from "@/design/layouts/LayoutConsola";
import { Simbolo } from "@/design/marca/Simbolo";

// W-11: "admin" é binário na API própria (uma coluna `papel`), não uma matriz
// de permissões. Quem passa em `RequireAdmin` vê o menu inteiro.
const GRUPOS: { rotulo?: string; destinos: { rotulo: string; href: string; icone: JSX.Element; exacto?: boolean }[] }[] = [
  {
    destinos: [{ rotulo: "Visão geral", href: "/admin", icone: <LayoutDashboard />, exacto: true }],
  },
  {
    rotulo: "Pedidos",
    destinos: [
      { rotulo: "Mensagens e pedidos", href: "/admin/mensagens", icone: <Inbox /> },
      { rotulo: "Agendamentos clínicos", href: "/admin/agendamentos", icone: <CalendarPlus /> },
      { rotulo: "Voluntariado", href: "/admin/voluntariado", icone: <HeartHandshake /> },
    ],
  },
  {
    rotulo: "Pessoas",
    destinos: [
      { rotulo: "Utilizadores", href: "/admin/utilizadores", icone: <Users /> },
      { rotulo: "Actividade", href: "/admin/atividade", icone: <Activity /> },
      { rotulo: "Clínicas parceiras", href: "/admin/clinicas", icone: <Stethoscope /> },
      { rotulo: "Administradores", href: "/admin/administradores", icone: <ShieldCheck /> },
    ],
  },
  {
    rotulo: "Conteúdo",
    destinos: [
      { rotulo: "Publicações", href: "/admin/publicacoes", icone: <Newspaper /> },
      { rotulo: "Banners", href: "/admin/banners", icone: <Megaphone /> },
      { rotulo: "Notificações", href: "/admin/notificacoes", icone: <Bell /> },
    ],
  },
];

/**
 * Painel de administração no arquétipo Consola (docs/LAYOUTS.md §2.5). O painel
 * só existe em português (fora do i18n, `codigo-fonte.test.ts`).
 */
const AdminLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const grupos: GrupoConsola[] = GRUPOS.map((g) => ({
    rotulo: g.rotulo,
    destinos: g.destinos.map(({ exacto, ...d }) => ({
      ...d,
      activo: exacto ? pathname === d.href : pathname === d.href || pathname.startsWith(`${d.href}/`),
    })),
  }));

  return (
    <RequireAdmin>
      <ProvedorLigacao componente={LigacaoRouter}>
        <LayoutConsola
          nome="Administração"
          simbolo={<Simbolo fundo="claro" />}
          grupos={grupos}
          rotuloNavegacao="Navegação do painel"
          textoSaltar="Saltar para o conteúdo"
          textosMenu={{ abrir: "Menu", fechar: "Fechar" }}
          rodapeNavegacao={
            <>
              <Ligacao href="/dashboard" className={estiloAccaoConsola}>
                <ArrowLeft aria-hidden />
                Voltar ao site
              </Ligacao>
              <button
                type="button"
                className={`${estiloAccaoConsola} w-full`}
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                <LogOut aria-hidden />
                Terminar sessão
              </button>
            </>
          }
        >
          <Outlet />
        </LayoutConsola>
      </ProvedorLigacao>
    </RequireAdmin>
  );
};

export default AdminLayout;

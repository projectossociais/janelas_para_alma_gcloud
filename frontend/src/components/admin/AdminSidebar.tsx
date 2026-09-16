import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Megaphone,
  Bell,
  Newspaper,
  LogOut,
  ShieldCheck,
  ArrowLeft,
  HeartHandshake,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

// W-11: "admin" é binário na API própria (uma coluna `papel`), não uma
// matriz de permissões — saiu o `useAdminScope` (que lia `admin_permissions`
// no Supabase) junto com os `can_*`/`is_super`. Quem passa em `RequireAdmin`
// vê o menu inteiro; não há hoje conceito de admin parcial.
const items = [
  { title: "Visão Geral", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Utilizadores", url: "/admin/utilizadores", icon: Users },
  { title: "Mensagens & Pedidos", url: "/admin/mensagens", icon: Inbox },
  { title: "Voluntariado", url: "/admin/voluntariado", icon: HeartHandshake },
  { title: "Banners", url: "/admin/banners", icon: Megaphone },
  { title: "Notificações", url: "/admin/notificacoes", icon: Bell },
  { title: "Publicações", url: "/admin/publicacoes", icon: Newspaper },
  { title: "Administradores", url: "/admin/administradores", icon: ShieldCheck },
];

const AdminSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="Logo" className="w-8 h-8 rounded" />
          <div className="font-bold text-sm">Painel Admin</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.end
                  ? pathname === item.url
                  : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} end={item.end}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="bg-primary/10 text-primary hover:bg-primary/15 font-semibold">
                  <Link to="/dashboard">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar ao Site</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  <span>Terminar sessão</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;

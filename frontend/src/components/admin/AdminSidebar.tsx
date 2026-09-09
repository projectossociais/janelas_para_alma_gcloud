import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Megaphone,
  Bell,
  FileEdit,
  LogOut,
  ShieldCheck,
  ArrowLeft,
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
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAdminScope } from "@/hooks/useAdminScope";

const allItems = [
  { title: "Visão Geral", url: "/admin", icon: LayoutDashboard, end: true, scope: "can_overview" as const },
  { title: "Utilizadores", url: "/admin/utilizadores", icon: Users, scope: "can_users" as const },
  { title: "Mensagens & Pedidos", url: "/admin/mensagens", icon: Inbox, scope: "can_inbox" as const },
  { title: "Banners", url: "/admin/banners", icon: Megaphone, scope: "can_banners" as const },
  { title: "Notificações", url: "/admin/notificacoes", icon: Bell, scope: "can_notifications" as const },
  { title: "Conteúdo", url: "/admin/conteudo", icon: FileEdit, scope: "can_content" as const },
  { title: "Administradores", url: "/admin/administradores", icon: ShieldCheck, scope: "can_manage_admins" as const },
];

const AdminSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { scope } = useAdminScope();
  const items = allItems.filter((i) => !scope || scope.is_super || scope[i.scope]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
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

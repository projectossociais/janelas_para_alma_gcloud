import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import RequireAdmin from "@/components/admin/RequireAdmin";

const AdminLayout = () => (
  <RequireAdmin>
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background flex items-center px-4 gap-3 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="font-semibold text-foreground">Janelas Para a Alma · Admin</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  </RequireAdmin>
);

export default AdminLayout;

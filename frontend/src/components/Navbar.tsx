import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Search, ArrowRight, User, Settings, Shield, LogOut, LogIn, Eye, LayoutDashboard } from "lucide-react";
import { useSupabaseRole } from "@/hooks/useSupabaseRole";
import logoIcon from "@/assets/logo-icon.png";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";


interface SearchItem {
  id: string;
  title: string;
  description: string;
  keywords: string;
  route: string;
  elementId?: string;
  action?: string;
}

const searchIndex: SearchItem[] = [
  {
    id: "sobre",
    title: "Sobre a Janelas para a Alma",
    description: "Janelas Para a Alma é uma start up angolana dedicada à saúde visual, inclusão e sustentabilidade.",
    keywords: "sobre, start up, janelas para a alma, missão, visão, saúde visual, inclusão, sustentabilidade, angola",
    route: "/impacto",
    elementId: "sobre",
  },
  {
    id: "estrabismo",
    title: "Compreender o Estrabismo",
    description: "O que é o estrabismo, causas, tipos, consequências e tratamento.",
    keywords: "estrabismo, definição, causas, tipos, esotropia, exotropia, ambliopia, tratamento, cirurgia, óculos, olho, visão, desalinhamento",
    route: "/sobre",
    elementId: "estrabismo",
  },
  {
    id: "pilares-economia",
    title: "Pilar: Economia Circular",
    description: "Transformar resíduos em recursos através de práticas sustentáveis e economia circular.",
    keywords: "economia circular, reciclagem, sustentabilidade, resíduos, recursos, pilar",
    route: "/",
    elementId: "pilares",
  },
  {
    id: "pilares-educacao",
    title: "Pilar: Educação",
    description: "Promover a educação inclusiva e o acesso ao conhecimento para todos.",
    keywords: "educação, inclusão, conhecimento, escola, formação, pilar",
    route: "/",
    elementId: "pilares",
  },
  {
    id: "pilares-saude",
    title: "Pilar: Saúde Visual",
    description: "Garantir acesso a cuidados de saúde visual e sensibilização comunitária.",
    keywords: "saúde, visual, oftalmologia, óculos, estrabismo, cuidados, pilar",
    route: "/",
    elementId: "pilares",
  },
  {
    id: "impacto",
    title: "Impacto",
    description: "Dados e estatísticas sobre o impacto social, educacional, ecológico e climático.",
    keywords: "impacto, estatísticas, social, educacional, ecológico, climático, oms, dados",
    route: "/",
    elementId: "impacto",
  },
  {
    id: "equipa",
    title: "A Nossa Equipa",
    description: "Conheça os membros da equipa Janelas Para a Alma.",
    keywords: "equipa, membros, fundadores, voluntários, pessoas, team",
    route: "/equipa",
  },
  {
    id: "voluntariado",
    title: "Voluntariado",
    description: "Junte-se como voluntário e faça a diferença na comunidade.",
    keywords: "voluntariado, voluntário, inscrição, juntar, ajudar, kamba",
    route: "/kamba",
    elementId: "voluntariado",
  },
  {
    id: "programa-kamba",
    title: "Programa Meu Kamba Estrábico",
    description: "Rede de apoio comunitário para inclusão e solidariedade em torno do estrabismo.",
    keywords: "kamba, estrábico, programa, embaixadores, inclusão, estrabismo, objectivos, etapas, voluntários",
    route: "/kamba",
    elementId: "voluntariado",
    action: "open-program-modal",
  },
  {
    id: "contacto",
    title: "Contacto",
    description: "Entre em contacto connosco por email ou formulário.",
    keywords: "contacto, email, formulário, mensagem, falar, comunicar",
    route: "/",
    elementId: "contacto",
  },
  {
    id: "parceiros",
    title: "Rede de Parceiros de Saúde",
    description: "Clínicas, óticas e especialistas: junte-se à plataforma que vai democratizar o acesso à saúde visual em Angola.",
    keywords: "parceiros, clínicas, óticas, especialistas, saúde visual, oftalmologia, centroptico, rede, plataforma",
    route: "/parceiros",
  },
  {
    id: "tecnologia",
    title: "Interface Tecnológica",
    description: "Plataforma intuitiva que centraliza agendamentos, marketplace e comunicação para democratizar o acesso à saúde visual.",
    keywords: "tecnologia, interface, app, plataforma, agendamento, marketplace, comunicação, digital, mobile, acessibilidade",
    route: "/tecnologia",
  },
  {
    id: "scanner",
    title: "Scanner de Estrabismo (IA)",
    description: "Diagnóstico assistido por inteligência artificial: carregue uma foto ou use a câmara e receba uma análise orientadora em segundos.",
    keywords: "scanner, ia, ai, inteligência artificial, diagnóstico, esotropia, exotropia, estrabismo, análise, foto, câmara",
    route: "/scanner",
  },
];

interface NavItem {
  label: string;
  href?: string;
  route?: string;
}

const baseLinks: NavItem[] = [
  { label: "Sobre o Estrabismo", route: "/sobre" },
  { label: "Conheça o Janelas para a Alma", route: "/impacto" },
  { label: "A Nossa Equipa", route: "/equipa" },
  { label: "Triagem de Estrabismo", route: "/scanner" },
  { label: "Meu Kamba", route: "/kamba" },
  { label: "Exercícios Visuais", route: "/exercicios" },
  { label: "Portal Clínico", route: "/parceiros" },
  { label: "Contactos", route: "/junte-se" },
];

const estrabicoLinks: NavItem[] = [
  { label: "Sobre o Estrabismo", route: "/sobre" },
  { label: "A Nossa Equipa", route: "/equipa" },
  { label: "Triagem de Estrabismo", route: "/scanner" },
  { label: "Meu Kamba", route: "/kamba" },
  { label: "Exercícios Visuais", route: "/exercicios" },
  { label: "Conheça o Janelas para a Alma", route: "/impacto" },
  { label: "Portal Clínico", route: "/parceiros" },
  { label: "Contactos", route: "/junte-se" },
];

const profissionalLinks: NavItem[] = [
  { label: "Sobre o Estrabismo", route: "/sobre" },
  { label: "Meu Kamba", route: "/kamba" },
  { label: "A Nossa Equipa", route: "/equipa" },
  { label: "Triagem de Estrabismo", route: "/scanner" },
  { label: "Exercícios Visuais", route: "/exercicios" },
  { label: "Conheça o Janelas para a Alma", route: "/impacto" },
  { label: "Contactos", route: "/junte-se" },
  { label: "Portal Clínico", route: "/parceiros" },
];





const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const { isAdmin } = useSupabaseRole();
  const { profile } = useProfile();
  const isHome = location.pathname === "/";
  const useSolidNav = !isHome || scrolled || drawerOpen || profileOpen || searchOpen;

  const allLinks: NavItem[] = useMemo(() => {
    if (!isLoggedIn) return baseLinks;
    if (user?.role === "estrabico") return estrabicoLinks;
    if (user?.role === "profissional") return profissionalLinks;
    return baseLinks;
  }, [isLoggedIn, user?.role]);

  const displayName = profile?.nome_completo || user?.name || "";
  const displayAvatarUrl = profile?.avatar_url || user?.avatarUrl;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    toast.success("Sessão terminada.");
    navigate("/");
  };



  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return searchIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  useEffect(() => {
    let previousScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 24);
      setIsScrollingDown(currentScrollY > previousScrollY && currentScrollY > 60);
      previousScrollY = currentScrollY;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  const navigateTo = (route: string, elementId?: string) => {
    if (location.pathname === route) {
      if (elementId) {
        const el = document.getElementById(elementId);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      navigate(route);
      if (elementId) {
        setTimeout(() => {
          const el = document.getElementById(elementId);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }
    }
  };

  const handleSearchSelect = (item: SearchItem) => {
    setSearchOpen(false);
    setSearchQuery("");

    if (item.action === "open-program-modal") {
      navigateTo(item.route, item.elementId);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-program-modal"));
      }, 500);
      return;
    }

    navigateTo(item.route, item.elementId);
  };

  const handleNavClick = (link: NavItem) => {
    setDrawerOpen(false);
    if (link.route && link.href) {
      const elementId = link.href.replace("#", "");
      navigateTo(link.route, elementId);
    } else if (link.route) {
      navigateTo(link.route);
    }
  };

  const hideNavbar = isScrollingDown && !drawerOpen && !profileOpen && !searchOpen;

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-transform duration-300 ease-in-out ${
          hideNavbar ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div
          className={`transition-all duration-300 ease-in-out ${
            useSolidNav
              ? "bg-white/75 backdrop-blur-md border-b border-gray-200/50 shadow-sm"
              : "bg-transparent"
          }`}
        >
          <div className="container flex items-center justify-between h-14 md:h-16 gap-4">
            <div className="flex items-center gap-2 shrink-0">
              {isLoggedIn && (
                <button
                  onClick={() => setProfileOpen(true)}
                  className="rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-all"
                  aria-label="Abrir perfil"
                >
                  <Avatar className="h-9 w-9">
                    {displayAvatarUrl && <AvatarImage src={displayAvatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              )}
              <button onClick={() => navigateTo("/")} className="flex items-center gap-3">
                <img src={logoIcon} alt="Logo" className="h-10 w-auto object-contain" />
                <span className={`font-bold text-base md:text-lg transition-colors ${useSolidNav ? "text-foreground" : "text-primary-foreground"}`}>
                  Janelas Para a Alma
                </span>
              </button>
            </div>


            {/* Top nav quick links */}
            <div className="hidden lg:flex items-center justify-end gap-6 flex-1">
              {[
                { label: "Sobre nós", route: "/sobre" },
                { label: "Serviços", route: "/parceiros" },
                { label: "Triagem de Estrabismo", route: "/scanner" },
                { label: "Exercícios Visuais", route: "/exercicios" },
                { label: "Contactos", route: "/junte-se" },
              ].map((link) => (
                <button
                  key={link.label}
                  onClick={() => navigateTo(link.route)}
                  className={`text-sm font-medium transition-colors whitespace-nowrap ${
                    useSolidNav
                      ? "text-foreground/80 hover:text-primary"
                      : "text-primary-foreground/85 hover:text-primary-foreground"
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>


            <div className="flex items-center gap-2 shrink-0">

              {!isLoggedIn && (
                <button
                  onClick={() => navigate("/auth")}
                  className={`hidden sm:inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    useSolidNav ? "text-foreground/80 hover:text-primary" : "text-primary-foreground/85 hover:text-primary-foreground"
                  }`}
                >
                  <LogIn className="w-4 h-4" /> Entrar
                </button>
              )}

              <button
                onClick={() => setSearchOpen(true)}
                className={`p-2 rounded-lg transition-colors ${
                  useSolidNav ? "text-foreground hover:bg-muted" : "text-primary-foreground hover:bg-primary-foreground/10"
                }`}
                aria-label="Pesquisar"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDrawerOpen(true)}
                className={`p-2 rounded-lg transition-colors ${
                  useSolidNav ? "text-foreground hover:bg-muted" : "text-primary-foreground hover:bg-primary-foreground/10"
                }`}
                aria-label="Abrir menu"
              >

                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>

        </div>
      </nav>

      {/* Left-side profile drawer */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="left" className="w-80 bg-card border-r border-border p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b border-border/50 text-left">
            <SheetTitle className="sr-only">Perfil</SheetTitle>
            {user && (
              <div className="flex flex-col items-start gap-3">
                <Avatar className="h-16 w-16">
                  {displayAvatarUrl && <AvatarImage src={displayAvatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{displayName || user.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            )}
          </SheetHeader>
          <nav className="flex flex-col px-4 py-4 gap-1 flex-1">
            {isAdmin && (
              <button
                onClick={() => { setProfileOpen(false); navigate("/admin"); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors text-sm font-semibold mb-1"
              >
                <LayoutDashboard className="w-4 h-4" /> Painel Admin
              </button>
            )}
            <button
              onClick={() => { setProfileOpen(false); navigate("/editar-perfil"); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              <User className="w-4 h-4 text-muted-foreground" /> Editar Perfil
            </button>
            <button
              onClick={() => { setProfileOpen(false); navigate("/configuracoes"); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              <Settings className="w-4 h-4 text-muted-foreground" /> Configurações
            </button>
            <button
              onClick={() => { setProfileOpen(false); navigate("/politicas"); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              <Shield className="w-4 h-4 text-muted-foreground" /> Políticas e Privacidade
            </button>
          </nav>
          <div className="p-4 border-t border-border/50">
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>


      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-80 bg-card border-l border-border p-0">
          <SheetHeader className="p-6 pb-4 border-b border-border/50">
            <SheetTitle className="text-lg font-semibold text-foreground">Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col px-6 py-4 gap-1">
            {isAdmin && (
              <button
                onClick={() => { setDrawerOpen(false); navigate("/admin"); }}
                className="text-left flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-primary/10 text-primary font-semibold text-base hover:bg-primary/15 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" /> Painel Admin
              </button>
            )}
            {allLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link)}
                className="text-left px-4 py-3 rounded-xl text-foreground font-medium text-base hover:bg-muted transition-colors"
              >
                {link.label}
              </button>
            ))}
            {!isLoggedIn && (
              <div className="mt-4 pt-4 border-t border-border/50 flex flex-col gap-2 sm:hidden">
                <Button onClick={() => { setDrawerOpen(false); navigate("/auth"); }}>
                  <LogIn className="w-4 h-4 mr-2" /> Entrar / Registar
                </Button>
              </div>
            )}
          </nav>

        </SheetContent>
      </Sheet>

      <Dialog
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open);
          if (!open) setSearchQuery("");
        }}
      >
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-3">
              <Search className="w-5 h-5 text-teal" />
              Pesquisar
            </DialogTitle>
            <DialogDescription>Encontre secções e conteúdos do site.</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Input
              placeholder="O que procura?"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-base"
            />
          </div>
          <ScrollArea className="max-h-[280px]">
            <div className="px-4 pb-4">
              {searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum resultado encontrado.
                </p>
              )}
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSearchSelect(item)}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-muted transition-colors flex items-start gap-3 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Navbar;

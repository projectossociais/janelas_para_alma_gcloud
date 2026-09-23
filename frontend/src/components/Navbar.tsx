import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Search, ArrowRight, User, Settings, Shield, LogOut, LogIn, Eye, LayoutDashboard, Gamepad2 } from "lucide-react";
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
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useSiteBannerAltura } from "@/contexts/SiteBannerContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { disponivelNoIdiomaActual, localizar } from "@/i18n/rotas";


interface SearchItem {
  id: string;
  title: string;
  description: string;
  keywords: string;
  route: string;
  elementId?: string;
}

const searchIndex: SearchItem[] = [
  {
    id: "sobre",
    get title() {
      return i18n.t("Navbar.sobreOJanelasPara");
    },
    get description() {
      return i18n.t("Navbar.janelasParaAAlma");
    },
    get keywords() {
      return i18n.t("Navbar.sobreStartUpJanelas");
    },
    get route() {
      return localizar("/impacto");
    },
    elementId: "sobre",
  },
  {
    id: "estrabismo",
    get title() {
      return i18n.t("Navbar.compreenderOEstrabismo");
    },
    get description() {
      return i18n.t("Navbar.oQueEO");
    },
    get keywords() {
      return i18n.t("Navbar.estrabismoDefinicaoCausasTipos");
    },
    get route() {
      return localizar("/sobre");
    },
    elementId: "estrabismo",
  },
  {
    id: "pilares-economia",
    get title() {
      return i18n.t("Navbar.pilarEconomiaCircular");
    },
    get description() {
      return i18n.t("Navbar.transformarResiduosEmRecursos");
    },
    get keywords() {
      return i18n.t("Navbar.economiaCircularReciclagemSustentabilida");
    },
    get route() {
      return localizar("/");
    },
    elementId: "pilares",
  },
  {
    id: "pilares-educacao",
    get title() {
      return i18n.t("Navbar.pilarEducacao");
    },
    get description() {
      return i18n.t("Navbar.promoverAEducacaoInclusiva");
    },
    get keywords() {
      return i18n.t("Navbar.educacaoInclusaoConhecimentoEscola");
    },
    get route() {
      return localizar("/");
    },
    elementId: "pilares",
  },
  {
    id: "pilares-saude",
    get title() {
      return i18n.t("Navbar.pilarSaudeVisual");
    },
    get description() {
      return i18n.t("Navbar.garantirAcessoACuidados");
    },
    get keywords() {
      return i18n.t("Navbar.saudeVisualOftalmologiaOculos");
    },
    get route() {
      return localizar("/");
    },
    elementId: "pilares",
  },
  {
    id: "impacto",
    get title() {
      return i18n.t("Navbar.impacto");
    },
    get description() {
      return i18n.t("Navbar.dadosEEstatisticasSobre");
    },
    get keywords() {
      return i18n.t("Navbar.impactoEstatisticasSocialEducacional");
    },
    get route() {
      return localizar("/");
    },
    elementId: "impacto",
  },
  {
    id: "equipa",
    get title() {
      return i18n.t("Navbar.aNossaEquipa");
    },
    get description() {
      return i18n.t("Navbar.conhecaOsMembrosDa");
    },
    get keywords() {
      return i18n.t("Navbar.equipaMembrosFundadoresVoluntarios");
    },
    get route() {
      return localizar("/equipa");
    },
  },
  {
    id: "voluntariado",
    get title() {
      return i18n.t("Navbar.voluntariado");
    },
    get description() {
      return i18n.t("Navbar.junteSeComoVoluntario");
    },
    get keywords() {
      return i18n.t("Navbar.voluntariadoVoluntarioInscricaoJuntar");
    },
    get route() {
      return localizar("/kamba");
    },
    elementId: "voluntariado",
  },
  {
    id: "programa-kamba",
    get title() {
      return i18n.t("Navbar.programaMeuKambaEstrabico");
    },
    get description() {
      return i18n.t("Navbar.redeDeApoioComunitario");
    },
    get keywords() {
      return i18n.t("Navbar.kambaEstrabicoProgramaEmbaixadores");
    },
    get route() {
      return localizar("/kamba");
    },
    elementId: "voluntariado",
  },
  {
    id: "contacto",
    get title() {
      return i18n.t("Navbar.contacto");
    },
    get description() {
      return i18n.t("Navbar.entreEmContactoConnosco");
    },
    get keywords() {
      return i18n.t("Navbar.contactoEmailFormularioMensagem");
    },
    get route() {
      return localizar("/");
    },
    elementId: "contacto",
  },
  {
    id: "parceiros",
    get title() {
      return i18n.t("Navbar.redeDeParceirosDe");
    },
    get description() {
      return i18n.t("Navbar.clinicasOpticasEEspecialistas");
    },
    get keywords() {
      return i18n.t("Navbar.parceirosClinicasOpticasEspecialistas");
    },
    get route() {
      return localizar("/parceiros");
    },
  },
  {
    id: "tecnologia",
    get title() {
      return i18n.t("Navbar.interfaceTecnologica");
    },
    get description() {
      return i18n.t("Navbar.plataformaIntuitivaQueCentraliza");
    },
    get keywords() {
      return i18n.t("Navbar.tecnologiaInterfaceAppPlataforma");
    },
    get route() {
      return localizar("/tecnologia");
    },
  },
  {
    id: "scanner",
    get title() {
      return i18n.t("Navbar.scannerDeEstrabismoIa");
    },
    get description() {
      return i18n.t("Navbar.diagnosticoAssistidoPorInteligencia");
    },
    get keywords() {
      return i18n.t("Navbar.scannerIaAiInteligencia");
    },
    get route() {
      return localizar("/scanner");
    },
  },
];

interface NavItem {
  label: string;
  href?: string;
  route?: string;
}

const baseLinks: NavItem[] = [
  { get label() {
    return i18n.t("Navbar.sobreNos");
  }, get route() {
    return localizar("/impacto");
  } },
  { get label() {
    return i18n.t("Navbar.sobreOEstrabismo");
  }, get route() {
    return localizar("/sobre");
  } },
  { get label() {
    return i18n.t("Navbar.aNossaEquipa");
  }, get route() {
    return localizar("/equipa");
  } },
  { get label() {
    return i18n.t("Navbar.triagemOcular");
  }, get route() {
    return localizar("/scanner");
  } },
  { get label() {
    return i18n.t("Navbar.meuKambaEstrabico");
  }, get route() {
    return localizar("/kamba");
  } },
  { get label() {
    return i18n.t("Navbar.exerciciosVisuais");
  }, get route() {
    return localizar("/exercicios");
  } },
  { get label() {
    return i18n.t("Navbar.portalClinico");
  }, get route() {
    return localizar("/parceiros");
  } },
  { get label() {
    return i18n.t("Navbar.contactos");
  }, get route() {
    return localizar("/junte-se");
  } },
  { get label() {
    return i18n.t("Navbar.inclusivamente");
  }, get route() {
    return localizar("/jogo-curiosidades");
  } },
];

const estrabicoLinks: NavItem[] = [
  { get label() {
    return i18n.t("Navbar.sobreNos");
  }, get route() {
    return localizar("/impacto");
  } },
  { get label() {
    return i18n.t("Navbar.sobreOEstrabismo");
  }, get route() {
    return localizar("/sobre");
  } },
  { get label() {
    return i18n.t("Navbar.aNossaEquipa");
  }, get route() {
    return localizar("/equipa");
  } },
  { get label() {
    return i18n.t("Navbar.triagemOcular");
  }, get route() {
    return localizar("/scanner");
  } },
  { get label() {
    return i18n.t("Navbar.meuKambaEstrabico");
  }, get route() {
    return localizar("/kamba");
  } },
  { get label() {
    return i18n.t("Navbar.exerciciosVisuais");
  }, get route() {
    return localizar("/exercicios");
  } },
  { get label() {
    return i18n.t("Navbar.portalClinico");
  }, get route() {
    return localizar("/parceiros");
  } },
  { get label() {
    return i18n.t("Navbar.contactos");
  }, get route() {
    return localizar("/junte-se");
  } },
  { get label() {
    return i18n.t("Navbar.inclusivamente");
  }, get route() {
    return localizar("/jogo-curiosidades");
  } },
];

const profissionalLinks: NavItem[] = [
  { get label() {
    return i18n.t("Navbar.sobreNos");
  }, get route() {
    return localizar("/impacto");
  } },
  { get label() {
    return i18n.t("Navbar.sobreOEstrabismo");
  }, get route() {
    return localizar("/sobre");
  } },
  { get label() {
    return i18n.t("Navbar.meuKambaEstrabico");
  }, get route() {
    return localizar("/kamba");
  } },
  { get label() {
    return i18n.t("Navbar.aNossaEquipa");
  }, get route() {
    return localizar("/equipa");
  } },
  { get label() {
    return i18n.t("Navbar.triagemOcular");
  }, get route() {
    return localizar("/scanner");
  } },
  { get label() {
    return i18n.t("Navbar.exerciciosVisuais");
  }, get route() {
    return localizar("/exercicios");
  } },
  { get label() {
    return i18n.t("Navbar.contactos");
  }, get route() {
    return localizar("/junte-se");
  } },
  { get label() {
    return i18n.t("Navbar.portalClinico");
  }, get route() {
    return localizar("/parceiros");
  } },
  { get label() {
    return i18n.t("Navbar.inclusivamente");
  }, get route() {
    return localizar("/jogo-curiosidades");
  } },
];





const Navbar = () => {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout, isAdmin } = useAuth();
  const { profile } = useProfile();
  const isHome = location.pathname === "/" || location.pathname === "/en";
  const useSolidNav = !isHome || scrolled || drawerOpen || profileOpen || searchOpen;

  const allLinks: NavItem[] = useMemo(() => {
    const links =
      !isLoggedIn ? baseLinks
      : user?.role === "estrabico" ? estrabicoLinks
      : user?.role === "profissional" ? profissionalLinks
      : baseLinks;
    // No site inglês, esconde links para páginas só em português (o jogo).
    return links.filter((l) => disponivelNoIdiomaActual(l.route));
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
    toast.success(t("Navbar.sessaoTerminada"));
    navigate(localizar("/"));
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
      navigate(localizar(route));
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
  const bannerAltura = useSiteBannerAltura();

  return (
    <>
      <nav
        style={{ top: bannerAltura }}
        className={`fixed left-0 right-0 w-full z-50 transition-transform duration-300 ease-in-out ${
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
          <div className="container flex items-center justify-between h-14 md:h-16 gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
              {isLoggedIn && (
                <button
                  onClick={() => setProfileOpen(true)}
                  className="rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-all shrink-0"
                  aria-label={t("Navbar.abrirPerfil")}
                >
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    {displayAvatarUrl && <AvatarImage src={displayAvatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              )}
              <button onClick={() => navigateTo("/")} className="flex items-center gap-3 shrink-0">
                <img src={logoIcon} alt={t("Navbar.logo")} className="h-10 w-auto object-contain shrink-0" />
                <span className={`hidden md:inline-block font-bold text-base md:text-lg whitespace-nowrap transition-colors ${useSolidNav ? "text-foreground" : "text-primary-foreground"}`}>
                  Janelas Para a Alma
                </span>
              </button>
            </div>


            {/* Top nav quick links */}
            <div className="hidden lg:flex items-center justify-end gap-6 flex-1">
              {[
                { label: t("Navbar.sobreNos2"), route: localizar("/impacto") },
                { label: t("Navbar.triagemOcular"), route: localizar("/scanner") },
                { label: t("Navbar.exerciciosVisuais"), route: localizar("/exercicios") },
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


            <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">

              {disponivelNoIdiomaActual("/jogo-curiosidades") && (
              <button
                onClick={() => navigateTo("/jogo-curiosidades")}
                className="p-2 rounded-lg bg-teal/15 text-teal hover:bg-teal/25 transition-colors shrink-0"
                aria-label={t("Navbar.jogoInclusivamente")}
                title={t("Navbar.jogoInclusivamente")}
              >
                <Gamepad2 className="w-5 h-5" />
              </button>
              )}

              {!isLoggedIn && (
                <button
                  onClick={() => navigate(localizar("/auth"))}
                  className={`hidden sm:inline-flex items-center gap-1.5 text-sm font-medium transition-colors shrink-0 ${
                    useSolidNav ? "text-foreground/80 hover:text-primary" : "text-primary-foreground/85 hover:text-primary-foreground"
                  }`}
                >
                  <LogIn className="w-4 h-4" />{" "}{t("Navbar.entrar")}
                </button>
              )}

              {isLoggedIn && (
                <div className="shrink-0">
                  <NotificationBell claro={!useSolidNav} />
                </div>
              )}

              <button
                onClick={() => setSearchOpen(true)}
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  useSolidNav ? "text-foreground hover:bg-muted" : "text-primary-foreground hover:bg-primary-foreground/10"
                }`}
                aria-label={t("Navbar.pesquisar")}
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDrawerOpen(true)}
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  useSolidNav ? "text-foreground hover:bg-muted" : "text-primary-foreground hover:bg-primary-foreground/10"
                }`}
                aria-label={t("Navbar.abrirMenu")}
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
            <SheetTitle className="sr-only">{t("Navbar.perfil")}</SheetTitle>
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
                onClick={() => { setProfileOpen(false); navigate(localizar("/admin")); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors text-sm font-semibold mb-1"
              >
                <LayoutDashboard className="w-4 h-4" />{" "}{t("Navbar.painelAdmin")}
              </button>
            )}
            <button
              onClick={() => { setProfileOpen(false); navigate(localizar("/editar-perfil")); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              <User className="w-4 h-4 text-muted-foreground" />{" "}{t("Navbar.editarPerfil")}
            </button>
            <button
              onClick={() => { setProfileOpen(false); navigate(localizar("/configuracoes")); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />{" "}{t("Navbar.configuracoes")}
            </button>
            <button
              onClick={() => { setProfileOpen(false); navigate(localizar("/politica-de-privacidade")); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              <Shield className="w-4 h-4 text-muted-foreground" />{" "}{t("Navbar.politicasEPrivacidade")}
            </button>
          </nav>
          <div className="p-4 border-t border-border/50">
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />{" "}{t("Navbar.sair")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>


      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-80 bg-card border-l border-border p-0">
          <SheetHeader className="p-6 pb-4 border-b border-border/50">
            <SheetTitle className="text-lg font-semibold text-foreground">{t("Navbar.menu")}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col px-6 py-4 gap-1">
            {isAdmin && (
              <button
                onClick={() => { setDrawerOpen(false); navigate(localizar("/admin")); }}
                className="text-left flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-primary/10 text-primary font-semibold text-base hover:bg-primary/15 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />{" "}{t("Navbar.painelAdmin")}
              </button>
            )}
            {allLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link)}
                className="text-left flex items-center gap-3 px-4 py-3 rounded-xl text-foreground font-medium text-base hover:bg-muted transition-colors"
              >
                {link.route === "/jogo-curiosidades" && <Gamepad2 className="w-4 h-4 text-teal" />}
                {link.label}
              </button>
            ))}
            {!isLoggedIn && (
              <div className="mt-4 pt-4 border-t border-border/50 flex flex-col gap-2 sm:hidden">
                <Button onClick={() => { setDrawerOpen(false); navigate(localizar("/auth")); }}>
                  <LogIn className="w-4 h-4 mr-2" />{" "}{t("Navbar.entrarRegistar")}
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
              {t("Navbar.pesquisar")}
            </DialogTitle>
            <DialogDescription>{t("Navbar.encontreSeccoesEConteudos")}</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Input
              placeholder={t("Navbar.oQueProcura")}
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
                  {t("Navbar.nenhumResultadoEncontrado")}
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

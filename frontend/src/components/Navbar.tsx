import { useState, useEffect, useMemo, useRef, useCallback, type KeyboardEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  Search,
  ArrowRight,
  User,
  Settings,
  Shield,
  LogOut,
  LogIn,
  LayoutDashboard,
  ChevronDown,
  Heart,
} from "lucide-react";
import LogoMarca from "@/components/marca/LogoMarca";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { MENU_DOAR, MENU_PRINCIPAL, type ItemMenu } from "@/lib/menuPrincipal";

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
      return localizar("/circular");
    },
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
      return localizar("/kamba");
    },
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
      return localizar("/scanner");
    },
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
      return localizar("/impacto");
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
      return localizar("/junte-se");
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
  {
    id: "doar-mensal",
    get title() {
      return i18n.t("Cabecalho.doarMensalmente");
    },
    get description() {
      return i18n.t("Cabecalho.doarMensalmenteDescricao");
    },
    get keywords() {
      return i18n.t("Cabecalho.pesquisaDoarPalavras");
    },
    get route() {
      return localizar("/apoiar?modo=mensal");
    },
  },
  {
    id: "blog",
    get title() {
      return i18n.t("Cabecalho.blog");
    },
    get description() {
      return i18n.t("Cabecalho.blogDescricao");
    },
    get keywords() {
      return i18n.t("Cabecalho.pesquisaBlogPalavras");
    },
    get route() {
      return localizar("/publicacoes");
    },
  },
];

/** Itens do menu que existem no idioma da página (o jogo, por exemplo, pode não ter versão inglesa). */
const visiveis = (itens: readonly ItemMenu[]) => itens.filter((i) => disponivelNoIdiomaActual(i.caminho));

/** Pequeno atraso ao sair com o rato, para atravessar o espaço entre o botão e o painel sem o fechar. */
const ATRASO_FECHAR_MS = 150;

interface MenuSuspensoProps {
  id: string;
  rotulo: string;
  itens: readonly ItemMenu[];
  aberto: boolean;
  onAbrir: (id: string) => void;
  onFechar: () => void;
  destaque?: boolean;
}

/**
 * Menu suspenso do cabeçalho (desktop): abre ao passar o rato, por clique ou
 * pelo teclado (Enter/Espaço/Seta para baixo), fecha com Escape e devolve o
 * foco ao botão. Os itens são links normais -- nada de role="menu", que obriga
 * a navegação por setas que um leitor de ecrã não espera num menu de site.
 */
const MenuSuspenso = ({ id, rotulo, itens, aberto, onAbrir, onFechar, destaque }: MenuSuspensoProps) => {
  const { t } = useTranslation();
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const temporizador = useRef<number>();
  // Aberto só por passar o rato: o clique que vem logo a seguir confirma
  // (mantém aberto) em vez de fechar o que a pessoa acabou de abrir.
  const abertoPorPassagem = useRef(false);
  const idPainel = `menu-${id}`;

  const cancelarFecho = () => window.clearTimeout(temporizador.current);
  const agendarFecho = () => {
    cancelarFecho();
    temporizador.current = window.setTimeout(onFechar, ATRASO_FECHAR_MS);
  };
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const focarPrimeiro = () =>
    requestAnimationFrame(() => painel.current?.querySelector<HTMLAnchorElement>("a")?.focus());

  const aoTeclarBotao = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onAbrir(id);
      focarPrimeiro();
    }
  };

  const aoTeclarPainel = (e: KeyboardEvent<HTMLDivElement>) => {
    const links = Array.from(painel.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const actual = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "Escape") {
      e.preventDefault();
      onFechar();
      botao.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      links[(actual + 1) % links.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      links[(actual - 1 + links.length) % links.length]?.focus();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelarFecho();
        if (!aberto) abertoPorPassagem.current = true;
        onAbrir(id);
      }}
      onMouseLeave={agendarFecho}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFechar();
      }}
    >
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => {
          if (aberto && !abertoPorPassagem.current) onFechar();
          else onAbrir(id);
          abertoPorPassagem.current = false;
        }}
        onKeyDown={aoTeclarBotao}
        className={
          destaque
            ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-marca-azul px-3 py-2.5 text-[13px] font-bold xl:px-5 xl:text-sm uppercase tracking-[0.08em] text-marca-marfim shadow-sm transition-colors hover:bg-marca-marinho focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-marinho focus-visible:ring-offset-2"
            : `inline-flex items-center gap-1 whitespace-nowrap px-1 py-2 text-[13px] font-normal uppercase xl:text-sm tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azul focus-visible:ring-offset-2 rounded-sm ${
                aberto ? "text-marca-azul" : "text-marca-marinho hover:text-marca-azul"
              }`
        }
      >
        {t(rotulo)}
        <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div
        ref={painel}
        id={idPainel}
        hidden={!aberto}
        onKeyDown={aoTeclarPainel}
        className={`absolute top-full z-50 pt-3 ${destaque ? "right-0" : "left-1/2 -translate-x-1/2"}`}
      >
        <ul className="w-[19rem] rounded-xl border border-marca-marinho/10 bg-white p-2 shadow-xl">
          {visiveis(itens).map((item) => (
            <li key={item.caminho}>
              <Link
                to={localizar(item.caminho)}
                onClick={onFechar}
                className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-marca-celeste/25 focus-visible:bg-marca-celeste/25 focus-visible:outline-none"
              >
                <span className="block text-sm font-semibold text-marca-marinho">{t(item.rotulo)}</span>
                {item.descricao && (
                  <span className="mt-0.5 block text-xs leading-snug text-marca-marinho/60">{t(item.descricao)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const Navbar = () => {
  const { t } = useTranslation();
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout, isAdmin } = useAuth();
  const { profile } = useProfile();
  const bannerAltura = useSiteBannerAltura();

  const fecharMenu = useCallback(() => setMenuAberto(null), []);

  // Mudar de página fecha qualquer menu aberto.
  useEffect(() => {
    setMenuAberto(null);
    setDrawerOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const displayName = profile?.nome_completo || user?.name || "";
  const displayAvatarUrl = profile?.avatar_url || user?.avatarUrl;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

  const caminhoDoPainel = isAdmin ? "/admin" : user?.role === "profissional" ? "/dashboard-pro" : "/dashboard";

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

  const handleSearchSelect = (item: SearchItem) => {
    setSearchOpen(false);
    setSearchQuery("");
    // O ScrollToTop leva à secção pela âncora, também na mesma página.
    navigate(item.elementId ? `${item.route}#${item.elementId}` : item.route);
  };

  return (
    <>
      <header
        style={{ top: bannerAltura }}
        className="fixed left-0 right-0 z-50 w-full border-b border-marca-marinho/10 bg-white"
      >
        <div className="container flex h-16 items-center justify-between gap-2 px-4 sm:px-8">
          <Link
            to={localizar("/")}
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azul"
            aria-label={t("Cabecalho.irParaInicio")}
          >
            <LogoMarca className="h-10 w-auto" />
            {/* Só o nome completo, sem a sigla JPA (pedido de 2026-11-08). */}
            <span className="flex flex-col text-[15px] font-bold uppercase leading-[1.1] tracking-[0.12em] text-marca-marinho">
              <span>Janelas Para</span>
              <span>a Alma</span>
            </span>
          </Link>

          <nav aria-label={t("Cabecalho.navegacaoPrincipal")} className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-3 xl:gap-9">
              {MENU_PRINCIPAL.map((grupo) =>
                grupo.itens ? (
                  <li key={grupo.id}>
                    <MenuSuspenso
                      id={grupo.id}
                      rotulo={grupo.rotulo}
                      itens={grupo.itens}
                      aberto={menuAberto === grupo.id}
                      onAbrir={setMenuAberto}
                      onFechar={fecharMenu}
                    />
                  </li>
                ) : (
                  <li key={grupo.id}>
                    <Link
                      to={localizar(grupo.caminho!)}
                      className="whitespace-nowrap rounded-sm px-1 py-2 text-[13px] font-normal uppercase xl:text-sm tracking-wide text-marca-marinho transition-colors hover:text-marca-azul focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azul focus-visible:ring-offset-2"
                    >
                      {t(grupo.rotulo)}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            <div className="hidden md:block">
              <MenuSuspenso
                id="doar"
                rotulo="Cabecalho.doarAgora"
                itens={MENU_DOAR}
                aberto={menuAberto === "doar"}
                onAbrir={setMenuAberto}
                onFechar={fecharMenu}
                destaque
              />
            </div>
            <Link
              to={localizar("/apoiar")}
              className="inline-flex items-center gap-1 rounded-md bg-marca-azul px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-marca-marfim md:hidden"
              aria-label={t("Cabecalho.doarAgora")}
            >
              <Heart className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden min-[400px]:inline">{t("Cabecalho.doar")}</span>
            </Link>

            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2 text-marca-marinho transition-colors hover:bg-marca-celeste/25"
              aria-label={t("Navbar.pesquisar")}
            >
              <Search className="h-5 w-5" />
            </button>

            {isLoggedIn && <NotificationBell claro={false} />}

            {isLoggedIn ? (
              <button
                onClick={() => setProfileOpen(true)}
                className="shrink-0 rounded-full ring-2 ring-transparent transition-all hover:ring-marca-azul/40"
                aria-label={t("Navbar.abrirPerfil")}
              >
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                  {displayAvatarUrl && <AvatarImage src={displayAvatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-marca-marinho text-sm font-semibold text-marca-marfim">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <Link
                to={localizar("/auth")}
                className="hidden items-center gap-1.5 rounded-md px-2 py-2 text-[13px] font-medium text-marca-marinho/75 transition-colors hover:text-marca-azul sm:inline-flex"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {/* Entre 1024 e 1280 px só o ícone, para o menu caber numa linha. */}
                <span className="lg:max-xl:sr-only">{t("Navbar.entrar")}</span>
              </Link>
            )}

            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-marca-marinho transition-colors hover:bg-marca-celeste/25 lg:hidden"
              aria-label={t("Navbar.abrirMenu")}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Área de conta: o menu do perfil, à direita como o botão que o abre */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="right" className="w-80 bg-card border-l border-border p-0 flex flex-col">
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
            <button
              onClick={() => { setProfileOpen(false); navigate(localizar(caminhoDoPainel)); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors text-sm font-semibold mb-1"
            >
              <LayoutDashboard className="w-4 h-4" />{" "}{isAdmin ? t("Navbar.painelAdmin") : t("Navbar.oMeuPainel")}
            </button>
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

      {/* Menu mobile e tablet: os mesmos grupos, em acordeão */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex w-[22rem] max-w-[90vw] flex-col border-l border-border bg-white p-0">
          <SheetHeader className="border-b border-marca-marinho/10 p-5 text-left">
            <SheetTitle className="text-base font-semibold text-marca-marinho">{t("Navbar.menu")}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <nav aria-label={t("Cabecalho.navegacaoPrincipal")} className="px-5 py-2">
              <Accordion type="single" collapsible>
                {MENU_PRINCIPAL.map((grupo) =>
                  grupo.itens ? (
                    <AccordionItem key={grupo.id} value={grupo.id} className="border-marca-marinho/10">
                      <AccordionTrigger className="py-3.5 text-sm font-semibold uppercase tracking-wide text-marca-marinho hover:no-underline">
                        {t(grupo.rotulo)}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="flex flex-col gap-0.5 pb-1">
                          {visiveis(grupo.itens).map((item) => (
                            <li key={item.caminho}>
                              <Link
                                to={localizar(item.caminho)}
                                onClick={() => setDrawerOpen(false)}
                                className="block rounded-lg px-3 py-2.5 text-[15px] text-marca-marinho/85 transition-colors hover:bg-marca-celeste/25"
                              >
                                {t(item.rotulo)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ) : (
                    <div key={grupo.id} className="border-b border-marca-marinho/10">
                      <Link
                        to={localizar(grupo.caminho!)}
                        onClick={() => setDrawerOpen(false)}
                        className="block py-3.5 text-sm font-semibold uppercase tracking-wide text-marca-marinho"
                      >
                        {t(grupo.rotulo)}
                      </Link>
                    </div>
                  ),
                )}
              </Accordion>
            </nav>
          </ScrollArea>
          <div className="flex flex-col gap-2 border-t border-marca-marinho/10 p-5">
            {MENU_DOAR.map((item, i) => (
              <Link
                key={item.caminho}
                to={localizar(item.caminho)}
                onClick={() => setDrawerOpen(false)}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold uppercase tracking-wide ${
                  i === 0
                    ? "bg-marca-azul text-marca-marfim"
                    : "border border-marca-azul text-marca-azul"
                }`}
              >
                {i === 0 && <Heart className="h-4 w-4" aria-hidden="true" />}
                {t(item.rotulo)}
              </Link>
            ))}
            {!isLoggedIn && (
              <Link
                to={localizar("/auth")}
                onClick={() => setDrawerOpen(false)}
                className="mt-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-medium text-marca-marinho/75"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {t("Navbar.entrarRegistar")}
              </Link>
            )}
          </div>
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

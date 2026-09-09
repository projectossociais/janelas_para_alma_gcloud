import { useMemo } from "react";
import { Download } from "lucide-react";

interface AuditRow {
  pagina: string;
  componente: string;
  estado: string;
  plataformas: string;
  plano: string;
}

const AUDIT: AuditRow[] = [
  // Homepage
  { pagina: "Homepage (/)", componente: "Hero Section + CTA principal", estado: "UI funcional", plataformas: "React Router, Vercel Analytics", plano: "Ligar CTAs a eventos de tracking (GA4/PostHog). Confirmar rotas de destino em produção." },
  { pagina: "Homepage (/)", componente: "StrabismusIntroCard (imagem + texto)", estado: "UI estática", plataformas: "Supabase Storage + site_content (CMS)", plano: "Mover copy e imagem para tabela site_content e ler via query; permitir edição no /admin/conteudo." },
  { pagina: "Homepage (/)", componente: "PillarsSection / ImpactSection", estado: "Dados hardcoded", plataformas: "Supabase (tabela impacto_stats)", plano: "Criar tabela impacto_stats com RLS pública SELECT; substituir arrays por useQuery + realtime opcional." },
  { pagina: "Homepage (/)", componente: "TeamSection", estado: "Mock local (memória: estático propositado)", plataformas: "Manter estático OU Supabase (tabela team_members)", plano: "Manter estático conforme decisão do projeto; se dinâmico, criar tabela + bucket avatares." },
  { pagina: "Homepage (/)", componente: "ContactSection (formulário)", estado: "Parcialmente funcional (envia via edge function)", plataformas: "Resend + Supabase Edge Function send-contact-email", plano: "Adicionar rate-limit por IP (Upstash Redis) e captcha (Cloudflare Turnstile) para evitar spam." },

  // Auth
  { pagina: "Auth (/auth, /login, /registo)", componente: "Login/Signup email+password", estado: "Funcional (Supabase Auth)", plataformas: "Supabase Auth", plano: "Ativar HIBP password check, definir política de força mínima, adicionar verificação de email obrigatória." },
  { pagina: "Auth (/auth)", componente: "Login social (Google)", estado: "Não implementado", plataformas: "Supabase Auth (Google OAuth)", plano: "Configurar provider Google no Supabase, adicionar botão signInWithOAuth({ provider: 'google', options: { redirectTo: origin } })." },
  { pagina: "Auth (/atualizar-password)", componente: "Reset de palavra-passe", estado: "Funcional", plataformas: "Supabase Auth resetPasswordForEmail", plano: "Nenhum — validar template de email personalizado em produção." },

  // Scanner IA
  { pagina: "Scanner (/scanner)", componente: "Deteção facial + tracking ocular", estado: "MOCK — diagnóstico aleatório (Math.random)", plataformas: "MediaPipe FaceMesh, TensorFlow.js, OpenCV.js, ou API externa (Google Vision, AWS Rekognition)", plano: "1) Integrar MediaPipe FaceMesh para landmarks oculares. 2) Calcular ângulo de desvio (Hirschberg test). 3) Enviar imagem+landmarks para edge function que corre modelo TFLite/ONNX. 4) Guardar em scanner_analyses com user_id, imagem em Supabase Storage bucket privado." },
  { pagina: "Scanner (/scanner/resultados)", componente: "Página de resultados", estado: "Lê sessionStorage (mock)", plataformas: "Supabase (scanner_analyses)", plano: "Buscar resultado real por id via query; adicionar histórico de scans no dashboard; permitir partilha com clínica parceira." },

  // Exercícios
  { pagina: "Exercícios (/exercicios)", componente: "Lista de exercícios", estado: "UI + navegação funcional", plataformas: "Supabase (tabela exercises)", plano: "Migrar catálogo para tabela exercises com metadata (duração, dificuldade, thumbnail)." },
  { pagina: "Exercícios (/exercicios/tracking)", componente: "Tracking ocular em oito", estado: "Animação visual — sem tracking real", plataformas: "MediaPipe Iris + WebGazer.js", plano: "Ativar webcam, correr MediaPipe Iris, comparar gaze vector com trajetória alvo, calcular score de precisão, guardar sessão em exercise_sessions." },
  { pagina: "Exercícios (/exercicios/convergencia|cerebro|relaxamento)", componente: "Exercícios interativos", estado: "Funcional (UI) — sem persistência", plataformas: "Supabase (exercise_sessions)", plano: "Criar tabela exercise_sessions (user_id, exercise_slug, score, duration_s, completed_at) e gravar ao concluir." },
  { pagina: "Exercícios — todos", componente: "FeedbackWidget pós-exercício", estado: "Funcional (grava em user_feedback + email)", plataformas: "Supabase + Resend", plano: "Nenhum — apenas monitorizar volume no admin." },

  // Meu Kamba
  { pagina: "Kamba (/kamba)", componente: "Formulário de voluntariado", estado: "Envia email via edge function", plataformas: "Resend + Supabase (tabela volunteers)", plano: "Criar tabela volunteers para persistir candidaturas; adicionar estados (pendente/aprovado/rejeitado) e gestão em /admin." },

  // Parceiros
  { pagina: "Parceiros (/parceiros)", componente: "Benefícios + CTA (RBAC ativo)", estado: "UI condicional funcional", plataformas: "Supabase (tabela partners)", plano: "Criar tabela partners + fluxo de candidatura; ligar 'Quero ser parceiro' a formulário real gravado em premium_requests ou partner_applications." },
  { pagina: "Parceiros (/parceiros)", componente: "Clínicas parceiras (Optiótica)", estado: "Hardcoded", plataformas: "Supabase (tabela clinics)", plano: "Migrar para tabela clinics com geolocalização; renderizar mapa (Mapbox/Leaflet) no /impacto." },

  // Produto / Óculos
  { pagina: "Produto (/produto)", componente: "Catálogo de óculos + carrinho", estado: "MOCK — sem carrinho real, sem checkout", plataformas: "Supabase (products, orders) + Proxypay/EMIS Multicaixa Express (Angola) OU Stripe", plano: "1) Criar tabelas products, cart_items, orders, order_items. 2) Integrar gateway angolano (Proxypay) via edge function server-to-server. 3) Emitir referência multicaixa e webhook de confirmação. 4) Enviar fatura via Resend." },

  // Tecnologia / Circular
  { pagina: "Tecnologia (/tecnologia)", componente: "Página informativa", estado: "UI estática", plataformas: "N/A", plano: "Considerar CMS (site_content) se copy mudar frequentemente." },
  { pagina: "Circular (/circular)", componente: "Programa de reciclagem", estado: "UI estática", plataformas: "Supabase (recycling_dropoffs)", plano: "Adicionar formulário para agendar entrega de óculos usados + mapa de pontos de recolha." },

  // Suporte
  { pagina: "Suporte (/suporte)", componente: "FAQ + contacto", estado: "UI estática", plataformas: "Supabase (faqs) + Crisp/Intercom (chat)", plano: "Migrar FAQ para tabela editável em /admin; opcional: integrar chat live (Crisp) para suporte em tempo real." },

  // Apoiar
  { pagina: "Apoiar (/apoiar)", componente: "Donativos", estado: "MOCK — sem pagamento", plataformas: "Proxypay (Angola), Stripe (internacional), PayPal", plano: "Integrar múltiplos gateways; criar tabela donations; enviar recibo via Resend; página pública de transparência." },

  // Registo Premium
  { pagina: "Registo Premium (/registo-premium)", componente: "Formulário de subscrição pro", estado: "Grava em premium_requests via edge function (assumido)", plataformas: "Supabase + Stripe Billing/Paddle", plano: "Substituir por checkout recorrente real (Stripe Subscriptions); webhook atualiza role para 'profissional' em user_roles." },

  // Dashboards
  { pagina: "Dashboard User (/dashboard)", componente: "Estatísticas do utilizador", estado: "MOCK — números hardcoded", plataformas: "Supabase (exercise_sessions, scanner_analyses)", plano: "Agregar dados reais via views SQL ou RPC (get_user_stats); usar recharts para gráficos de progresso." },
  { pagina: "Dashboard Pro (/dashboard-pro)", componente: "Painel clínico", estado: "MOCK", plataformas: "Supabase (patients, appointments) + RLS por clínica", plano: "Modelar entidades clínicas com RLS por clinic_id; adicionar upload de exames em bucket privado." },
  { pagina: "Editar Perfil (/editar-perfil)", componente: "Update de perfil", estado: "Parcial", plataformas: "Supabase (profiles) + Storage (avatars)", plano: "Adicionar upload de avatar em bucket avatars com policy owner-only; validar province/gender com enums." },

  // Admin
  { pagina: "Admin (/admin)", componente: "Overview", estado: "Provavelmente com queries reais", plataformas: "Supabase RPC", plano: "Criar RPC admin_overview_metrics agregando counts (users, feedback, requests) num único round-trip." },
  { pagina: "Admin (/admin/utilizadores)", componente: "Gestão de utilizadores", estado: "Funcional parcialmente", plataformas: "Supabase Admin API (service_role via edge function)", plano: "Ações destrutivas (ban/delete) só via edge function com verificação has_role('admin')." },
  { pagina: "Admin (/admin/mensagens)", componente: "Inbox contact_messages", estado: "Funcional", plataformas: "Supabase", plano: "Adicionar estado (novo/lido/respondido) e resposta direta via Resend." },
  { pagina: "Admin (/admin/banners|notificacoes|conteudo|administradores)", componente: "Gestão CMS/RBAC", estado: "Funcional", plataformas: "Supabase", plano: "Adicionar audit_log (quem alterou o quê) e soft-delete." },

  // Global
  { pagina: "Global", componente: "GlobalBanner", estado: "Lê tabela banners", plataformas: "Supabase Realtime", plano: "Ativar subscrição realtime para banners aparecerem sem refresh." },
  { pagina: "Global", componente: "Notificações push", estado: "Inexistente", plataformas: "OneSignal / Web Push API + Supabase", plano: "Registar service worker, subscrever endpoint, guardar em push_subscriptions; enviar via edge function." },
  { pagina: "Global", componente: "PWA / Offline", estado: "manifest presente, sem SW", plataformas: "vite-plugin-pwa (Workbox)", plano: "Adicionar plugin, cachear assets estáticos e páginas visitadas para uso offline (relevante em Angola)." },
  { pagina: "Global", componente: "i18n (PT-AO/EN)", estado: "Só PT", plataformas: "react-i18next", plano: "Extrair strings para JSON, adicionar seletor de idioma no Navbar." },
  { pagina: "Global", componente: "SEO / OG", estado: "Meta tags básicas", plataformas: "react-helmet-async", plano: "Meta dinâmica por rota, sitemap.xml gerado, JSON-LD Organization." },
  { pagina: "Global", componente: "Monitorização de erros", estado: "Inexistente", plataformas: "Sentry", plano: "Instalar @sentry/react com source maps, capturar erros de UI e edge functions." },
  { pagina: "Global", componente: "Analytics", estado: "Inexistente", plataformas: "PostHog / GA4 / Plausible", plano: "Instalar snippet, tracking de eventos-chave (scan_completed, exercise_finished, donation_started)." },
];

const RoadmapTecnico = () => {
  const csv = useMemo(() => {
    const header = ["Página/Aba", "Componente/Funcionalidade", "Estado Atual", "Plataformas Recomendadas", "Plano de Ação"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = AUDIT.map((r) => [r.pagina, r.componente, r.estado, r.plataformas, r.plano].map(escape).join(","));
    return "\ufeff" + [header.map(escape).join(","), ...rows].join("\n");
  }, []);

  const downloadCsv = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "Roadmap_Tecnico_Janelas_Para_A_Alma.csv";
      a.setAttribute("data-testid", "csv-download-link");
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error("Erro ao exportar CSV:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container py-10 md:py-16 max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/10 text-teal text-xs font-semibold uppercase tracking-wide mb-3">
              Auditoria Técnica Interna
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">Roadmap Técnico — Janelas Para a Alma</h1>
            <p className="mt-3 text-muted-foreground max-w-3xl text-justify">
              Mapa exaustivo do estado atual (UI vs. funcional) de todas as páginas, rotas e componentes,
              com as plataformas recomendadas e o plano de ação para tornar cada funcionalidade 100% real
              e pronta para produção. Página oculta — não listada no menu.
            </p>
          </div>
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal text-teal-foreground font-semibold text-sm hover:bg-teal/90 transition-colors shadow-elevated"
          >
            <Download className="w-4 h-4" /> Exportar para CSV
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Página/Aba</th>
                  <th className="px-4 py-3 font-semibold">Componente/Funcionalidade</th>
                  <th className="px-4 py-3 font-semibold">Estado Atual</th>
                  <th className="px-4 py-3 font-semibold">Plataformas Recomendadas</th>
                  <th className="px-4 py-3 font-semibold min-w-[320px]">Plano de Ação</th>
                </tr>
              </thead>
              <tbody>
                {AUDIT.map((r, i) => {
                  const isMock = /mock|inexistente|hardcoded/i.test(r.estado);
                  const isPartial = /parcial|estática|ui/i.test(r.estado);
                  const badge = isMock
                    ? "bg-red-500/15 text-red-600 border-red-500/30"
                    : isPartial
                    ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/30"
                    : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
                  return (
                    <tr key={i} className="border-t border-border align-top hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{r.pagina}</td>
                      <td className="px-4 py-3">{r.componente}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${badge}`}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.plataformas}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.plano}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Total de itens auditados: <strong>{AUDIT.length}</strong>. Legenda: vermelho = mock / inexistente;
          amarelo = parcial ou apenas UI; verde = funcional.
        </p>
      </div>
    </div>
  );
};

export default RoadmapTecnico;

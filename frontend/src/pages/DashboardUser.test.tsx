import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const T = ptAO.PainelApp;

// O painel só mostra o que a API devolveu: o histórico de rastreios, a próxima
// teleconsulta e o acesso aos exercícios. Uma falha numa chamada nunca rebenta o
// ecrã nem inventa um número.

const listarMinhas = vi.fn();
const minhaProximaTeleconsulta = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  screeningsApi: { listarMinhas: (...a: unknown[]) => listarMinhas(...a) },
  agendamentosApi: { minhaProximaTeleconsulta: (...a: unknown[]) => minhaProximaTeleconsulta(...a) },
  linkDaSalaVideo: (sala: string) => `https://meet.jit.si/${sala}`,
}));

vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/PremiumRequestBanner", () => ({ default: () => null }));

const logout = vi.fn();
let mockUser: { id: string; name: string; avatarUrl?: string } | null = { id: "u-1", name: "Ana Silva" };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser, logout }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: null }) }));

let mockDesbloqueados: string[] = [];
let mockEstadoAcesso = "trial_terminado";
vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({
    acesso: { exercicios_desbloqueados: mockDesbloqueados, estado: mockEstadoAcesso },
  }),
}));

import DashboardUser from "./DashboardUser";

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardUser />} />
        <Route path="*" element={<p>Outra página</p>} />
      </Routes>
    </MemoryRouter>,
  );

const rastreio = (id: string, diagnostico: string, criado_em = "2026-10-06T19:53:00Z") => ({ id, diagnostico, criado_em });

/** O cartão do próximo passo, depois de os dados chegarem. */
const passo = async () => within(await screen.findByRole("region", { name: T.proximoPasso }));

beforeEach(() => {
  listarMinhas.mockReset().mockResolvedValue([]);
  minhaProximaTeleconsulta.mockReset().mockResolvedValue(null);
  logout.mockReset();
  mockUser = { id: "u-1", name: "Ana Silva" };
  mockDesbloqueados = [];
  mockEstadoAcesso = "trial_terminado";
});

describe("DashboardUser — saudação e navegação", () => {
  it("cumprimenta pelo primeiro nome", async () => {
    montar();
    expect(await screen.findByRole("heading", { level: 1, name: "Olá, Ana" })).toBeInTheDocument();
  });

  it("tem uma só navegação, com o separador actual marcado", async () => {
    montar();
    const nav = await screen.findByRole("navigation", { name: T.navegacao });
    expect(within(nav).getByRole("link", { name: T.inicio })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: T.treinos })).toHaveAttribute("href", "/exercicios");
    expect(within(nav).getByRole("link", { name: T.progresso })).toHaveAttribute("href", "/exercicios/progresso");
  });

  it("o menu da conta sai da sessão e vai para a página inicial", async () => {
    const u = userEvent.setup();
    montar();
    await u.click(await screen.findByRole("button", { name: "Conta de Ana Silva" }));
    await u.click(await screen.findByRole("menuitem", { name: "Sair" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Outra página")).toBeInTheDocument();
  });

  it("sem utilizador autenticado, nunca chama a API", () => {
    mockUser = null;
    montar();
    expect(listarMinhas).not.toHaveBeenCalled();
    expect(minhaProximaTeleconsulta).not.toHaveBeenCalled();
  });
});

describe("DashboardUser — resumo", () => {
  it("mostra a contagem real de rastreios e o último, com o seu resultado", async () => {
    listarMinhas.mockResolvedValue([rastreio("3", "inconclusivo"), rastreio("2", "normal"), rastreio("1", "normal")]);
    montar();
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText(ptAO.ResultadoRastreio.rotuloInconclusivo)).toBeInTheDocument();
  });

  it("uma falha ao carregar o histórico mostra '—', nunca um 0 inventado, e não rebenta o ecrã", async () => {
    listarMinhas.mockRejectedValue(new Error("falha de rede"));
    montar();
    const rotulo = await screen.findByText(T.rastreiosFeitos);
    expect(rotulo.nextSibling).toHaveTextContent("—");
    expect(rotulo.nextSibling).not.toHaveTextContent("0");
  });

  it("conta os exercícios abertos em 8: 0 sem nada, 4 com o teste, 8 com Premium", async () => {
    mockDesbloqueados = ["figure8", "ambliopia", "cerebro", "relax"];
    montar();
    expect(await screen.findByText("4 de 8")).toBeInTheDocument();
  });

  it("sem teste nem Premium, 0 de 8 (os 8 exercícios são pagos)", async () => {
    montar();
    expect(await screen.findByText("0 de 8")).toBeInTheDocument();
  });
});

describe("DashboardUser — o próximo passo", () => {
  it("enquanto os dados chegam, não afirma nada", () => {
    listarMinhas.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByRole("status")).toHaveTextContent(T.aPreparar);
    expect(screen.queryByRole("link", { name: T.fazerRastreio })).not.toBeInTheDocument();
  });

  it("com uma teleconsulta marcada: a data, a clínica e a sala (noutro separador)", async () => {
    minhaProximaTeleconsulta.mockResolvedValue({
      agendamento_id: "ag-1",
      clinica_nome: "Óptica Optioptika",
      horario_inicio: "2027-01-04T09:00:00+00:00",
      sala_video: "janelas-para-alma-abc123",
    });
    montar();
    const r = await passo();
    expect(await r.findByText(/Óptica Optioptika/)).toBeInTheDocument();
    const sala = r.getByRole("link", { name: T.entrarNaSala });
    expect(sala).toHaveAttribute("href", "https://meet.jit.si/janelas-para-alma-abc123");
    expect(sala).toHaveAttribute("target", "_blank");
    expect(sala.getAttribute("rel")).toContain("noopener");
  });

  it("uma falha na teleconsulta cai no resto da regra, sem rebentar", async () => {
    minhaProximaTeleconsulta.mockRejectedValue(new Error("falha de rede"));
    montar();
    const r = await passo();
    expect(await r.findByRole("link", { name: T.fazerRastreio })).toBeInTheDocument();
  });

  it("o último rastreio pediu avaliação: marcar consulta, ligada a esse rastreio", async () => {
    listarMinhas.mockResolvedValue([rastreio("r-9", "requer_avaliacao")]);
    montar();
    const r = await passo();
    expect(await r.findByRole("link", { name: T.marcarConsulta })).toHaveAttribute(
      "href",
      "/marcar-consulta?rastreio=r-9",
    );
  });

  it("nunca fez um rastreio: o primeiro rastreio", async () => {
    montar();
    const r = await passo();
    expect(await r.findByRole("link", { name: T.fazerRastreio })).toHaveAttribute("href", "/scanner");
  });

  it("o último rastreio não mediu: repetir", async () => {
    listarMinhas.mockResolvedValue([rastreio("r-2", "inconclusivo")]);
    montar();
    const r = await passo();
    expect(await r.findByRole("link", { name: T.repetirRastreio })).toHaveAttribute("href", "/scanner");
  });

  it("com exercícios abertos: continuar os treinos", async () => {
    listarMinhas.mockResolvedValue([rastreio("r-1", "normal")]);
    mockDesbloqueados = ["figure8"];
    mockEstadoAcesso = "trial_ativo";
    montar();
    const r = await passo();
    expect(await r.findByRole("link", { name: T.verTreinos })).toHaveAttribute("href", "/exercicios");
  });

  it("com o teste de 7 dias por usar: começá-lo (na página que explica e confirma)", async () => {
    listarMinhas.mockResolvedValue([rastreio("r-1", "normal")]);
    mockEstadoAcesso = "trial_disponivel";
    montar();
    const r = await passo();
    expect(await r.findByRole("link", { name: T.comecarTeste })).toHaveAttribute("href", "/teste-de-7-dias");
  });

  it("sem exercícios e sem teste por usar: o Premium", async () => {
    listarMinhas.mockResolvedValue([rastreio("r-1", "normal")]);
    montar();
    const r = await passo();
    expect(await r.findByRole("link", { name: T.verPremium })).toHaveAttribute("href", "/registo-premium");
  });
});

describe("DashboardUser — acessibilidade", () => {
  it("sem violações de acessibilidade, com os dados carregados", async () => {
    listarMinhas.mockResolvedValue([rastreio("r-1", "normal")]);
    mockDesbloqueados = ["figure8"];
    const { container } = montar();
    await screen.findByRole("link", { name: T.verTreinos });
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

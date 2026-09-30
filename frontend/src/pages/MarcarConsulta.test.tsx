import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const T = ptAO.MarcarConsulta;

const listarClinicas = vi.fn();
const horariosDisponiveis = vi.fn();
const pedir = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  agendamentosApi: {
    listarClinicas: (...a: unknown[]) => listarClinicas(...a),
    horariosDisponiveis: (...a: unknown[]) => horariosDisponiveis(...a),
    pedir: (...a: unknown[]) => pedir(...a),
  },
}));

let mockLogado = false;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: mockLogado, user: null, loading: false }),
}));

let mockPerfil: { nome_completo: string; email: string; telefone: string | null } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockPerfil }),
}));

import MarcarConsulta from "./MarcarConsulta";

// Segunda, 5 de Outubro de 2026: 08:00 e 08:30 UTC são 09:00 e 09:30 em Luanda.
const HORARIOS = [
  { inicio: "2026-10-05T08:00:00Z", fim: "2026-10-05T08:30:00Z" },
  { inicio: "2026-10-05T08:30:00Z", fim: "2026-10-05T09:00:00Z" },
  { inicio: "2026-10-06T08:00:00Z", fim: "2026-10-06T08:30:00Z" },
];

const PEDIDO = {
  id: "abcdef12-0000",
  clinica_id: "clinica-1",
  nome: "Ana Silva",
  email: "ana@exemplo.ao",
  telefone: "923000000",
  modalidade: "presencial",
  data_preferida: null,
  periodo_preferido: null,
  horario_inicio: HORARIOS[0]!.inicio,
  motivo: null,
  estado: "pendente",
  created_at: "2026-10-01T10:00:00Z",
};

beforeEach(() => {
  mockLogado = false;
  mockPerfil = null;
  listarClinicas.mockReset().mockResolvedValue([{ id: "clinica-1", nome: "Óptica Optioptika" }]);
  horariosDisponiveis.mockReset().mockResolvedValue(HORARIOS);
  pedir.mockReset().mockResolvedValue(PEDIDO);
});

const montar = (url = "/marcar-consulta") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/marcar-consulta" element={<MarcarConsulta />} />
        <Route path="/" element={<p>Página inicial</p>} />
      </Routes>
    </MemoryRouter>,
  );

/** A acção principal existe duas vezes no DOM (barra do telemóvel e fim da coluna). */
const accao = async (nome: string) => (await screen.findAllByRole("button", { name: nome }))[0]!;

async function escolherPresencialEHora(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByText(T.presencial));
  await u.click(await accao(T.continuar));
  await u.click(await screen.findByRole("radio", { name: "09:00" }));
  await u.click(await accao(T.continuar));
  await screen.findByRole("heading", { name: T.dadosTitulo });
}

async function preencherDados(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByRole("textbox", { name: T.nome }), "  Ana Silva ");
  await u.type(screen.getByRole("textbox", { name: T.email }), "ana@exemplo.ao");
  await u.type(screen.getByRole("textbox", { name: T.telefone }), "923 000 000");
}

describe("MarcarConsulta — percurso completo", () => {
  it("como → quando → dados → confirmar → enviado, com o pedido certo", async () => {
    const u = userEvent.setup();
    montar();
    await escolherPresencialEHora(u);
    await preencherDados(u);
    await u.click(await accao(T.continuar));

    // Confirmar: tudo à vista, com "Alterar".
    await screen.findByRole("heading", { name: T.confirmarTitulo });
    expect(screen.getByText(/segunda-feira, 5 de outubro, às 09:00 \(hora de Luanda\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Alterar: ${T.rotuloQuando}` })).toBeInTheDocument();
    expect(screen.getByText(T.partilhado)).toBeInTheDocument();
    expect(pedir).not.toHaveBeenCalled();

    await u.click(await accao(T.enviar));
    expect(await screen.findByRole("heading", { name: T.enviadoTitulo })).toBeInTheDocument();
    expect(pedir).toHaveBeenCalledWith({
      clinica_id: "clinica-1",
      nome: "Ana Silva",
      email: "ana@exemplo.ao",
      telefone: "923 000 000",
      modalidade: "presencial",
      horario_inicio: HORARIOS[0]!.inicio,
      motivo: null,
      screening_id: null,
    });
    expect(screen.getByText("ABCDEF12")).toBeInTheDocument();
    // Diz "pedido enviado", nunca "consulta confirmada": quem confirma é a clínica.
    expect(document.body.textContent).not.toMatch(/consulta confirmada/i);
  });

  it("as horas são as de Luanda e os dias vêm agrupados", async () => {
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByText(T.presencial));
    await u.click(await accao(T.continuar));
    const dias = await screen.findByRole("group", { name: T.legendaDia });
    expect(within(dias).getAllByRole("radio")).toHaveLength(2);
    expect(within(dias).getByRole("radio", { name: /segunda-feira, 5 de outubro/ })).toBeChecked();
    const horas = screen.getByRole("group", { name: T.legendaHora });
    expect(within(horas).getAllByRole("radio").map((r) => r.getAttribute("aria-label") ?? r.closest("label")?.textContent)).toEqual([
      "09:00",
      "09:30",
    ]);
  });

  it("com sessão: dados pré-preenchidos do perfil e o pedido ligado ao rastreio", async () => {
    mockLogado = true;
    mockPerfil = { nome_completo: "Ana Silva", email: "ana@exemplo.ao", telefone: "923000000" };
    const u = userEvent.setup();
    montar("/marcar-consulta?rastreio=scr-9");
    await escolherPresencialEHora(u);
    expect(screen.getByRole("textbox", { name: T.nome })).toHaveValue("Ana Silva");
    await u.click(await accao(T.continuar));
    await u.click(await accao(T.enviar));
    await waitFor(() => expect(pedir).toHaveBeenCalledWith(expect.objectContaining({ screening_id: "scr-9" })));
  });

  it("sem sessão, um ?rastreio= no endereço não é enviado", async () => {
    const u = userEvent.setup();
    montar("/marcar-consulta?rastreio=de-outra-pessoa");
    await escolherPresencialEHora(u);
    await preencherDados(u);
    await u.click(await accao(T.continuar));
    await u.click(await accao(T.enviar));
    await waitFor(() => expect(pedir).toHaveBeenCalledWith(expect.objectContaining({ screening_id: null })));
  });
});

describe("MarcarConsulta — caminhos de erro", () => {
  it("falha ao carregar os horários diz que falhou (nunca 'sem horários') e deixa tentar de novo", async () => {
    horariosDisponiveis.mockRejectedValueOnce(new Error("rede"));
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByText(T.presencial));
    await u.click(await accao(T.continuar));
    expect(await screen.findByRole("alert")).toHaveTextContent(T.erroHorariosTitulo);
    expect(screen.queryByText(T.semHorariosTitulo)).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: T.tentarDeNovo }));
    expect(await screen.findByRole("radio", { name: "09:00" })).toBeInTheDocument();
  });

  it("falha ao carregar a clínica também é um erro, não 'verifique os campos'", async () => {
    listarClinicas.mockRejectedValueOnce(new Error("rede"));
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByText(T.presencial));
    await u.click(await accao(T.continuar));
    expect(await screen.findByRole("alert")).toHaveTextContent(T.erroHorariosTitulo);
  });

  it("sem nenhuma clínica activa, diz que não há horários (não que falhou)", async () => {
    // Bug real (2026-09-30, base de dados local vazia): uma lista de clínicas
    // vazia aparecia como "Não foi possível ver os horários".
    listarClinicas.mockResolvedValue([]);
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByText(T.presencial));
    await u.click(await accao(T.continuar));
    expect(await screen.findByText(T.semHorariosTitulo)).toBeInTheDocument();
    expect(screen.queryByText(T.erroHorariosTitulo)).not.toBeInTheDocument();
    expect(horariosDisponiveis).not.toHaveBeenCalled();
  });

  it("sem horários livres: diz-se, com outra modalidade e o telefone da clínica", async () => {
    horariosDisponiveis.mockResolvedValue([]);
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByText(T.online));
    await u.click(await accao(T.continuar));
    expect(await screen.findByText(T.semHorariosTitulo)).toBeInTheDocument();
    expect(screen.getByText(T.semHorariosOnline)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ligar para a clínica/ })).toHaveAttribute("href", "tel:+244931240304");
    expect(screen.getByRole("button", { name: T.trocarModalidade })).toBeInTheDocument();
  });

  it("dados inválidos: diz em cada campo o que falta, põe o foco no primeiro e não avança", async () => {
    const u = userEvent.setup();
    montar();
    await escolherPresencialEHora(u);
    await u.type(screen.getByRole("textbox", { name: T.email }), "ana");
    await u.click(await accao(T.continuar));
    expect(screen.getByRole("textbox", { name: T.nome })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: T.nome })).toHaveAccessibleDescription(
      expect.stringContaining(T.erroNomeCurto),
    );
    expect(screen.getByText(T.erroEmailInvalido)).toBeInTheDocument();
    expect(screen.getByText(T.erroTelefoneInvalido)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: T.dadosTitulo })).toBeInTheDocument();
  });

  it("horário ocupado entretanto (409): volta à escolha, com a lista nova e o aviso", async () => {
    pedir.mockRejectedValueOnce(Object.assign(new Error("ocupado"), { status: 409 }));
    const u = userEvent.setup();
    montar();
    await escolherPresencialEHora(u);
    await preencherDados(u);
    await u.click(await accao(T.continuar));
    await u.click(await accao(T.enviar));
    expect(await screen.findByText(T.horarioOcupado)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: T.quandoTitulo })).toBeInTheDocument();
    expect(horariosDisponiveis).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(T.enviadoTitulo)).not.toBeInTheDocument();
  });

  it("falha de rede ao enviar: fica no resumo, com os dados, e tentar de novo funciona", async () => {
    pedir.mockRejectedValueOnce(new Error("Failed to fetch"));
    const u = userEvent.setup();
    montar();
    await escolherPresencialEHora(u);
    await preencherDados(u);
    await u.click(await accao(T.continuar));
    await u.click(await accao(T.enviar));
    expect(await screen.findByRole("alert")).toHaveTextContent(T.erroEnvioTitulo);
    expect(screen.queryByText(T.enviadoTitulo)).not.toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    await u.click(await accao(T.enviar));
    expect(await screen.findByRole("heading", { name: T.enviadoTitulo })).toBeInTheDocument();
  });

  it("'Alterar' no resumo volta ao passo certo", async () => {
    const u = userEvent.setup();
    montar();
    await escolherPresencialEHora(u);
    await preencherDados(u);
    await u.click(await accao(T.continuar));
    await u.click(await screen.findByRole("button", { name: `Alterar: ${T.rotuloComo}` }));
    expect(await screen.findByRole("heading", { name: T.comoTitulo })).toBeInTheDocument();
  });
});

describe("MarcarConsulta — acessibilidade", () => {
  it("sem violações ao escolher o tipo e o horário", async () => {
    const u = userEvent.setup();
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
    await u.click(screen.getByText(T.presencial));
    await u.click(await accao(T.continuar));
    await screen.findByRole("radio", { name: "09:00" });
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

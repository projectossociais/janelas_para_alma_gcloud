import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const T = ptAO.RegistoPremium;

// O comprovativo do pagamento Premium vai directo ao R2 em 3 passos (mesmo padrão
// do avatar). O que mais importa testar é o caminho do erro em cada passo: nunca
// mostrar "enviado" sem os três terem corrido bem.

const prepararComprovativo = vi.fn();
const enviarParaStorage = vi.fn();
const pedirPremium = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  comprovativosApi: {
    preparar: (...a: unknown[]) => prepararComprovativo(...a),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
  },
  premiumApi: { pedir: (...a: unknown[]) => pedirPremium(...a) },
  TIPOS_DE_COMPROVATIVO_ACEITES: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

let sessao = { isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => sessao }));

let perfil: { nome_completo: string; email: string; telefone: string | null } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: perfil }) }));

import RegistoPremium from "./RegistoPremium";

const OndeEstou = () => <p data-testid="onde">{useLocation().pathname + useLocation().search}</p>;

const montar = (entradas = ["/registo-premium"]) =>
  render(
    <MemoryRouter initialEntries={entradas} initialIndex={entradas.length - 1}>
      <Routes>
        <Route path="/registo-premium" element={<RegistoPremium />} />
        <Route path="*" element={<OndeEstou />} />
      </Routes>
    </MemoryRouter>,
  );

/** A acção principal existe duas vezes no DOM (telemóvel e computador): usa-se a primeira. */
const accao = (nome: string | RegExp) => screen.getAllByRole("button", { name: nome })[0]!;
const esperarAccao = async (nome: string | RegExp) => (await screen.findAllByRole("button", { name: nome }))[0]!;

const DADOS = { nome: "Ana Silva", email: "ana@example.com", telefone: "+244 900 000 000" };

async function escolherPlano(u: ReturnType<typeof userEvent.setup>, plano = /Plano Mensal/) {
  await u.click(screen.getByRole("radio", { name: plano }));
  await u.click(accao(T.continuar));
}

async function preencherDados(u: ReturnType<typeof userEvent.setup>) {
  await u.type(await screen.findByLabelText(T.nomeCompleto), DADOS.nome);
  await u.type(screen.getByLabelText(T.email), DADOS.email);
  await u.type(screen.getByLabelText(T.telefoneWhatsapp), DADOS.telefone);
  await u.click(accao(T.continuar));
}

async function chegarAoPagamento(u: ReturnType<typeof userEvent.setup>) {
  montar();
  await escolherPlano(u);
  await preencherDados(u);
  return screen.findByLabelText(T.comprovativoRotulo);
}

const PDF = () => new File(["x"], "comprovativo.pdf", { type: "application/pdf" });
const PREPARADO = {
  url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
  chave: "comprovativos/x.pdf",
  url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
};

beforeEach(() => {
  sessao = { isLoggedIn: true, loading: false };
  perfil = null;
  prepararComprovativo.mockReset();
  enviarParaStorage.mockReset();
  pedirPremium.mockReset();
});

describe("RegistoPremium — sem sessão", () => {
  it("o Premium fica ligado à conta: sem sessão, leva primeiro a entrar ou criar conta", () => {
    sessao = { isLoggedIn: false, loading: false };
    montar();
    expect(screen.getByRole("heading", { level: 1, name: T.gateTitulo })).toBeInTheDocument();
    // Nada de planos nem de pagamento até haver conta (a API só aprova pedidos de uma conta).
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    const entrar = screen.getAllByRole("link", { name: T.gateEntrar })[0]!;
    const criar = screen.getAllByRole("link", { name: T.gateCriar })[0]!;
    expect(entrar.getAttribute("href")).toContain("/login?next=%2Fregisto-premium");
    expect(criar.getAttribute("href")).toContain("modo=registo");
    expect(criar.getAttribute("href")).toContain("next=%2Fregisto-premium");
  });

  it("enquanto a sessão se confirma, não pisca a página de entrar", () => {
    sessao = { isLoggedIn: false, loading: true };
    montar();
    expect(screen.getByRole("status")).toHaveTextContent(T.aPreparar);
    expect(screen.queryByText(T.gateTitulo)).not.toBeInTheDocument();
  });
});

describe("RegistoPremium — plano e dados", () => {
  it("só continua depois de escolher um plano, e diz o que inclui", async () => {
    const u = userEvent.setup();
    montar();
    expect(accao(T.continuar)).toBeDisabled();
    await u.click(screen.getByRole("radio", { name: /Plano Anual/ }));
    expect(accao(T.continuar)).toBeEnabled();
    expect(screen.getByText(T.sessaoDeTriagemOnline)).toBeInTheDocument();
  });

  it("mostra os preços tal como estão (15.000 Kz e 150.000 Kz)", () => {
    montar();
    expect(screen.getByRole("radio", { name: /Plano Mensal · 15\.000 Kz/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Plano Anual · 150\.000 Kz/ })).toBeInTheDocument();
  });

  it("pré-preenche com o perfil e não volta a pedir o que já sabe", async () => {
    perfil = { nome_completo: "Ana Silva", email: "ana@example.com", telefone: "+244 900 000 000" };
    const u = userEvent.setup();
    montar();
    await escolherPlano(u);
    expect(await screen.findByLabelText(T.nomeCompleto)).toHaveValue("Ana Silva");
    expect(screen.getByLabelText(T.email)).toHaveValue("ana@example.com");
    expect(screen.getByLabelText(T.telefoneWhatsapp)).toHaveValue("+244 900 000 000");
  });

  it("dados inválidos: o erro fica no campo, o foco vai ao primeiro e não avança", async () => {
    const u = userEvent.setup();
    montar();
    await escolherPlano(u);
    await u.type(await screen.findByLabelText(T.nomeCompleto), "A");
    await u.click(accao(T.continuar));

    expect(await screen.findByText(T.nomeMuitoCurto)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(T.nomeCompleto)).toHaveFocus());
    expect(screen.queryByLabelText(T.comprovativoRotulo)).not.toBeInTheDocument();
  });

  it("não há perguntas de saúde: o perfil clínico deixou de ser pedido", async () => {
    const u = userEvent.setup();
    montar();
    await escolherPlano(u);
    expect(await screen.findByLabelText(T.nomeCompleto)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/diagn[óo]stico|para quem|sintomas/i);
  });

  it("sem violações de acessibilidade em cada passo", { timeout: 20000 }, async () => {
    const u = userEvent.setup();
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
    await escolherPlano(u);
    await screen.findByLabelText(T.nomeCompleto);
    // A troca de passo é animada: espera que o passo anterior tenha saído do ecrã.
    await waitFor(() => expect(screen.queryByRole("radio")).not.toBeInTheDocument());
    expect(await violacoesAcessibilidade(container)).toEqual([]);
    await preencherDados(u);
    await screen.findByLabelText(T.comprovativoRotulo);
    await waitFor(() => expect(screen.queryByLabelText(T.nomeCompleto)).not.toBeInTheDocument());
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

describe("RegistoPremium — comprovativo via R2 (CROSS-02)", () => {
  it("nunca conclui se o envio ao storage falhar", async () => {
    prepararComprovativo.mockResolvedValue(PREPARADO);
    enviarParaStorage.mockRejectedValue(
      Object.assign(new Error("Não foi possível enviar a imagem para o storage."), { status: 500 }),
    );
    const u = userEvent.setup();
    const campo = await chegarAoPagamento(u);

    await u.upload(campo, PDF());
    await u.click(accao(T.enviar));

    await waitFor(() => expect(enviarParaStorage).toHaveBeenCalled());
    expect(pedirPremium).not.toHaveBeenCalled();
    expect(await screen.findByText(T.erroEnvioTitulo)).toBeInTheDocument();
    expect(screen.getByText("Não foi possível enviar a imagem para o storage.")).toBeInTheDocument();
    expect(screen.queryByText(T.concluidoTitulo)).not.toBeInTheDocument();
  }, 15000);

  it("nunca conclui se o pedido Premium falhar, e deixa tentar de novo com o mesmo comprovativo", async () => {
    prepararComprovativo.mockResolvedValue(PREPARADO);
    enviarParaStorage.mockResolvedValue(undefined);
    pedirPremium.mockRejectedValueOnce(
      Object.assign(new Error("essa chave não é um comprovativo válido"), { status: 403 }),
    );
    const u = userEvent.setup();
    const campo = await chegarAoPagamento(u);

    await u.upload(campo, PDF());
    await u.click(accao(T.enviar));

    await waitFor(() => expect(pedirPremium).toHaveBeenCalled());
    expect(await screen.findByText("essa chave não é um comprovativo válido")).toBeInTheDocument();
    expect(screen.queryByText(T.concluidoTitulo)).not.toBeInTheDocument();
    // O comprovativo continua anexado: não se perde ao falhar.
    expect(screen.getByText("comprovativo.pdf")).toBeInTheDocument();
  }, 15000);

  it("só conclui depois dos três passos, e envia o pedido certo", async () => {
    prepararComprovativo.mockResolvedValue(PREPARADO);
    enviarParaStorage.mockResolvedValue(undefined);
    pedirPremium.mockResolvedValue({ id: "ped-1", status: "pendente" });
    const u = userEvent.setup();
    const campo = await chegarAoPagamento(u);

    await u.upload(campo, PDF());
    await u.click(accao(T.enviar));

    expect(await screen.findByRole("heading", { name: T.concluidoTitulo })).toBeInTheDocument();
    expect(prepararComprovativo).toHaveBeenCalledWith("application/pdf");
    expect(pedirPremium).toHaveBeenCalledWith({
      nome: DADOS.nome,
      email: DADOS.email,
      telefone: DADOS.telefone,
      plano: "mensal",
      comprovativo_chave: "comprovativos/x.pdf",
    });
  }, 15000);

  it("sem comprovativo diz o que falta e não chama a API", async () => {
    const u = userEvent.setup();
    await chegarAoPagamento(u);
    await u.click(accao(T.enviar));
    expect(await screen.findByText(T.erroSemComprovativo)).toBeInTheDocument();
    expect(prepararComprovativo).not.toHaveBeenCalled();
  }, 15000);

  it("mostra o plano e o total a pagar, e os dados bancários", async () => {
    const u = userEvent.setup();
    await chegarAoPagamento(u);
    expect(screen.getByText(T.totalAPagarHoje)).toBeInTheDocument();
    expect(screen.getAllByText(T.n15000Kz).length).toBeGreaterThan(0);
    expect(screen.getByText(/MULTICAIXA EXPRESS/)).toBeInTheDocument();
  }, 15000);
});

const Navegar = () => {
  const navigate = useNavigate();
  return (
    <>
      <OndeEstou />
      <button onClick={() => navigate("/registo-premium")}>ir</button>
    </>
  );
};

describe("RegistoPremium — sair", () => {
  it("regressa à página de onde veio (ex.: /exercicios), com confirmação", async () => {
    const u = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/exercicios"]}>
        <Routes>
          <Route path="/registo-premium" element={<RegistoPremium />} />
          <Route path="*" element={<Navegar />} />
        </Routes>
      </MemoryRouter>,
    );
    await u.click(screen.getByRole("button", { name: "ir" }));
    await u.click(screen.getByRole("button", { name: T.sair }));
    await u.click(await screen.findByRole("button", { name: T.confirmarSair }));
    expect(await screen.findByTestId("onde")).toHaveTextContent("/exercicios");
  });

  it("aberto directamente (sem histórico no site), vai para /exercicios", async () => {
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByRole("button", { name: T.sair }));
    await u.click(await screen.findByRole("button", { name: T.confirmarSair }));
    expect(await screen.findByTestId("onde")).toHaveTextContent("/exercicios");
  });
});

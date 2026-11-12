import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const prepararDocumento = vi.fn();
const enviarParaStorage = vi.fn();
const submeter = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  MAX_BYTES_DOCUMENTO_DE_PARCERIA: 8 * 1024 * 1024,
  MAX_DOCUMENTOS_DE_PARCERIA: 5,
  TIPOS_DE_DOCUMENTO_DE_PARCERIA: ["application/pdf", "image/png", "image/jpeg"],
  TIPOS_DE_PARCEIRO: ["clinica_oftalmologica", "optica", "outro"],
  parceriasApi: {
    prepararDocumento: (...a: unknown[]) => prepararDocumento(...a),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
    submeter: (...a: unknown[]) => submeter(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));
// O Select do Radix não abre em jsdom: troca-se por um <select> nativo.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select aria-label="tipo" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));

import RegistoParceiro from "./RegistoParceiro";

async function preencher(user: ReturnType<typeof userEvent.setup>, opcoes = { tipo: true, declaracao: true }) {
  await user.type(screen.getByLabelText("Denominação social"), "Clínica Visão Clara, Lda.");
  await user.type(screen.getByLabelText("NIF da empresa"), "5001234567");
  if (opcoes.tipo) await user.selectOptions(screen.getByLabelText("tipo"), "clinica_oftalmologica");
  await user.type(screen.getByLabelText("Província"), "Luanda");
  await user.type(screen.getByLabelText("Nome completo"), "Ana Silva");
  await user.type(screen.getByLabelText("Cargo"), "Directora Clínica");
  await user.type(screen.getByLabelText("Email profissional"), "ana@visaoclara.ao");
  await user.type(screen.getByLabelText("Telefone"), "+244 923 000 000");
  if (opcoes.declaracao) await user.click(screen.getByRole("checkbox"));
}

describe("RegistoParceiro", () => {
  beforeEach(() => {
    prepararDocumento.mockReset().mockResolvedValue({ url_de_upload: "https://r2/put", chave: "parcerias/a.pdf" });
    enviarParaStorage.mockReset().mockResolvedValue(undefined);
    submeter.mockReset().mockResolvedValue({ referencia: "PAR-ABC123" });
    toastError.mockReset();
    window.scrollTo = vi.fn();
  });

  it("mostra os dados legais da empresa, sem a morada da sede", () => {
    render(<RegistoParceiro />, { wrapper: MemoryRouter });

    expect(screen.getByText("Olhar Alinhado - Comércio & Prestação de Serviços, Lda.")).toBeInTheDocument();
    expect(screen.getByText("5003659364")).toBeInTheDocument();
    expect(screen.getByText("47643-26/261001")).toBeInTheDocument();
    expect(screen.getByText("Luanda, Angola")).toBeInTheDocument();
    expect(screen.queryByText(/Moncada|Ingombota/)).not.toBeInTheDocument();
  });

  it("envia o documento ao storage e submete o registo com a chave dele", async () => {
    const user = userEvent.setup();
    render(<RegistoParceiro />, { wrapper: MemoryRouter });
    await preencher(user);
    const ficheiro = new File(["%PDF"], "Alvará.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("rp-ficheiro"), ficheiro);
    expect(await screen.findByText("Alvará.pdf")).toBeInTheDocument();
    expect(enviarParaStorage).toHaveBeenCalledWith("https://r2/put", ficheiro);

    await user.click(screen.getByRole("button", { name: "Submeter registo" }));

    await waitFor(() => expect(submeter).toHaveBeenCalledTimes(1));
    expect(submeter.mock.calls[0][0]).toEqual({
      denominacao: "Clínica Visão Clara, Lda.",
      nif: "5001234567",
      tipo: "clinica_oftalmologica",
      provincia: "Luanda",
      morada: null,
      website: null,
      representante_nome: "Ana Silva",
      representante_cargo: "Directora Clínica",
      email: "ana@visaoclara.ao",
      telefone: "+244 923 000 000",
      mensagem: null,
      documentos: [{ chave: "parcerias/a.pdf", nome: "Alvará.pdf", content_type: "application/pdf" }],
      declaracao: true,
    });
    expect(await screen.findByText("Registo recebido")).toBeInTheDocument();
    expect(screen.getByText("PAR-ABC123")).toBeInTheDocument();
  });

  it("se a API falhar, mostra o erro e nunca o ecrã de sucesso", async () => {
    submeter.mockRejectedValue(Object.assign(new Error("serviço indisponível"), { status: 503 }));
    const user = userEvent.setup();
    render(<RegistoParceiro />, { wrapper: MemoryRouter });
    await preencher(user);

    await user.click(screen.getByRole("button", { name: "Submeter registo" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("serviço indisponível"));
    expect(screen.queryByText("Registo recebido")).not.toBeInTheDocument();
    // O formulário continua preenchido para tentar de novo.
    expect(screen.getByLabelText("Denominação social")).toHaveValue("Clínica Visão Clara, Lda.");
  });

  it("sem a declaração aceite não submete", async () => {
    const user = userEvent.setup();
    render(<RegistoParceiro />, { wrapper: MemoryRouter });
    await preencher(user, { tipo: true, declaracao: false });

    await user.click(screen.getByRole("button", { name: "Submeter registo" }));

    expect(submeter).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Tem de aceitar a declaração para submeter o registo.");
  });

  it("sem o tipo de entidade não submete", async () => {
    const user = userEvent.setup();
    render(<RegistoParceiro />, { wrapper: MemoryRouter });
    await preencher(user, { tipo: false, declaracao: true });

    await user.click(screen.getByRole("button", { name: "Submeter registo" }));

    expect(submeter).not.toHaveBeenCalled();
  });

  it("um documento que falha a enviar não entra na lista nem no registo", async () => {
    enviarParaStorage.mockRejectedValue(new Error("rede"));
    const user = userEvent.setup();
    render(<RegistoParceiro />, { wrapper: MemoryRouter });
    await preencher(user);
    await user.upload(screen.getByTestId("rp-ficheiro"), new File(["x"], "Alvará.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByText("Alvará.pdf")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submeter registo" }));

    await waitFor(() => expect(submeter).toHaveBeenCalled());
    expect(submeter.mock.calls[0][0].documentos).toEqual([]);
  });

  it("recusa um tipo de ficheiro fora da lista sem chamar a API", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<RegistoParceiro />, { wrapper: MemoryRouter });

    await user.upload(screen.getByTestId("rp-ficheiro"), new File(["x"], "virus.zip", { type: "application/zip" }));

    expect(prepararDocumento).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Só são aceites ficheiros PDF, PNG ou JPEG.");
  });
});

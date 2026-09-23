import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/i18n";
import PartnerDialog from "./PartnerDialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * O tipo de parceria segue para o formulário por email (formsubmit). O valor
 * enviado tem de ser sempre o português, mesmo com a página em inglês -- só o
 * rótulo mostrado é traduzido.
 */
describe("PartnerDialog -- valor estável do tipo de parceria", () => {
  let corpoEnviado: Record<string, string> | null = null;

  beforeEach(() => {
    corpoEnviado = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        corpoEnviado = JSON.parse(String(init.body));
        return new Response("{}", { status: 200 });
      }),
    );
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await i18n.changeLanguage("pt-AO");
  });

  it.each([
    ["pt-AO", /Quero ser parceiro/i, "Clínica Oftalmológica", /Nome da instituição/i, /^Nome completo$/i, /Conte-nos/i, /Enviar proposta/i],
    ["en-US", /Become a partner/i, "Eye Clinic", /Organization or individual name/i, /^Full name$/i, /Tell us how/i, /Send proposal/i],
  ])("em %s, mostra o rótulo do idioma e envia 'Clínica Oftalmológica'", async (idioma, abrir, rotulo, nome, pessoa, mensagem, enviar) => {
    await i18n.changeLanguage(idioma);
    const user = userEvent.setup();
    render(<PartnerDialog />);

    await user.click(screen.getByRole("button", { name: abrir }));
    await user.type(screen.getByPlaceholderText(nome), "Clínica Teste");
    await user.type(screen.getByPlaceholderText(pessoa), "Ana Silva");
    await user.type(screen.getByPlaceholderText(/^email@ex(e|a)mpl(o|e)\.com$/), "clinica@exemplo.ao");
    await user.type(screen.getByPlaceholderText(/\+244/), "923000000");
    await user.type(screen.getByPlaceholderText(mensagem), "Queremos colaborar.");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: rotulo }));
    await user.click(screen.getByRole("button", { name: enviar }));

    await waitFor(() => expect(corpoEnviado).not.toBeNull());
    expect(corpoEnviado!["Tipo de Parceria"]).toBe("Clínica Oftalmológica");
  });
});

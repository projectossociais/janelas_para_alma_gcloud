import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import NovidadesSection from "./NovidadesSection";

describe("NovidadesSection -- cartão da firma Olhar Alinhado", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-AO");
  });

  it("mostra o cartão com tag e resumo, e 'Saiba mais...' abre o modal com o detalhe", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NovidadesSection />
      </MemoryRouter>,
    );

    const cartao = screen.getByRole("button", { name: /Oficialização da Nossa Firma Comercial/i });
    expect(within(cartao).getByText("Institucional / Marco")).toBeInTheDocument();
    expect(within(cartao).getByText(/constituição da Olhar Alinhado/i)).toBeInTheDocument();
    expect(within(cartao).getByText("Saiba mais...")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(cartao);

    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByRole("heading", { name: /Um Novo Capítulo/i })).toBeInTheDocument();
    expect(within(modal).getByText(/Compromisso com a transparência/i)).toBeInTheDocument();
    expect(within(modal).getByText(/teleconsultas médicas especializadas/i)).toBeInTheDocument();
  });

  it("os outros cartões continuam a ser links", () => {
    render(
      <MemoryRouter>
        <NovidadesSection />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Notícias sobre a Saúde Visual/i })).toHaveAttribute(
      "href",
      "https://www.cnnbrasil.com.br/tudo-sobre/saude-ocular/",
    );
  });
});

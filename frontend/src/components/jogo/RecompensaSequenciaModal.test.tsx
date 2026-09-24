import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecompensaSequenciaModal from "./RecompensaSequenciaModal";

describe("RecompensaSequenciaModal (Level Up)", () => {
  it("mostra a sequência atingida e os diamantes ganhos", async () => {
    render(<RecompensaSequenciaModal recompensa={{ sequencia: 6, diamantes: 20 }} onContinuar={() => {}} />);

    expect(await screen.findByRole("heading", { name: "Level Up!" })).toBeInTheDocument();
    expect(screen.getByText("6 respostas certas seguidas!")).toBeInTheDocument();
    expect(screen.getByLabelText("20 diamantes ganhos")).toHaveTextContent("+20");
  });

  it("'Continuar' fecha a celebração", async () => {
    const onContinuar = vi.fn();
    render(<RecompensaSequenciaModal recompensa={{ sequencia: 3, diamantes: 10 }} onContinuar={onContinuar} />);

    await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    expect(onContinuar).toHaveBeenCalledTimes(1);
  });

  it("fechar com Escape também continua o jogo", async () => {
    const onContinuar = vi.fn();
    render(<RecompensaSequenciaModal recompensa={{ sequencia: 3, diamantes: 10 }} onContinuar={onContinuar} />);
    await screen.findByRole("heading", { name: "Level Up!" });

    await userEvent.keyboard("{Escape}");
    expect(onContinuar).toHaveBeenCalled();
  });

  it("sem recompensa, não mostra nada", () => {
    render(<RecompensaSequenciaModal recompensa={null} onContinuar={() => {}} />);
    expect(screen.queryByRole("heading", { name: "Level Up!" })).not.toBeInTheDocument();
  });
});

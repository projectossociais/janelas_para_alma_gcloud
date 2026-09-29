import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ExercicioVideo from "./ExercicioVideo";

let videoMock = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  exerciciosApi: { video: (...args: unknown[]) => videoMock(...args) },
}));

describe("ExercicioVideo", () => {
  beforeEach(() => {
    videoMock = vi.fn();
  });

  it("começa fechado, sem pedir o vídeo à API antes de o utilizador clicar", () => {
    render(<ExercicioVideo exercicioId="ambliopia" />);
    expect(videoMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Ver vídeo explicativo/i })).toBeInTheDocument();
  });

  it("ao clicar, pede o vídeo com o exercicioId certo e mostra o leitor com o URL assinado", async () => {
    videoMock.mockResolvedValue({ url: "https://r2.exemplo.test/videos/ambliopia.mp4?sig=1" });
    const user = userEvent.setup();
    const { container } = render(<ExercicioVideo exercicioId="ambliopia" />);

    await user.click(screen.getByRole("button", { name: /Ver vídeo explicativo/i }));

    expect(videoMock).toHaveBeenCalledWith("ambliopia");
    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "https://r2.exemplo.test/videos/ambliopia.mp4?sig=1",
    );
  });

  it("se a API recusar (403/404/503), esconde-se por completo -- nunca mostra um leitor partido", async () => {
    videoMock.mockRejectedValue(Object.assign(new Error("sem acesso"), { status: 403 }));
    const user = userEvent.setup();
    const { container } = render(<ExercicioVideo exercicioId="ambliopia" />);

    await user.click(screen.getByRole("button", { name: /Ver vídeo explicativo/i }));

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("se o próprio vídeo falhar a carregar (ficheiro nunca chegou ao R2), esconde-se -- nunca fica um leitor partido visível", async () => {
    videoMock.mockResolvedValue({ url: "https://r2.exemplo.test/videos/estereopsia.mp4?sig=1" });
    const user = userEvent.setup();
    const { container } = render(<ExercicioVideo exercicioId="estereopsia" />);

    await user.click(screen.getByRole("button", { name: /Ver vídeo explicativo/i }));
    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());

    act(() => {
      container.querySelector("video")!.dispatchEvent(new Event("error"));
    });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

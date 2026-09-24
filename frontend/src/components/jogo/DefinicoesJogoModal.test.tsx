import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DefinicoesJogoModal from "./DefinicoesJogoModal";
import { AudioJogoProvider, CHAVE_PREFERENCIAS_AUDIO } from "@/contexts/AudioJogoContext";

const abrir = () =>
  render(
    <AudioJogoProvider>
      <DefinicoesJogoModal open onOpenChange={() => {}} />
    </AudioJogoProvider>
  );

describe("DefinicoesJogoModal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    // Desmonta antes de restaurar -- o provider pára a música ao desmontar.
    cleanup();
    vi.restoreAllMocks();
  });

  it("mostra os dois interruptores, ligados por omissão", async () => {
    abrir();
    expect(await screen.findByRole("heading", { name: "Definições" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Música" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Efeitos sonoros" })).toBeChecked();
  });

  it("desligar a música fica guardado neste dispositivo", async () => {
    abrir();
    await userEvent.click(await screen.findByRole("switch", { name: "Música" }));

    expect(screen.getByRole("switch", { name: "Música" })).not.toBeChecked();
    expect(JSON.parse(window.localStorage.getItem(CHAVE_PREFERENCIAS_AUDIO)!)).toEqual({ musica: false, efeitos: true });
  });

  it("desligar e voltar a ligar os efeitos sonoros", async () => {
    abrir();
    const efeitos = await screen.findByRole("switch", { name: "Efeitos sonoros" });
    await userEvent.click(efeitos);
    expect(efeitos).not.toBeChecked();
    await userEvent.click(efeitos);
    expect(efeitos).toBeChecked();
    expect(JSON.parse(window.localStorage.getItem(CHAVE_PREFERENCIAS_AUDIO)!).efeitos).toBe(true);
  });

  it("abre já com as preferências guardadas", async () => {
    window.localStorage.setItem(CHAVE_PREFERENCIAS_AUDIO, JSON.stringify({ musica: false, efeitos: false }));
    abrir();
    expect(await screen.findByRole("switch", { name: "Música" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Efeitos sonoros" })).not.toBeChecked();
  });
});

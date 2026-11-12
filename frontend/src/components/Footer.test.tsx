import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "./Footer";

function renderRodape() {
  return render(<Footer />, { wrapper: MemoryRouter });
}

describe("Footer", () => {
  it("cada link leva directo à sua página (e à secção certa)", () => {
    renderRodape();
    const destinos: [RegExp, string][] = [
      [/^início$/i, "/"],
      [/^sobre nós$/i, "/impacto#sobre"],
      [/^doar agora$/i, "/apoiar?modo=unica#como-apoiar"],
      [/^contactos$/i, "/junte-se#contacto"],
      [/^triagem ocular$/i, "/scanner"],
      [/^exercícios visuais$/i, "/exercicios"],
      [/^inclusivamente$/i, "/jogo-curiosidades"],
    ];
    for (const [nome, href] of destinos) {
      expect(screen.getByRole("link", { name: nome })).toHaveAttribute("href", href);
    }
    expect(screen.queryByRole("link", { name: /apoiar a causa/i })).not.toBeInTheDocument();
  });

  it("tem o YouTube e o canal do WhatsApp, a abrir noutro separador", () => {
    renderRodape();
    const youtube = screen.getByRole("link", { name: "YouTube" });
    const whatsapp = screen.getByRole("link", { name: "WhatsApp" });
    expect(youtube).toHaveAttribute("href", "https://www.youtube.com/@JanelasParaaAlma");
    expect(whatsapp).toHaveAttribute("href", "https://whatsapp.com/channel/0029VbCrusG6mYPRHF08dj33");
    for (const l of [youtube, whatsapp]) {
      expect(l).toHaveAttribute("target", "_blank");
      expect(l).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});

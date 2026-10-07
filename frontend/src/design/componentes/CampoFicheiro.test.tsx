import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CampoFicheiro } from "./CampoFicheiro";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const TEXTOS = {
  escolher: "Escolher ficheiro",
  trocar: "Escolher outro",
  remover: (nome: string) => `Remover ${nome}`,
  erroTipo: "Use PDF, PNG, JPEG ou WebP.",
  erroTamanho: "O ficheiro tem mais de 5 MB.",
  tamanho: (kb: number) => `${kb} KB`,
};

const Exemplo = ({ erro }: { erro?: string }) => {
  const [f, setF] = useState<File | null>(null);
  return (
    <CampoFicheiro
      rotulo="Comprovativo"
      ajuda="PDF ou imagem."
      erro={erro}
      ficheiro={f}
      aoMudar={setF}
      tiposAceites={["application/pdf", "image/png"]}
      tamanhoMaximoBytes={1024}
      textos={TEXTOS}
    />
  );
};

const ficheiro = (nome: string, tipo: string, tamanho = 10) =>
  new File([new Uint8Array(tamanho)], nome, { type: tipo });

describe("CampoFicheiro", () => {
  it("o campo nativo tem o nome do rótulo e a ajuda como descrição", () => {
    render(<Exemplo />);
    const campo = screen.getByLabelText("Comprovativo");
    expect(campo).toHaveAttribute("type", "file");
    expect(campo).toHaveAccessibleDescription("PDF ou imagem.");
  });

  it("um ficheiro válido aparece com nome e tamanho, e dá para o remover", async () => {
    const u = userEvent.setup({ applyAccept: false });
    render(<Exemplo />);
    await u.upload(screen.getByLabelText("Comprovativo"), ficheiro("recibo.pdf", "application/pdf", 1000));
    expect(screen.getByText("recibo.pdf")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Remover recibo.pdf" }));
    expect(screen.queryByText("recibo.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher ficheiro" })).toBeInTheDocument();
  });

  it("recusa um tipo não aceite, no próprio campo, e não o aceita", async () => {
    const u = userEvent.setup({ applyAccept: false });
    render(<Exemplo />);
    await u.upload(screen.getByLabelText("Comprovativo"), ficheiro("filme.mp4", "video/mp4"));
    expect(screen.getByText("Use PDF, PNG, JPEG ou WebP.")).toBeInTheDocument();
    expect(screen.queryByText("filme.mp4")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Comprovativo")).toHaveAttribute("aria-invalid", "true");
  });

  it("recusa um ficheiro grande demais", async () => {
    const u = userEvent.setup({ applyAccept: false });
    render(<Exemplo />);
    await u.upload(screen.getByLabelText("Comprovativo"), ficheiro("enorme.pdf", "application/pdf", 5000));
    expect(screen.getByText("O ficheiro tem mais de 5 MB.")).toBeInTheDocument();
  });

  it("mostra o erro de quem usa o campo (ex.: faltou anexar)", () => {
    render(<Exemplo erro="Anexe o comprovativo." />);
    expect(screen.getByText("Anexe o comprovativo.")).toBeInTheDocument();
    expect(screen.getByLabelText("Comprovativo")).toHaveAccessibleDescription("PDF ou imagem. Anexe o comprovativo.");
  });

  it("sem violações de acessibilidade, vazio e com erro", async () => {
    const { container } = render(
      <>
        <Exemplo />
        <Exemplo erro="Anexe o comprovativo." />
      </>,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

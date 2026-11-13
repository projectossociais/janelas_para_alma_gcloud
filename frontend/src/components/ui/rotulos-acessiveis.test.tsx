/**
 * Os botões só com ícone dos componentes base (o "×" das janelas, as setas
 * da galeria) têm um nome para leitores de ecrã. Esse nome vinha escrito em
 * inglês ("Close", "Previous slide") e era lido assim no site português.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "./carousel";

const janela = () =>
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Título</DialogTitle>
        <DialogDescription>Texto</DialogDescription>
      </DialogContent>
    </Dialog>,
  );

afterEach(async () => {
  await i18n.changeLanguage("pt-AO");
});

describe("nomes acessíveis dos componentes base", () => {
  it("o × de uma janela chama-se \"Fechar\" em português", () => {
    janela();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("o × de uma janela chama-se \"Close\" em inglês", async () => {
    await i18n.changeLanguage("en-US");
    janela();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("o × de um painel lateral chama-se \"Fechar\"", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Título</SheetTitle>
          <SheetDescription>Texto</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("as setas de uma galeria chamam-se \"Anterior\" e \"Seguinte\"", () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>1</CarouselItem>
          <CarouselItem>2</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );
    expect(screen.getByRole("button", { name: "Anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seguinte" })).toBeInTheDocument();
  });
});

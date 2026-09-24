import { describe, it, expect, vi, afterEach } from "vitest";
import i18n from "@/i18n";
import { mensagemDeErroApi } from "@/lib/apiClient";
import { submeterRastreioMultiGaze, textoDoScannerNoIdioma } from "./screeningApi";

// Texto real devolvido pelo janelas-scanner-api (microserviço à parte), que
// aparecia em português na página de resultados inglesa.
const POSICOES_PT =
  "Não foi possível comparar as posições do olhar. Para repetir: na foto esquerda e direita, olhe para o lado pedido.";
const POSICOES_EN =
  "We couldn't compare your gaze positions. To try again, look toward the requested side when the left and right photos are taken.";

const imagens = () => ({ centro: new Blob(["c"]), esquerda: new Blob(["e"]), direita: new Blob(["d"]) });

describe("screeningApi -- textos do microserviço do scanner", () => {
  afterEach(() => {
    void i18n.changeLanguage("pt-AO");
    vi.unstubAllGlobals();
  });

  it("em português, o texto do microserviço mostra-se tal como vem", () => {
    expect(textoDoScannerNoIdioma(POSICOES_PT)).toBe(POSICOES_PT);
    expect(textoDoScannerNoIdioma("Outro texto qualquer.")).toBe("Outro texto qualquer.");
  });

  it("em inglês, um texto conhecido é traduzido e um desconhecido nunca é mostrado", () => {
    void i18n.changeLanguage("en-US");
    expect(textoDoScannerNoIdioma(POSICOES_PT)).toBe(POSICOES_EN);
    expect(textoDoScannerNoIdioma("Recomenda-se nova captura com melhor luz.")).toBeNull();
    expect(textoDoScannerNoIdioma("   ")).toBeNull();
    expect(textoDoScannerNoIdioma(undefined)).toBeNull();
  });

  it("um erro do microserviço traz status e detail -- em inglês nunca aparece o texto português", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: POSICOES_PT }), { status: 422 })),
    );
    const erro = await submeterRastreioMultiGaze(imagens()).catch((e: unknown) => e);
    expect(erro).toMatchObject({ status: 422, detail: POSICOES_PT });

    void i18n.changeLanguage("en-US");
    expect(mensagemDeErroApi(erro, "fallback")).toBe(POSICOES_EN);
  });

  it("envia as 3 imagens num POST multipart real ao microserviço e devolve a resposta dele, sem mock", async () => {
    const respostaReal = { estado: "concluido", variacao_desalinhamento: 2.3, requer_avaliacao_humana: true };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(respostaReal), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await submeterRastreioMultiGaze(imagens());

    expect(resultado).toEqual(respostaReal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/screening\/multi-gaze$/);
    expect(url).not.toMatch(/supabase/i);
    expect(init.method).toBe("POST");
    const corpo = init.body as FormData;
    expect(corpo).toBeInstanceOf(FormData);
    for (const campo of ["centro", "esquerda", "direita"]) {
      expect(corpo.get(campo)).toBeInstanceOf(Blob);
    }
  });

  it("em inglês, um erro desconhecido do microserviço cai na mensagem do código HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Imagem sem rosto detectado." }), { status: 422 })),
    );
    const erro = await submeterRastreioMultiGaze(imagens()).catch((e: unknown) => e);
    void i18n.changeLanguage("en-US");
    const mensagem = mensagemDeErroApi(erro, "fallback");
    expect(mensagem).toBe(i18n.t("erroApi.pedidoInvalido"));
    expect(mensagem).not.toMatch(/rosto|Erro na análise/);
  });
});

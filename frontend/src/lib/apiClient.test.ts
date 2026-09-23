import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Este ficheiro NÃO mocka o apiClient — testa o próprio cliente contra um
// `fetch` falso. O que importa aqui: o cliente fala com a mesma origem
// (prefixo `/api`), leva sempre `credentials: "include"`, e nunca mostra
// sucesso a partir de uma resposta não-ok (lança `ApiError` com o status).

function respostaFalsa(corpo: unknown, init: { ok: boolean; status: number }): Response {
  return {
    ok: init.ok,
    status: init.status,
    json: async () => corpo,
  } as Response;
}

describe("apiClient — mesma origem", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chama /api/... na mesma origem, com credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaFalsa({ id: "u1" }, { ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { authApi } = await import("./apiClient");
    await authApi.eu();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/eu");
    expect(opcoes.credentials).toBe("include");
    expect(opcoes.headers["Content-Type"]).toBe("application/json");
  });

  it("respeita VITE_API_URL quando definida (dev a apontar a uma API remota)", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.exemplo.com");
    const fetchMock = vi.fn().mockResolvedValue(respostaFalsa({ id: "u1" }, { ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { authApi } = await import("./apiClient");
    await authApi.eu();

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exemplo.com/auth/eu");
  });

  it("lança ApiError com o status quando a resposta não é ok — nunca devolve sucesso", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respostaFalsa({ detail: "Sessão inválida" }, { ok: false, status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { authApi, ApiError } = await import("./apiClient");

    await expect(authApi.eu()).rejects.toMatchObject({ status: 401, message: "Sessão inválida" });
    await expect(authApi.eu()).rejects.toBeInstanceOf(ApiError);
  });

  it("sessoesExercicioApi.registar faz POST a /api/sessoes-exercicio sem nunca enviar user_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respostaFalsa({ id: "s1" }, { ok: true, status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sessoesExercicioApi } = await import("./apiClient");
    await sessoesExercicioApi.registar({
      exercicio_id: "tracking",
      duracao_segundos: 90,
      pontuacao: 10,
    });

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sessoes-exercicio");
    expect(opcoes.method).toBe("POST");
    const corpo = JSON.parse(opcoes.body as string);
    expect(corpo).toMatchObject({ exercicio_id: "tracking", duracao_segundos: 90, pontuacao: 10 });
    expect(corpo).not.toHaveProperty("user_id");
  });

  it("sessoesExercicioApi.registar propaga o erro quando a API falha — nunca silencioso", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respostaFalsa({ detail: "Sessão inválida" }, { ok: false, status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sessoesExercicioApi } = await import("./apiClient");
    await expect(
      sessoesExercicioApi.registar({ exercicio_id: "x", duracao_segundos: 1 }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("num 401, tenta renovar o token e repete o pedido original — sessão continua sem o utilizador notar", async () => {
    const fetchMock = vi
      .fn()
      // 1º: o pedido original, com o access token já expirado
      .mockResolvedValueOnce(respostaFalsa({ detail: "Sessão inválida" }, { ok: false, status: 401 }))
      // 2º: POST /auth/atualizar-token — o refresh token (30 dias) ainda é válido
      .mockResolvedValueOnce(respostaFalsa(undefined, { ok: true, status: 204 }))
      // 3º: repetição do pedido original, agora com o access token renovado
      .mockResolvedValueOnce(respostaFalsa({ id: "u1", email: "a@b.com" }, { ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { authApi } = await import("./apiClient");
    await expect(authApi.eu()).resolves.toMatchObject({ id: "u1" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/atualizar-token");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/auth/eu");
  });

  it("se o refresh também falhar (refresh token expirado), propaga o 401 original sem tentar outra vez", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respostaFalsa({ detail: "Sessão inválida" }, { ok: false, status: 401 }))
      .mockResolvedValueOnce(respostaFalsa({ detail: "sem sessão" }, { ok: false, status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { authApi } = await import("./apiClient");
    await expect(authApi.eu()).rejects.toMatchObject({ status: 401, message: "Sessão inválida" });

    // Exactamente 2 chamadas -- pedido original + a tentativa de renovar.
    // Nunca uma 3ª (senão seria uma recursão sem fim quando o refresh falha).
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("204 sem corpo não tenta fazer parse de JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("não devia ser chamado");
      },
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { authApi } = await import("./apiClient");
    await expect(authApi.sair()).resolves.toBeUndefined();
  });
});

describe("mensagemDeErroApi -- erros da API por idioma", () => {
  const erroApi = (status: number, message: string) => Object.assign(new Error(message), { status });

  afterEach(async () => {
    const { default: i18n } = await import("@/i18n");
    await i18n.changeLanguage("pt-AO");
  });

  it("em português mostra o detail da API, como sempre", async () => {
    const { mensagemDeErroApi } = await import("./apiClient");
    expect(mensagemDeErroApi(erroApi(401, "email ou password incorretos"), "fallback")).toBe("email ou password incorretos");
    expect(mensagemDeErroApi(new TypeError("Failed to fetch"), "fallback")).toBe("fallback");
  });

  it("em inglês nunca mostra o detail português: traduz os conhecidos e usa mensagens por tipo nos restantes", async () => {
    const { default: i18n } = await import("@/i18n");
    const { mensagemDeErroApi } = await import("./apiClient");
    await i18n.changeLanguage("en-US");

    expect(mensagemDeErroApi(erroApi(401, "email ou password incorretos"), "fb")).toBe("Incorrect email or password.");
    expect(mensagemDeErroApi(erroApi(409, "o email ana@exemplo.ao já está registado"), "fb")).toBe("This email is already registered.");
    expect(mensagemDeErroApi(erroApi(404, "algo que o frontend não conhece"), "fb")).toBe(
      "We couldn't find what you were looking for.",
    );
    expect(mensagemDeErroApi(erroApi(422, "detalhe desconhecido"), "fb")).toBe(
      "Some of the information isn't valid. Please review it and try again.",
    );
    expect(mensagemDeErroApi(erroApi(503, "serviço indisponível"), "fb")).toBe(
      "Something went wrong on our end. Please try again in a few minutes.",
    );
    // rede: o pedido nem chegou ao servidor
    expect(mensagemDeErroApi(new TypeError("Failed to fetch"), "fb")).toBe(
      "We couldn't reach the server. Check your internet connection and try again.",
    );
    // erro local (não é da API nem de rede): fica a mensagem de contexto, já traduzida
    expect(mensagemDeErroApi(new Error("falha local"), "Context message")).toBe("Context message");
  });
});

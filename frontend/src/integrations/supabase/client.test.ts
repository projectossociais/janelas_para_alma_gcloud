import { describe, it, expect } from "vitest";

// Regressão: sem VITE_SUPABASE_* definidas (o caso normal neste repo — o
// .env.example nem as documenta como obrigatórias), o createClient() atirava
// "supabaseUrl is required." à carga do módulo. Como o Navbar importa este
// cliente, a app inteira ficava em branco. Os placeholders no client.ts
// impedem isso.
describe("cliente Supabase (dívida em remoção)", () => {
  it("não rebenta à importação quando o env Supabase não está definido", async () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBeUndefined();

    const mod = await import("./client");

    expect(mod.supabase).toBeDefined();
    expect(typeof mod.supabase.from).toBe("function");
  });
});

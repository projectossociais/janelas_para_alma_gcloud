// Gerado originalmente pelo Supabase CLI. O gerador foi removido deste repo
// (ver CLAUDE.md secção 0) — este ficheiro pode ser editado.
//
// Cliente Supabase: dívida em remoção módulo a módulo (ver CLAUDE.md secção 11).
// As páginas ainda não migradas para a API nova importam-no. Sem as variáveis
// VITE_SUPABASE_* definidas, o createClient() rebentava logo à carga do módulo
// e derrubava a app inteira (o Navbar importa-o em todas as páginas). Os
// placeholders mantêm a app de pé; as chamadas Supabase não migradas falham na
// rede — que já é o comportamento esperado para uma conta da API nova.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "placeholder-anon-key";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

import { Eye, FlaskConical, ShieldCheck, Sparkles, Stethoscope, Sun, type LucideIcon } from "lucide-react";
import type { CategoriaPerguntaJogo, NivelJogadorId } from "@/lib/apiClient";

/**
 * Apresentação do Perfil do jogo -- ícones e cores das 6 categorias e dos 5
 * níveis. Os números (nível, acertos, taxas) vêm sempre da API
 * (`GET /jogo/perfil/estatisticas`); aqui só se decide como se vêem.
 */
export const CATEGORIAS_VISUAIS: Record<CategoriaPerguntaJogo, { icone: LucideIcon; cor: string; anel: string }> = {
  anatomia_ocular: { icone: Eye, cor: "text-sky-600 bg-sky-500/10", anel: "stroke-sky-500" },
  doencas_estrabismo: { icone: Stethoscope, cor: "text-rose-600 bg-rose-500/10", anel: "stroke-rose-500" },
  prevencao_cuidados: { icone: ShieldCheck, cor: "text-emerald-600 bg-emerald-500/10", anel: "stroke-emerald-500" },
  estilo_vida_visao: { icone: Sun, cor: "text-amber-600 bg-amber-500/10", anel: "stroke-amber-500" },
  ciencia_ocular: { icone: FlaskConical, cor: "text-violet-600 bg-violet-500/10", anel: "stroke-violet-500" },
  curiosidades_visuais: { icone: Sparkles, cor: "text-teal bg-teal/10", anel: "stroke-teal" },
};

export const NIVEIS_VISUAIS: Record<NivelJogadorId, { cor: string }> = {
  iniciante: { cor: "from-orange-700 to-orange-400" },
  aprendiz: { cor: "from-slate-500 to-slate-300" },
  conhecedor: { cor: "from-yellow-600 to-yellow-300" },
  especialista: { cor: "from-teal to-emerald-300" },
  mestre_visao: { cor: "from-violet-700 to-fuchsia-400" },
};

/** Taxa (0-1) em percentagem inteira, para o ecrã. */
export const emPercentagem = (taxa: number) => Math.round(Math.max(0, Math.min(1, taxa)) * 100);

import { Eye, FlaskConical, ShieldCheck, Sparkles, Stethoscope, Sun, type LucideIcon } from "lucide-react";
import type { CategoriaPerguntaJogo } from "@/lib/apiClient";

/**
 * Apresentação do Perfil do jogo -- o ícone de cada uma das 6 categorias. Os
 * números (nível, acertos, taxas) vêm sempre da API
 * (`GET /jogo/perfil/estatisticas`). As cores são as do sistema de design,
 * iguais para todas: uma cor por categoria não dizia nada.
 */
export const ICONE_CATEGORIA: Record<CategoriaPerguntaJogo, LucideIcon> = {
  anatomia_ocular: Eye,
  doencas_estrabismo: Stethoscope,
  prevencao_cuidados: ShieldCheck,
  estilo_vida_visao: Sun,
  ciencia_ocular: FlaskConical,
  curiosidades_visuais: Sparkles,
};

/** Taxa (0-1) em percentagem inteira, para o ecrã. */
export const emPercentagem = (taxa: number) => Math.round(Math.max(0, Math.min(1, taxa)) * 100);

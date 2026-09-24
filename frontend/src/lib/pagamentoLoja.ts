import { comprovativosApi, jogoApi, TIPOS_DE_COMPROVATIVO_ACEITES, type TipoItemLoja } from "@/lib/apiClient";

/** O comprovativo é uma imagem ou PDF aceite pela API? */
export const comprovativoValido = (ficheiro: File) =>
  TIPOS_DE_COMPROVATIVO_ACEITES.includes(ficheiro.type as never);

/**
 * Envia o comprovativo directamente ao R2 e cria o pedido -- os três passos
 * do Premium (`RegistoPremium.tsx`). Não credita nada: o saldo só muda
 * quando um admin confirmar o pagamento. Qualquer falha propaga-se -- quem
 * chama nunca mostra sucesso sem esta promessa resolvida (CLAUDE.md §6).
 */
export async function pagarComTransferencia(pacoteId: string, ficheiro: File, tipoItem: TipoItemLoja) {
  const preparado = await comprovativosApi.preparar(ficheiro.type);
  await comprovativosApi.enviarParaStorage(preparado.url_de_upload, ficheiro);
  return jogoApi.pedirComKwanzas(pacoteId, preparado.chave, tipoItem);
}

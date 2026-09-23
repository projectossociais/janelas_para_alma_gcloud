/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `"true"` liga a versão inglesa (rotas `/en/*` e botão de idioma). Por omissão desligada. */
  readonly VITE_ENABLE_EN?: string;
}

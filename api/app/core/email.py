"""Envio de email transacional via Resend.

Só sabe enviar um email — o `RecuperacaoPasswordService` depende do
`EmailSender` (Protocol), não desta classe, o mesmo padrão do `Presigner`
em `repositories/storage.py`: é o que torna o service testável sem rede nem
chave de API real.

Escolha do Resend (decidida 2026-09-13, ver docs/BACKLOG.md): API HTTP
simples, sem SDK a mais — o Cloud Run bloqueia SMTP, por isso tinha de ser
por HTTP de qualquer forma. Chamada síncrona com `httpx`: os volumes deste
projecto (recuperação de password, pontualmente) não justificam uma fila
nem um cliente assíncrono dedicado.
"""

from typing import Protocol

import httpx

from app.core.config import obter_settings

_RESEND_API_URL = "https://api.resend.com/emails"


class EmailEnvioFalhouError(Exception):
    """O Resend recusou ou não respondeu. Nunca mostrar sucesso ao
    utilizador quando isto acontece — ver CLAUDE.md, "nunca mostrar sucesso
    antes de verificar erro"."""


class EmailSender(Protocol):
    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None: ...


class ResendEmailSender:
    """Implementação real. Não é exercitada pelos testes (não há chave real
    até o domínio estar verificado no Resend) — a garantia de comportamento
    está nos testes do service contra um `EmailSender` falso."""

    def __init__(self) -> None:
        settings = obter_settings()
        self._api_key = settings.resend_api_key
        self._remetente = settings.email_remetente

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        try:
            resposta = httpx.post(
                _RESEND_API_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "from": self._remetente,
                    "to": [destinatario],
                    "subject": assunto,
                    "html": corpo_html,
                },
                timeout=10.0,
            )
        except httpx.HTTPError as exc:
            raise EmailEnvioFalhouError(f"falha de rede a chamar o Resend: {exc}") from exc

        if resposta.status_code >= 400:
            raise EmailEnvioFalhouError(f"Resend devolveu {resposta.status_code}: {resposta.text}")


class ConsoleEmailSender:
    """Fallback de desenvolvimento: sem `RESEND_API_KEY` configurada (dev
    local sem `.env` preenchido), imprime o email no terminal em vez de
    tentar chamar o Resend — que rejeitaria a chamada de qualquer forma sem
    chave real. Ver `obter_email_sender()` em core/dependencies.py: só entra
    quando a chave está vazia, nunca em produção. Existe porque o registo
    (AUTH-02) manda sempre um email de confirmação — sem isto, `npm run dev`
    /`uvicorn` locais sem Resend configurado deixariam de conseguir
    registar contas nenhumas."""

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        print(
            f"\n--- EMAIL (modo consola — RESEND_API_KEY vazia) ---\n"
            f"Para: {destinatario}\nAssunto: {assunto}\n{corpo_html}\n"
            f"----------------------------------------------------\n"
        )

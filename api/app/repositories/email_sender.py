"""Envio de email transacional via Resend (API HTTP, não SMTP -- o Cloud Run
bloqueia SMTP de saída).

`EmailSender` é o `Protocol` de que os services dependem -- é o que os torna
testáveis sem rede nem chave de API real (mesmo padrão de `storage.Presigner`).
`ResendEmailSender` (implementação real) não é exercitada pelos testes, tal
como `R2Presigner`: a garantia de comportamento está nos testes dos services
contra um `EmailSender` falso.
"""

from typing import Protocol

import httpx

from app.core.config import obter_settings


class EmailNaoEnviadoError(Exception):
    """A chamada à Resend falhou (rede, chave inválida, 4xx/5xx). Nunca
    apanhada silenciosamente pelo service -- quem chama decide o que fazer
    (CLAUDE.md, "nunca mostrar sucesso antes de verificar erro")."""


class EmailSender(Protocol):
    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None: ...


class ResendEmailSender:
    def __init__(self) -> None:
        s = obter_settings()
        self._api_key = s.resend_api_key
        self._remetente = s.resend_from_email

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        try:
            resposta = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "from": self._remetente,
                    "to": [destinatario],
                    "subject": assunto,
                    "html": corpo_html,
                },
                timeout=10.0,
            )
            resposta.raise_for_status()
        except httpx.HTTPError as exc:
            raise EmailNaoEnviadoError(str(exc)) from exc

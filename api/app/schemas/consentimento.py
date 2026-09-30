from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConsentimentoSaudeCriar(BaseModel):
    """As duas declarações têm de vir explicitamente a `true`; o service
    recusa (422) se alguma faltar. Nada de consentimento implícito."""

    model_config = ConfigDict(extra="forbid")

    declara_maioridade: bool
    aceita_tratamento: bool
    representa_menor: bool = False


class ConsentimentoSaudeEstado(BaseModel):
    consentido: bool
    versao_actual: str
    versao_aceite: str | None
    aceite_em: datetime | None
    representa_menor: bool

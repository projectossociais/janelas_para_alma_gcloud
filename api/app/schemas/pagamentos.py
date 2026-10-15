"""Formas dos dados da validação instantânea do comprovativo do Premium."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class PrepararUploadComprovativo(BaseModel):
    """PDF do comprovativo ou captura de ecrã. O tipo verdadeiro decide-se
    pelos bytes na validação -- este só escolhe a extensão e assina o PUT."""

    content_type: Literal["application/pdf", "image/png", "image/jpeg", "image/webp"]


class UploadComprovativoPreparado(BaseModel):
    url_de_upload: str
    chave: str


class ValidarComprovativoPedido(BaseModel):
    """Chave devolvida por `POST /pagamentos/comprovativos/upload`, depois do
    `PUT` ao R2. O dono do ficheiro sai da sessão, nunca do corpo."""

    chave: str = Field(min_length=1, max_length=300)


class ResultadoValidacao(BaseModel):
    """O que o utilizador vê -- nunca o texto extraído nem os metadados."""

    id: str
    estado: str
    motivo_codigo: str | None
    motivo: str | None
    referencia_transacao: str | None
    montante_kz: Decimal | None
    premium_expira_em: datetime | None

    model_config = {"from_attributes": True}


class ComprovativoAdmin(BaseModel):
    id: str
    utilizador_id: str | None
    utilizador_email: str | None
    utilizador_nome: str | None
    estado: str
    referencia_transacao: str | None
    montante_kz: Decimal | None
    origem: str | None
    destinatario_detectado: str | None
    data_transacao: datetime | None
    motivo_codigo: str | None
    motivo: str | None
    premium_expira_em: datetime | None
    decidido_por: str | None
    decidido_em: datetime | None
    criado_em: datetime
    # CHAVE e PIN do BAI Directo para "Validar Documentos" em bancobai.ao
    # (só quando o comprovativo os tem). Só admin -- este schema nunca chega
    # ao utilizador.
    chave_validacao_bai: str | None = None
    pin_validacao_bai: str | None = None

    model_config = {"from_attributes": True}


class ComprovativoAdminDetalhe(ComprovativoAdmin):
    """Auditoria completa de um comprovativo -- só no detalhe, não na lista."""

    hash_sha256: str
    hash_perceptual: str | None
    metadados_ficheiro: dict | None
    texto_extraido: str | None


class DecisaoComMotivo(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)


class UrlFicheiro(BaseModel):
    url: str

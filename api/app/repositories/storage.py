"""Acesso ao storage de ficheiros (Cloudflare R2, compatível com S3).

Só sabe assinar URLs — nunca recebe nem reencaminha os bytes do ficheiro.
O browser faz o `PUT` directamente ao R2 com o URL assinado que sai daqui;
a API nunca é o caminho dos dados. Isto mantém o upload de imagens faciais
de crianças fora dos nossos servidores e dos nossos logs.

O `UploadService` depende do `Presigner` (Protocol), não desta classe —
é o que o torna testável sem rede nem credenciais reais (mesmo padrão de
`auth_service.py`).
"""

from typing import Protocol

import boto3
from botocore.config import Config

from app.core.config import obter_settings


class Presigner(Protocol):
    def url_de_upload(self, chave: str, content_type: str) -> str: ...


class R2Presigner:
    """Implementação real com boto3. Não é exercitada pelos testes (não há
    bucket nem credenciais até ao primeiro deploy) — a garantia de
    comportamento está nos testes do `UploadService` contra um `Presigner`
    falso."""

    def __init__(self) -> None:
        s = obter_settings()
        self._bucket = s.r2_bucket
        self._expira = s.r2_upload_url_expira_segundos
        self._cliente = boto3.client(
            "s3",
            endpoint_url=s.r2_endpoint_url,
            aws_access_key_id=s.r2_access_key_id,
            aws_secret_access_key=s.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    def url_de_upload(self, chave: str, content_type: str) -> str:
        return self._cliente.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": chave, "ContentType": content_type},
            ExpiresIn=self._expira,
        )


class R2VideosPresigner(R2Presigner):
    """Leitura assinada no bucket privado dos vídeos dos exercícios
    (`r2_bucket_videos`) — nunca no bucket público."""

    def __init__(self) -> None:
        super().__init__()
        s = obter_settings()
        self._bucket = s.r2_bucket_videos
        self._expira = s.r2_video_url_expira_segundos

    def url_de_leitura(self, chave: str) -> str:
        return self._cliente.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": chave},
            ExpiresIn=self._expira,
        )


class R2ComprovativosStorage(R2Presigner):
    """Bucket **privado** dos comprovativos de pagamento validados
    automaticamente (`r2_bucket_comprovativos`). O browser continua a enviar
    os bytes directamente ao R2 (URL de `PUT` assinado, como o avatar); a API
    só os lê de volta para validar -- tem mesmo de os ler, a validação é
    sobre o conteúdo do PDF. O admin vê o original por URL de leitura
    assinado, de curta duração; nunca há URL público."""

    def __init__(self) -> None:
        super().__init__()
        self._bucket = obter_settings().r2_bucket_comprovativos

    def ler_bytes(self, chave: str, limite: int) -> bytes | None:
        """`None` se o objecto não existir. Lê no máximo `limite + 1` bytes
        -- o suficiente para saber que o ficheiro passa do limite sem
        carregar um ficheiro enorme em memória."""
        try:
            resposta = self._cliente.get_object(
                Bucket=self._bucket, Key=chave, Range=f"bytes=0-{limite}"
            )
        except self._cliente.exceptions.NoSuchKey:
            return None
        return resposta["Body"].read(limite + 1)

    def url_de_leitura(self, chave: str) -> str:
        return self._cliente.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": chave},
            ExpiresIn=self._expira,
        )

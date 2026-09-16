"""Publicações (ADMIN-03) — o que hoje é "Ações Recentes"/campanhas escritas
directamente em código (`ActivitiesFeed.tsx`, `CampanhaGamek.tsx`) passa a
ser gerido no painel de administração, com uma única página pública
dinâmica por publicação em vez de uma rota nova por campanha.

Leitura pública é só o que está `publicada` — um rascunho nunca é visível
sem sessão de admin, mesmo sabendo o slug exacto (nunca confiar que
ninguém vai tentar adivinhar/enumerar)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.publicacoes_repository import (
    PublicacaoRegisto,
    SQLAlchemyPublicacoesRepository,
)
from app.repositories.storage import R2Presigner
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.publicacoes import (
    CapaConfirmada,
    MidiaConfirmar,
    MidiaPublica,
    MidiaUploadPedido,
    MidiaUploadPreparado,
    PublicacaoAdmin,
    PublicacaoAtualizar,
    PublicacaoCriar,
    PublicacaoPublica,
)
from app.services.publicacao_midia_service import (
    ChaveDeMidiaInvalidaError,
    PublicacaoMidiaService,
    TipoDeFicheiroNaoPermitidoError,
)
from app.services.publicacoes_service import PublicacaoNaoEncontradaError, PublicacoesService

router = APIRouter(prefix="/publicacoes", tags=["publicacoes"])


def obter_publicacoes_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyPublicacoesRepository:
    return SQLAlchemyPublicacoesRepository(sessao)


def obter_publicacoes_service(
    repo: SQLAlchemyPublicacoesRepository = Depends(obter_publicacoes_repository),
) -> PublicacoesService:
    return PublicacoesService(repo)


def obter_publicacao_midia_service(
    repo: SQLAlchemyPublicacoesRepository = Depends(obter_publicacoes_repository),
) -> PublicacaoMidiaService:
    return PublicacaoMidiaService(R2Presigner(), repo)


# --- Público --------------------------------------------------------------


@router.get("", response_model=list[PublicacaoPublica])
def listar_publicadas(
    repo: SQLAlchemyPublicacoesRepository = Depends(obter_publicacoes_repository),
) -> list[PublicacaoRegisto]:
    return repo.listar_publicadas()


@router.get(
    "/admin/todas", response_model=list[PublicacaoAdmin], dependencies=[Depends(obter_utilizador_admin)]
)
def listar_todas(
    repo: SQLAlchemyPublicacoesRepository = Depends(obter_publicacoes_repository),
) -> list[PublicacaoRegisto]:
    return repo.listar_todas()


@router.get("/{slug}", response_model=PublicacaoPublica)
def obter_por_slug(
    slug: str,
    repo: SQLAlchemyPublicacoesRepository = Depends(obter_publicacoes_repository),
) -> PublicacaoRegisto:
    registo = repo.obter_por_slug(slug)
    # Um rascunho nunca é devolvido aqui, mesmo com o slug exacto -- só a
    # listagem de admin (acima) vê rascunhos.
    if registo is None or registo.estado != "publicada":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="publicação não encontrada")
    return registo


# --- Administração ---------------------------------------------------------


@router.post(
    "",
    response_model=PublicacaoAdmin,
    status_code=status.HTTP_201_CREATED,
)
def criar_publicacao(
    dados: PublicacaoCriar,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: PublicacoesService = Depends(obter_publicacoes_service),
) -> PublicacaoRegisto:
    return servico.criar(dados.titulo, dados.resumo, dados.corpo, dados.local, dados.data_evento, admin.id)


@router.patch("/{publicacao_id}", response_model=PublicacaoAdmin)
def atualizar_publicacao(
    publicacao_id: str,
    dados: PublicacaoAtualizar,
    _admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: PublicacoesService = Depends(obter_publicacoes_service),
) -> PublicacaoRegisto:
    try:
        return servico.atualizar(
            publicacao_id,
            titulo=dados.titulo,
            resumo=dados.resumo,
            corpo=dados.corpo,
            local=dados.local,
            data_evento=dados.data_evento,
        )
    except PublicacaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="publicação não encontrada") from exc


@router.post("/{publicacao_id}/publicar", response_model=PublicacaoAdmin)
def publicar(
    publicacao_id: str,
    _admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: PublicacoesService = Depends(obter_publicacoes_service),
) -> PublicacaoRegisto:
    try:
        return servico.publicar(publicacao_id)
    except PublicacaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="publicação não encontrada") from exc


@router.post("/{publicacao_id}/despublicar", response_model=PublicacaoAdmin)
def despublicar(
    publicacao_id: str,
    _admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: PublicacoesService = Depends(obter_publicacoes_service),
) -> PublicacaoRegisto:
    try:
        return servico.despublicar(publicacao_id)
    except PublicacaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="publicação não encontrada") from exc


@router.delete("/{publicacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def apagar_publicacao(
    publicacao_id: str,
    _admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: PublicacoesService = Depends(obter_publicacoes_service),
) -> None:
    try:
        servico.apagar(publicacao_id)
    except PublicacaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="publicação não encontrada") from exc


# --- Fotos (capa + galeria) -- upload directo ao R2, mesmo padrão do avatar ----


@router.post(
    "/{publicacao_id}/capa/preparar",
    response_model=MidiaUploadPreparado,
    dependencies=[Depends(obter_utilizador_admin)],
)
def preparar_capa(
    publicacao_id: str,
    pedido: MidiaUploadPedido,
    servico: PublicacaoMidiaService = Depends(obter_publicacao_midia_service),
) -> MidiaUploadPreparado:
    try:
        preparado = servico.preparar(publicacao_id, pedido.content_type)
    except TipoDeFicheiroNaoPermitidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tipo de ficheiro não permitido (só PNG, JPEG ou WebP)",
        ) from exc
    return MidiaUploadPreparado(**preparado.__dict__)


@router.post(
    "/{publicacao_id}/capa/confirmar",
    response_model=CapaConfirmada,
    dependencies=[Depends(obter_utilizador_admin)],
)
def confirmar_capa(
    publicacao_id: str,
    pedido: MidiaConfirmar,
    servico: PublicacaoMidiaService = Depends(obter_publicacao_midia_service),
) -> CapaConfirmada:
    try:
        url = servico.confirmar_capa(publicacao_id, pedido.chave)
    except ChaveDeMidiaInvalidaError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="essa chave não pertence a esta publicação"
        ) from exc
    return CapaConfirmada(capa_url=url)


@router.post(
    "/{publicacao_id}/midias/preparar",
    response_model=MidiaUploadPreparado,
    dependencies=[Depends(obter_utilizador_admin)],
)
def preparar_midia(
    publicacao_id: str,
    pedido: MidiaUploadPedido,
    servico: PublicacaoMidiaService = Depends(obter_publicacao_midia_service),
) -> MidiaUploadPreparado:
    try:
        preparado = servico.preparar(publicacao_id, pedido.content_type)
    except TipoDeFicheiroNaoPermitidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tipo de ficheiro não permitido (só PNG, JPEG ou WebP)",
        ) from exc
    return MidiaUploadPreparado(**preparado.__dict__)


@router.post(
    "/{publicacao_id}/midias/confirmar",
    response_model=MidiaPublica,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(obter_utilizador_admin)],
)
def confirmar_midia(
    publicacao_id: str,
    pedido: MidiaConfirmar,
    servico: PublicacaoMidiaService = Depends(obter_publicacao_midia_service),
):
    try:
        return servico.confirmar_midia(publicacao_id, pedido.chave)
    except ChaveDeMidiaInvalidaError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="essa chave não pertence a esta publicação"
        ) from exc


@router.delete(
    "/{publicacao_id}/midias/{midia_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(obter_utilizador_admin)],
)
def remover_midia(
    publicacao_id: str,
    midia_id: str,
    servico: PublicacaoMidiaService = Depends(obter_publicacao_midia_service),
) -> None:
    servico.remover_midia(midia_id)

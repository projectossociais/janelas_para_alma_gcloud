from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.cookies import limpar_cookies_sessao
from app.core.dependencies import obter_conta_service, obter_utilizador_atual
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.conta import EliminacaoAgendada, MudarPasswordPedido
from app.services.conta_service import ContaService, PasswordAtualIncorretaError

router = APIRouter(prefix="/conta", tags=["conta"])


@router.post("/mudar-password", status_code=status.HTTP_204_NO_CONTENT)
def mudar_password(
    dados: MudarPasswordPedido,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: ContaService = Depends(obter_conta_service),
) -> None:
    try:
        service.mudar_password(utilizador.id, dados.password_atual, dados.password_nova)
    except PasswordAtualIncorretaError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/eliminar", response_model=EliminacaoAgendada)
def eliminar_conta(
    response: Response,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: ContaService = Depends(obter_conta_service),
) -> EliminacaoAgendada:
    """Nunca elimina na hora — agenda para daqui a 30 dias e termina a
    sessão actual (continuar autenticado numa conta que se acabou de pedir
    para eliminar não faz sentido). Voltar a entrar dentro do prazo cancela
    o pedido — ver routers/auth.py::entrar."""
    quando = service.agendar_eliminacao(utilizador.id)
    limpar_cookies_sessao(response)
    return EliminacaoAgendada(agendada_para=quando)

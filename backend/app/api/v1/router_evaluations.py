from __future__ import annotations

import csv
import io
from typing import Any
from uuid import UUID

import openpyxl
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.persistence.config_repo_impl import ConfigRepositoryImpl
from app.adapters.persistence.database import get_db
from app.adapters.persistence.evaluation_repo_impl import EvaluationRepositoryImpl
from app.adapters.persistence.learning_outcome_repo_impl import LearningOutcomeRepositoryImpl
from app.adapters.persistence.orm_models import User as UserModel
from app.adapters.persistence.user_repo_impl import UserRepositoryImpl
from app.api.middleware.auth_dependencies import get_current_user
from app.api.schemas.evaluation_schemas import (
    Dashboard,
    EvaluationCommentOut,
    EvaluationInput,
    EvaluationLevelOut,
    EvaluationOut,
    LearningOutcomeInput,
    LearningOutcomeOut,
    LearningOutcomeUpdate,
    Prefill,
    ProgramConfig,
)
from app.application.evaluation_use_case import (
    EvaluationUseCase,
    EvaluationValidationError,
    StudentNotFoundError,
    TurmaScopeError,
)
from app.application.lo_catalog_use_case import (
    LOCatalogUseCase,
    LONotFoundError,
    LOValidationError,
)
from app.application.turma_scope import assert_turma_permitida
from app.domain.enums import RoleAdmin, TipoUsuario
from app.domain.models import LearningOutcome, WeeklyEvaluation

router = APIRouter(prefix="/admin", tags=["Avaliação de LOs"])

_ADMIN_ROLES = {RoleAdmin.SUPER_ADMIN, RoleAdmin.ADMIN}


async def require_mentor(
    payload: dict[str, Any] = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> UserModel:
    """Mentor = usuário STAFF, ou ADMIN/SUPER_ADMIN por role."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token inválido") from None
    try:
        user_id = UUID(sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Token inválido") from None
    user = (await db.execute(select(UserModel).where(UserModel.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    is_mentor = user.tipo == TipoUsuario.STAFF or user.role in _ADMIN_ROLES
    if not is_mentor:
        raise HTTPException(status_code=403, detail="Acesso restrito a mentores.")
    return user


def _require_admin_role(user: UserModel) -> None:
    if user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")


def _is_admin(user: UserModel) -> bool:
    return user.role in _ADMIN_ROLES


def _catalog_uc(db: AsyncSession) -> LOCatalogUseCase:
    return LOCatalogUseCase(LearningOutcomeRepositoryImpl(db))


def _eval_uc(db: AsyncSession) -> EvaluationUseCase:
    return EvaluationUseCase(
        EvaluationRepositoryImpl(db),
        LearningOutcomeRepositoryImpl(db),
        UserRepositoryImpl(db),
        ConfigRepositoryImpl(db),
    )


def _lo_out(lo: LearningOutcome) -> LearningOutcomeOut:
    return LearningOutcomeOut(
        id=lo.id,
        numero=lo.numero,
        nome=lo.nome,
        descricao=lo.descricao,
        ativo=lo.ativo,
        ordem=lo.ordem,
    )


def _eval_out(
    ev: WeeklyEvaluation | None,
    lo_map: dict[UUID, LearningOutcome],
    user_id: UUID,
    user_nome: str,
    turma: str,
    semana: int,
) -> EvaluationOut:
    if ev is None:
        return EvaluationOut(user_id=user_id, user_nome=user_nome, semana=semana, turma=turma)
    return EvaluationOut(
        user_id=ev.user_id,
        user_nome=user_nome,
        semana=ev.semana,
        turma=ev.turma,
        niveis=[
            EvaluationLevelOut(
                lo_id=lvl.lo_id,
                numero=lo_map[lvl.lo_id].numero if lvl.lo_id in lo_map else None,
                nome=lo_map[lvl.lo_id].nome if lvl.lo_id in lo_map else None,
                nivel=lvl.nivel,
                mentor_id=lvl.mentor_id,
            )
            for lvl in ev.niveis
        ],
        comentarios=[
            EvaluationCommentOut(mentor_id=c.mentor_id, mentor_nome=c.mentor_nome, texto=c.texto)
            for c in ev.comentarios
        ],
    )


# ── Roster da turma (para a tela de avaliação) ───────────────────────────────
@router.get("/avaliacoes/alunos", summary="Alunos de uma turma (para avaliar)")
async def alunos_da_turma(
    turma: str,
    db: AsyncSession = Depends(get_db),
    mentor: UserModel = Depends(require_mentor),
) -> list[dict[str, Any]]:
    """Roster de alunos da turma (ATIVOS e DESLIGADOS), escopado ao mentor.

    Diferente de /frequencia (que lista só ATIVOS), aqui incluímos desligados para
    permitir avaliar/corrigir semanas anteriores; o status acompanha cada aluno.
    """
    await assert_turma_permitida(db, mentor, turma)
    rows = (
        await db.execute(
            select(UserModel)
            .where(
                UserModel.tipo == TipoUsuario.ALUNO,
                UserModel.turma_ou_equipe == turma,
            )
            .order_by(UserModel.nome)
        )
    ).scalars().all()
    return [
        {"id": str(u.id), "nome": u.nome, "status": getattr(u.status, "value", u.status)}
        for u in rows
    ]


# ── LO catalog ──────────────────────────────────────────────────────────────
@router.get("/los", response_model=list[LearningOutcomeOut], summary="Lista learning outcomes")
async def listar_los(
    incluir_inativos: bool = False,
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> Any:
    los = await _catalog_uc(db).listar(incluir_inativos=incluir_inativos)
    return [_lo_out(lo) for lo in los]


@router.post(
    "/los", status_code=201, response_model=LearningOutcomeOut, summary="Cria um LO (admin)"
)
async def criar_lo(
    body: LearningOutcomeInput,
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> Any:
    _require_admin_role(mentor)
    try:
        lo = await _catalog_uc(db).criar(body.numero, body.nome, body.descricao, body.ordem)
    except LOValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _lo_out(lo)


@router.put(
    "/los/{lo_id}", response_model=LearningOutcomeOut, summary="Edita/desativa um LO (admin)"
)
async def atualizar_lo(
    lo_id: UUID,
    body: LearningOutcomeUpdate,
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> Any:
    _require_admin_role(mentor)
    try:
        lo = await _catalog_uc(db).atualizar(
            lo_id, nome=body.nome, descricao=body.descricao, ativo=body.ativo, ordem=body.ordem
        )
    except LONotFoundError as exc:
        raise HTTPException(status_code=404, detail="LO não encontrado") from exc
    except LOValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _lo_out(lo)


# ── Program config ────────────────────────────────────────────────────────
@router.get("/avaliacoes/config", response_model=ProgramConfig, summary="Config do programa")
async def obter_config(
    mentor: UserModel = Depends(require_mentor), db: AsyncSession = Depends(get_db)
) -> Any:
    inicio, num, atual = await _eval_uc(db).program_config()
    return ProgramConfig(data_inicio=inicio, num_semanas=num, semana_atual=atual)


# ── Evaluation ──────────────────────────────────────────────────────────────
async def _assert_turma(uc: EvaluationUseCase, mentor: UserModel, user_id: UUID) -> str:
    turma = await uc.turma_do_aluno(user_id)
    if turma is None:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    if not _is_admin(mentor) and mentor.turma_ou_equipe != turma:
        raise HTTPException(status_code=403, detail="Mentor não pertence à turma do aluno.")
    return turma


@router.get(
    "/avaliacoes/prefill", response_model=Prefill, summary="Níveis anteriores (pré-preenchimento)"
)
async def obter_prefill(
    user_id: UUID,
    semana: int,
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> Any:
    uc = _eval_uc(db)
    await _assert_turma(uc, mentor, user_id)
    return Prefill(semana=semana, niveis=await uc.prefill(user_id, semana))


@router.get("/avaliacoes", response_model=EvaluationOut, summary="Avaliação do aluno na semana")
async def obter_avaliacao(
    user_id: UUID,
    semana: int,
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> Any:
    uc = _eval_uc(db)
    await _assert_turma(uc, mentor, user_id)
    try:
        ev, lo_map, nome, turma = await uc.obter(user_id, semana)
    except StudentNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Aluno não encontrado") from exc
    return _eval_out(ev, lo_map, user_id, nome, turma, semana)


@router.post(
    "/avaliacoes", response_model=EvaluationOut, summary="Registra/atualiza avaliação semanal"
)
async def registrar_avaliacao(
    body: EvaluationInput,
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> Any:
    uc = _eval_uc(db)
    try:
        ev, lo_map, nome = await uc.registrar(
            user_id=body.user_id,
            mentor_id=mentor.id,
            mentor_turma=mentor.turma_ou_equipe,
            mentor_nome=mentor.nome,
            semana=body.semana,
            niveis=body.niveis,
            comentario=body.comentario,
        )
    except StudentNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Aluno não encontrado") from exc
    except TurmaScopeError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except EvaluationValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _eval_out(ev, lo_map, body.user_id, nome, ev.turma, body.semana)


# ── Dashboard ─────────────────────────────────────────────────────────────
def _assert_turma_scope(mentor: UserModel, turma: str) -> None:
    if not _is_admin(mentor) and mentor.turma_ou_equipe != turma:
        raise HTTPException(status_code=403, detail="Mentor não pertence a esta turma.")


@router.get("/avaliacoes/dashboard", response_model=Dashboard, summary="Dashboard da turma/semana")
async def obter_dashboard(
    turma: str,
    semana: int,
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> Any:
    _assert_turma_scope(mentor, turma)
    return await _eval_uc(db).dashboard(turma, semana)


# ── Weekly report export ────────────────────────────────────────────────────
@router.get("/avaliacoes/export", summary="Exporta relatório semanal (CSV/Excel)")
async def exportar_relatorio(
    turma: str,
    semana: int,
    format: str = "csv",
    mentor: UserModel = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    _assert_turma_scope(mentor, turma)
    dados = await _eval_uc(db).dados_relatorio(turma, semana)
    los = dados["los"]
    header = ["Aluno", "Email", "Status", *[f"LO{lo.numero}" for lo in los], "Comentários"]

    def row_for(linha: dict[str, Any]) -> list[str]:
        status = "PENDENTE" if linha["pendente"] else "AVALIADO"
        niveis = ["" if n is None else str(n) for n in linha["niveis"]]
        return [linha["nome"], linha["email"], status, *niveis, linha["comentarios"]]

    if format == "excel":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"Semana {semana}"
        ws.append(header)
        for linha in dados["linhas"]:
            ws.append(row_for(linha))
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=avaliacoes_{turma}_s{semana}.xlsx"
            },
        )

    out_csv = io.StringIO()
    writer = csv.writer(out_csv)
    writer.writerow(header)
    for linha in dados["linhas"]:
        writer.writerow(row_for(linha))
    out_csv.seek(0)
    return StreamingResponse(
        iter([out_csv.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=avaliacoes_{turma}_s{semana}.csv"},
    )

"""Helpers de seed para os testes de avaliação de LOs (branch 002)."""

import uuid
from datetime import UTC, datetime

from app.adapters.auth.jwt_handler import create_access_token
from app.adapters.persistence.database import async_session_maker
from app.adapters.persistence.orm_models import Config as ConfigModel
from app.adapters.persistence.orm_models import LearningOutcome as LOModel
from app.adapters.persistence.orm_models import User as UserModel
from app.adapters.persistence.orm_models import WeeklyEvaluation as EvalModel
from app.domain.enums import RoleAdmin, StatusAluno, TipoUsuario
from app.domain.models import CFG_DATA_INICIO, CFG_NUM_SEMANAS


def auth(user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user_id)})}"}


async def seed_config(data_inicio: str = "2026-01-05", num_semanas: int = 12) -> None:
    now = datetime.now(UTC)
    async with async_session_maker() as s:
        for chave, valor in ((CFG_DATA_INICIO, data_inicio), (CFG_NUM_SEMANAS, str(num_semanas))):
            # remove previous to keep idempotent
            await s.execute(ConfigModel.__table__.delete().where(ConfigModel.chave == chave))
            s.add(ConfigModel(id=uuid.uuid4(), chave=chave, valor=valor, atualizado_em=now))
        await s.commit()


async def seed_user(
    *,
    tipo: TipoUsuario,
    role: RoleAdmin,
    turma: str,
    nome: str = "User",
    status: StatusAluno | None = None,
) -> uuid.UUID:
    uid = uuid.uuid4()
    now = datetime.now(UTC)
    kwargs = {"status": status} if status is not None else {}
    async with async_session_maker() as s:
        s.add(
            UserModel(
                id=uid,
                email=f"{nome.lower().replace(' ', '')}_{uid}@t.com",
                nome=nome,
                tipo=tipo,
                role=role,
                turma_ou_equipe=turma,
                oauth_provider="g",
                oauth_sub=str(uid),
                ativo=True,
                admin_aprovado=True,
                criado_em=now,
                atualizado_em=now,
                **kwargs,
            )
        )
        await s.commit()
    return uid


async def seed_lo(numero: int, nome: str, ativo: bool = True) -> uuid.UUID:
    lid = uuid.uuid4()
    now = datetime.now(UTC)
    async with async_session_maker() as s:
        s.add(
            LOModel(
                id=lid,
                numero=numero,
                nome=nome,
                ativo=ativo,
                ordem=numero,
                criado_em=now,
                atualizado_em=now,
            )
        )
        await s.commit()
    return lid


async def cleanup(user_ids: list, lo_ids: list) -> None:
    user_ids = [uuid.UUID(str(u)) for u in user_ids]
    lo_ids = [uuid.UUID(str(lid)) for lid in lo_ids]
    async with async_session_maker() as s:
        # delete evaluations (cascade levels/comments) for these users
        for uid in user_ids:
            evs = (
                await s.execute(EvalModel.__table__.select().where(EvalModel.user_id == uid))
            ).all()
            for ev in evs:
                from app.adapters.persistence.orm_models import (
                    EvaluationComment as C,
                )
                from app.adapters.persistence.orm_models import (
                    EvaluationLevel as L,
                )

                await s.execute(L.__table__.delete().where(L.evaluation_id == ev.id))
                await s.execute(C.__table__.delete().where(C.evaluation_id == ev.id))
            await s.execute(EvalModel.__table__.delete().where(EvalModel.user_id == uid))
        # levels reference LOs (RESTRICT) — delete any remaining levels on these LOs first is
        # unnecessary because evaluations above are gone; now delete LOs
        for lid in lo_ids:
            await s.execute(LOModel.__table__.delete().where(LOModel.id == lid))
        for uid in user_ids:
            await s.execute(UserModel.__table__.delete().where(UserModel.id == uid))
        await s.commit()

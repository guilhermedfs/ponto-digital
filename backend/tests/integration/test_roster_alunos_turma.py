"""Integração: roster de alunos por turma para a tela de avaliação.

Diferente de /frequencia (só ATIVOS), este endpoint inclui DESLIGADOS para permitir
avaliar/corrigir semanas anteriores, e é escopado por turma.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.domain.enums import RoleAdmin, StatusAluno, TipoUsuario
from app.main import app
from tests.integration.lo_fixtures import auth, cleanup, seed_user

TURMA = "Turma X"
OUTRA = "Turma Y"


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")


@pytest.mark.asyncio
async def test_roster_inclui_desligados_e_escopa_turma() -> None:
    mentor = await seed_user(tipo=TipoUsuario.STAFF, role=RoleAdmin.ADMIN, turma=TURMA, nome="Mentor")
    ativo = await seed_user(
        tipo=TipoUsuario.ALUNO, role=RoleAdmin.NONE, turma=TURMA, nome="Ativo", status=StatusAluno.ATIVO
    )
    deslig = await seed_user(
        tipo=TipoUsuario.ALUNO, role=RoleAdmin.NONE, turma=TURMA, nome="Desligado",
        status=StatusAluno.DESLIGADO,
    )
    outra = await seed_user(tipo=TipoUsuario.ALUNO, role=RoleAdmin.NONE, turma=OUTRA, nome="Outra")
    try:
        async with _client() as c:
            r = await c.get(
                "/api/v1/admin/avaliacoes/alunos", headers=auth(mentor), params={"turma": TURMA}
            )
            assert r.status_code == 200, r.text
            data = {x["nome"]: x for x in r.json()}
            # inclui desligado, exclui aluno de outra turma
            assert set(data) == {"Ativo", "Desligado"}
            assert data["Ativo"]["status"] == "ATIVO"
            assert data["Desligado"]["status"] == "DESLIGADO"
    finally:
        await cleanup([mentor, ativo, deslig, outra], [])

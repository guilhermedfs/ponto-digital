from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.domain.enums import TipoUsuario


class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    nome: str
    tipo: TipoUsuario
    role: str | None = None
    turma_ou_equipe: str
    patrimonio: str | None = None
    ativo: bool
    admin_aprovado: bool
    status: str | None = None  # ATIVO | DESLIGADO (alunos); tela Pessoas usa para o selo
    criado_em: datetime


class DeviceAdminResponse(BaseModel):
    id: UUID
    user_id: UUID
    mac_address: str
    os_type: str
    hostname: str | None = None
    principal: bool
    registrado_em: datetime


class CheckinAdminResponse(BaseModel):
    id: UUID
    user_id: UUID
    device_id: UUID
    hora_checkin: datetime
    status: str
    turno_referencia: str
    exportado_sheets: bool

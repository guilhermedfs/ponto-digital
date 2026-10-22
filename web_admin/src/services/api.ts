export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface User {
  id: string | number;
  nome: string;
  email: string;
  tipo: string;
  role?: string;
  admin_aprovado: boolean;
  status?: string; // ATIVO | DESLIGADO (alunos)
  turma_ou_equipe?: string;
}

export const setAlunoStatus = async (userId: string | number, status: string): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/alunos/${userId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível alterar o status');
  }
};

export const fetchUsers = async (): Promise<User[]> => {
  const res = await fetch(`${API_URL}/admin/usuarios`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) throw new Error('Não foi possível carregar as pessoas.');
  return res.json();
};

export const approveUser = async (id: string | number): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/usuarios/${id}/aprovar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) throw new Error('Não foi possível autorizar a pessoa.');
};

export const adminLogin = async (email: string, password: string): Promise<{ access_token: string }> => {
  const res = await fetch(`${API_URL}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('Não foi possível entrar. Verifique suas credenciais.');
  return res.json();
};

// ─────────────────────────── Turmas ───────────────────────────

export const listTurmas = async (): Promise<string[]> => {
  const res = await fetch(`${API_URL}/admin/turmas`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Não foi possível listar turmas');
  return res.json();
};

export const createTurma = async (nome: string): Promise<string[]> => {
  const res = await fetch(`${API_URL}/admin/turmas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ nome }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível cadastrar turma');
  }
  return res.json();
};

/** Turmas que o mentor logado pode lançar (as suas; admin vê todas). */
export const getFrequenciaTurmas = async (): Promise<string[]> => {
  const res = await fetch(`${API_URL}/frequencia/turmas`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Não foi possível carregar suas turmas');
  return res.json();
};

export const getMentorTurmas = async (userId: string | number): Promise<string[]> => {
  const res = await fetch(`${API_URL}/admin/mentores/${userId}/turmas`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Não foi possível carregar as turmas do mentor');
  return res.json();
};

export const setMentorTurmas = async (userId: string | number, turmas: string[]): Promise<string[]> => {
  const res = await fetch(`${API_URL}/admin/mentores/${userId}/turmas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ turmas }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível salvar as turmas do mentor');
  }
  return res.json();
};

export const deleteTurma = async (nome: string): Promise<string[]> => {
  const res = await fetch(`${API_URL}/admin/turmas/${encodeURIComponent(nome)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível remover turma');
  }
  return res.json();
};

export const createStudent = async (nome: string, email: string, turma: string): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/alunos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ nome, email, turma_ou_equipe: turma })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data.detail === 'string' ? data.detail
      : (Array.isArray(data.detail) ? data.detail.map((d: any) => d.msg).join(', ') : 'Não foi possível registrar aluno');
    throw new Error(msg);
  }
};

export const createAdmin = async (nome: string, email: string, senha: string, role: string = "STAFF"): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/usuarios`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}` 
    },
    body: JSON.stringify({ nome, email, senha, role })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const errorMessage = typeof data.detail === 'string' ? data.detail : (Array.isArray(data.detail) ? data.detail.map((d: any) => d.msg).join(', ') : 'Não foi possível criar o acesso.');
    throw new Error(errorMessage);
  }
};

export const deleteUser = async (id: string | number): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/usuarios/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Não foi possível excluir a pessoa.');
  }
};

export const updateRole = async (id: string | number, role: string): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/usuarios/${id}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ role })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Não foi possível alterar o cargo.');
  }
};

// ─────────────────────────── Frequência (lançada pelo mentor) ───────────────────────────

export interface AlunoFrequencia {
  aluno_id: string;
  aluno_nome: string;
  freq_id: string | null;
  status: string | null; // PRESENTE | FALTA | JUSTIFICADO | null
  tem_atestado: boolean;
}

export const getFrequencia = async (
  turma: string,
  data: string,
  turno: string,
): Promise<AlunoFrequencia[]> => {
  const params = new URLSearchParams({ turma, data, turno });
  const res = await fetch(`${API_URL}/frequencia?${params.toString()}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível carregar a frequência'));
  return res.json();
};

/**
 * Roster de alunos de uma turma para a tela de avaliação (escopado por mentor).
 * Usa o endpoint dedicado /admin/avaliacoes/alunos (inclui ATIVOS e DESLIGADOS).
 * Fallback para /frequencia (só ATIVOS) em backends antigos sem esse endpoint.
 */
export const getAlunosDaTurma = async (
  turma: string,
): Promise<{ id: string; nome: string; status?: string }[]> => {
  const res = await fetch(`${API_URL}/admin/avaliacoes/alunos?turma=${encodeURIComponent(turma)}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (res.ok) return res.json();
  if (res.status !== 404) {
    throw new Error(await parseError(res, 'Não foi possível carregar os alunos da turma'));
  }
  // Backend antigo: roster via frequência (data/turno arbitrários só para obter a lista).
  const roster = await getFrequencia(turma, '2000-01-01', 'manha');
  return roster.map((r) => ({ id: r.aluno_id, nome: r.aluno_nome }));
};

export const lancarFrequencia = async (
  turma: string,
  data: string,
  turno: string,
  lancamentos: { aluno_id: string; status: string }[],
): Promise<void> => {
  const res = await fetch(`${API_URL}/frequencia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ turma, data, turno, lancamentos }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível salvar a frequência'));
};

export const anexarAtestadoFrequencia = async (freqId: string, file: File): Promise<void> => {
  const form = new FormData();
  form.append('documento', file);
  const res = await fetch(`${API_URL}/frequencia/${freqId}/atestado`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível anexar o atestado'));
};

export const removerAtestadoFrequencia = async (freqId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/frequencia/${freqId}/atestado`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível remover o atestado'));
};

export const baixarAtestadoFrequencia = async (freqId: string): Promise<void> => {
  const res = await fetch(`${API_URL}/frequencia/${freqId}/atestado`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível abrir o atestado'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

// ─────────────────────────── Atestados Médicos ───────────────────────────

export interface JustifiedDay {
  data: string;
  turno: string;
  turno_referencia: string;
  ativo: boolean;
}

export interface Certificate {
  id: string;
  user_id: string;
  user_nome?: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  status: 'ACTIVE' | 'REVOKED';
  dias_justificados: number;
  documento_filename: string;
  documento_content_type: string;
  criado_em: string;
  observacao?: string | null;
  registrado_por?: string | null;
  revogado_por?: string | null;
  revogado_em?: string | null;
  motivo_revogacao?: string | null;
  dias?: JustifiedDay[];
}

const authHeader = (): Record<string, string> => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const parseError = async (res: Response, fallback: string): Promise<string> => {
  const data = await res.json().catch(() => ({}));
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return data.detail.map((d: any) => d.msg).join(', ');
  return fallback;
};

export const recordCertificate = async (
  userId: string,
  periodoInicio: string,
  periodoFim: string,
  documento: File,
  observacao?: string,
): Promise<Certificate> => {
  const form = new FormData();
  form.append('user_id', userId);
  form.append('periodo_inicio', periodoInicio);
  form.append('periodo_fim', periodoFim);
  if (observacao) form.append('observacao', observacao);
  form.append('documento', documento);
  const res = await fetch(`${API_URL}/admin/certificados`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível registrar atestado'));
  return res.json();
};

export const listCertificates = async (
  userId?: string,
  status?: 'ACTIVE' | 'REVOKED',
): Promise<Certificate[]> => {
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  if (status) params.append('status', status);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/admin/certificados${qs ? `?${qs}` : ''}`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível listar atestados'));
  return res.json();
};

export const getCertificate = async (id: string): Promise<Certificate> => {
  const res = await fetch(`${API_URL}/admin/certificados/${id}`, { headers: authHeader() });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível carregar atestado'));
  return res.json();
};

export const openCertificateDocument = async (id: string): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/certificados/${id}/documento`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível abrir documento'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const revokeCertificate = async (id: string, motivo?: string): Promise<Certificate> => {
  const res = await fetch(`${API_URL}/admin/certificados/${id}/revogar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ motivo: motivo ?? null }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível revogar atestado'));
  return res.json();
};

/** Download an admin export (checkins/usuarios …) as a file. */
export const adminExport = async (endpoint: string, filename: string): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/export/${endpoint}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Não foi possível exportar');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const justificarFalta = async (id: string | number, data: string, turno: string): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/usuarios/${id}/justificar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ data, turno })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Não foi possível justificar falta');
  }
};

// ─────────────────────────── Avaliação de LOs ───────────────────────────

export interface LearningOutcome {
  id: string;
  numero: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  ordem: number;
}

export interface ProgramConfig {
  data_inicio: string | null;
  num_semanas: number;
  semana_atual: number | null;
}

export interface EvaluationLevel {
  lo_id: string;
  numero?: number | null;
  nome?: string | null;
  nivel: number;
  mentor_id?: string | null;
}

export interface EvaluationComment {
  mentor_id?: string | null;
  mentor_nome: string;
  texto: string;
}

export interface Evaluation {
  user_id: string;
  user_nome?: string | null;
  semana: number;
  turma: string;
  niveis: EvaluationLevel[];
  comentarios: EvaluationComment[];
}

export interface DashboardData {
  turma: string;
  semana: number;
  total_alunos: number;
  avaliados: number;
  pendentes: { user_id: string; nome: string }[];
  por_mentor: { mentor_nome: string; alunos_avaliados: number }[];
  heatmap: { lo_id: string; numero: number; nome: string; contagem: number[] }[];
  regressoes: {
    user_id: string; nome: string; lo_id: string; numero: number;
    nivel_atual: number; nivel_anterior: number;
  }[];
}

const authHeaderJson = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const listLearningOutcomes = async (incluirInativos = false): Promise<LearningOutcome[]> => {
  const res = await fetch(`${API_URL}/admin/los?incluir_inativos=${incluirInativos}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível listar LOs'));
  return res.json();
};

export const createLearningOutcome = async (
  numero: number, nome: string, descricao?: string,
): Promise<LearningOutcome> => {
  const res = await fetch(`${API_URL}/admin/los`, {
    method: 'POST', headers: authHeaderJson(),
    body: JSON.stringify({ numero, nome, descricao: descricao ?? null }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível criar LO'));
  return res.json();
};

export const updateLearningOutcome = async (
  id: string, patch: Partial<Pick<LearningOutcome, 'nome' | 'descricao' | 'ativo' | 'ordem'>>,
): Promise<LearningOutcome> => {
  const res = await fetch(`${API_URL}/admin/los/${id}`, {
    method: 'PUT', headers: authHeaderJson(), body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível atualizar LO'));
  return res.json();
};

export const getProgramConfig = async (): Promise<ProgramConfig> => {
  const res = await fetch(`${API_URL}/admin/avaliacoes/config`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível carregar configuração'));
  return res.json();
};

export const getPrefill = async (userId: string, semana: number): Promise<Record<string, number>> => {
  const res = await fetch(`${API_URL}/admin/avaliacoes/prefill?user_id=${userId}&semana=${semana}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível carregar níveis anteriores'));
  return (await res.json()).niveis;
};

export const getEvaluation = async (userId: string, semana: number): Promise<Evaluation> => {
  const res = await fetch(`${API_URL}/admin/avaliacoes?user_id=${userId}&semana=${semana}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível carregar avaliação'));
  return res.json();
};

export const submitEvaluation = async (
  userId: string, semana: number, niveis: Record<string, number>, comentario?: string,
): Promise<Evaluation> => {
  const res = await fetch(`${API_URL}/admin/avaliacoes`, {
    method: 'POST', headers: authHeaderJson(),
    body: JSON.stringify({ user_id: userId, semana, niveis, comentario: comentario ?? null }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível salvar avaliação'));
  return res.json();
};

export const getDashboard = async (turma: string, semana: number): Promise<DashboardData> => {
  const res = await fetch(
    `${API_URL}/admin/avaliacoes/dashboard?turma=${encodeURIComponent(turma)}&semana=${semana}`,
    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
  );
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível carregar dashboard'));
  return res.json();
};

export const exportWeeklyReport = async (
  turma: string, semana: number, formato: 'csv' | 'excel' = 'excel',
): Promise<void> => {
  const res = await fetch(
    `${API_URL}/admin/avaliacoes/export?turma=${encodeURIComponent(turma)}&semana=${semana}&format=${formato}`,
    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
  );
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível exportar'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `avaliacoes_${turma}_s${semana}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

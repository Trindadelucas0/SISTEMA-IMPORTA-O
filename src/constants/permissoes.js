const MODULOS = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'pedidos', label: 'Pedidos', path: '/pedidos' },
  { id: 'produtos', label: 'Produtos', path: '/produtos' },
  { id: 'fornecedores', label: 'Fornecedores', path: '/fornecedores' },
  { id: 'pagamentos', label: 'Pagamentos', path: '/pagamentos' },
  { id: 'saldo', label: 'Saldo', path: '/saldo' },
  { id: 'desembaraco', label: 'Compras', path: '/desembaraco' },
  { id: 'analises', label: 'Análises', path: '/analises' },
];

const MODULO_IDS = MODULOS.map((m) => m.id);

const PRESET_FINANCEIRO = ['pagamentos', 'saldo'];

const AVISO_SESSAO_CONCORRENTE =
  'Outro acesso com suas credenciais. Se não foi você, contate a equipe de TI.';

function normalizarPermissoes(lista) {
  if (!Array.isArray(lista)) return [];
  const set = new Set(MODULO_IDS);
  return [...new Set(lista.map(String).filter((id) => set.has(id)))];
}

function primeiraRotaPermitida(user) {
  if (!user) return '/login';
  if (user.role === 'admin') return '/';
  const perms = normalizarPermissoes(user.permissoes);
  for (const mod of MODULOS) {
    if (perms.includes(mod.id)) return mod.path;
  }
  return null;
}

function temPermissao(user, modulo) {
  if (!user || !user.ativo) return false;
  if (user.role === 'admin') return true;
  const perms = normalizarPermissoes(user.permissoes);
  return perms.includes(modulo);
}

module.exports = {
  MODULOS,
  MODULO_IDS,
  PRESET_FINANCEIRO,
  AVISO_SESSAO_CONCORRENTE,
  normalizarPermissoes,
  primeiraRotaPermitida,
  temPermissao,
};

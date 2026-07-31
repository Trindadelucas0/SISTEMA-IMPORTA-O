const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { normalizarPermissoes, MODULO_IDS } = require('../constants/permissoes');

const SALT_ROUNDS = 10;

function mapRow(row) {
  if (!row) return null;
  let permissoes = row.permissoes;
  if (typeof permissoes === 'string') {
    try {
      permissoes = JSON.parse(permissoes);
    } catch {
      permissoes = [];
    }
  }
  return {
    ...row,
    permissoes: normalizarPermissoes(permissoes || []),
  };
}

const Usuario = {
  async listar() {
    const { rows } = await query(
      `SELECT id, username, nome, role, permissoes, session_version, ativo, created_at, updated_at
       FROM usuarios
       ORDER BY role ASC, nome ASC`
    );
    return rows.map(mapRow);
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return mapRow(rows[0]);
  },

  async findByUsername(username) {
    const { rows } = await query(
      'SELECT * FROM usuarios WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    return mapRow(rows[0]);
  },

  async criar({ username, password, nome, role, permissoes, ativo }) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const perms =
      role === 'admin' ? [...MODULO_IDS] : normalizarPermissoes(permissoes);
    const { rows } = await query(
      `INSERT INTO usuarios (username, password_hash, nome, role, permissoes, ativo)
       VALUES ($1, $2, $3, $4, $5::jsonb, COALESCE($6, true))
       RETURNING *`,
      [
        username.trim(),
        hash,
        nome.trim(),
        role === 'admin' ? 'admin' : 'user',
        JSON.stringify(perms),
        ativo,
      ]
    );
    return mapRow(rows[0]);
  },

  async atualizar(id, { username, nome, role, permissoes, ativo }) {
    const perms =
      role === 'admin' ? [...MODULO_IDS] : normalizarPermissoes(permissoes);
    const { rows } = await query(
      `UPDATE usuarios
       SET username = $2,
           nome = $3,
           role = $4,
           permissoes = $5::jsonb,
           ativo = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        username.trim(),
        nome.trim(),
        role === 'admin' ? 'admin' : 'user',
        JSON.stringify(perms),
        ativo !== false,
      ]
    );
    return mapRow(rows[0]);
  },

  async renovarSenha(id, password) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await query(
      `UPDATE usuarios
       SET password_hash = $2,
           session_version = session_version + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, hash]
    );
    return mapRow(rows[0]);
  },

  async autenticar(username, password) {
    const user = await this.findByUsername(username);
    if (!user || !user.ativo) return null;
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return null;
    return user;
  },

  async bumpSessionVersion(id) {
    const { rows } = await query(
      `UPDATE usuarios
       SET session_version = session_version + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return mapRow(rows[0]);
  },

  async ensureAdminSeed() {
    const { rows } = await query('SELECT id FROM usuarios WHERE role = $1 LIMIT 1', [
      'admin',
    ]);
    if (rows.length > 0) return null;

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const nome = process.env.ADMIN_NOME || 'Administrador';

    const created = await this.criar({
      username,
      password,
      nome,
      role: 'admin',
      permissoes: [...MODULO_IDS],
      ativo: true,
    });
    console.log(`Admin inicial criado: ${username}`);
    return created;
  },
};

module.exports = Usuario;

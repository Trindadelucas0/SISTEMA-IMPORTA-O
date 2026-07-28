const { query } = require('../config/db');

const Produto = {
  async listar() {
    const { rows } = await query('SELECT * FROM produtos ORDER BY nome ASC');
    return rows;
  },

  async listarAtivos() {
    const { rows } = await query(
      'SELECT * FROM produtos WHERE ativo = true ORDER BY nome ASC'
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM produtos WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async criar({ codigo_interno, nome, ncm, preco_usd, ativo }) {
    const { rows } = await query(
      `INSERT INTO produtos (codigo_interno, nome, ncm, preco_usd, ativo)
       VALUES ($1, $2, $3, $4, COALESCE($5, true))
       RETURNING *`,
      [codigo_interno, nome, ncm || null, preco_usd || 0, ativo]
    );
    return rows[0];
  },

  async atualizar(id, { codigo_interno, nome, ncm, preco_usd, ativo }) {
    const { rows } = await query(
      `UPDATE produtos
       SET codigo_interno = $2,
           nome = $3,
           ncm = $4,
           preco_usd = $5,
           ativo = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, codigo_interno, nome, ncm || null, preco_usd || 0, ativo]
    );
    return rows[0] || null;
  },

  async remover(id) {
    await query('DELETE FROM produtos WHERE id = $1', [id]);
  },
};

module.exports = Produto;

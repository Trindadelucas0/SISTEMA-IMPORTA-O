const { query } = require('../config/db');

const Produto = {
  async listar() {
    const { rows } = await query('SELECT * FROM produtos ORDER BY nome ASC');
    return rows;
  },

  async listarSugestoes() {
    const { rows } = await query(
      'SELECT id, nome, codigo_interno FROM produtos ORDER BY nome ASC'
    );
    return rows;
  },

  async listarPaginado({ q = '', page = 1, pageSize = 15 } = {}) {
    const termo = String(q || '').trim();
    const size = Math.max(1, Math.min(100, Number(pageSize) || 15));
    let pageNum = Math.max(1, Number(page) || 1);

    const params = [];
    let where = '';
    if (termo) {
      params.push(`%${termo}%`);
      where = 'WHERE nome ILIKE $1 OR codigo_interno ILIKE $1';
    }

    const countSql = `SELECT COUNT(*)::int AS total FROM produtos ${where}`;
    const { rows: countRows } = await query(countSql, params);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / size) || 1);
    if (pageNum > totalPages) pageNum = totalPages;

    const offset = (pageNum - 1) * size;
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const listSql = `
      SELECT * FROM produtos
      ${where}
      ORDER BY nome ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}`;
    const { rows } = await query(listSql, [...params, size, offset]);

    return {
      rows,
      total,
      page: pageNum,
      pageSize: size,
      totalPages,
    };
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

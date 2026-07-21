const { query } = require('../config/db');

const Pedido = {
  async listar() {
    const { rows } = await query(
      `SELECT p.*,
              COALESCE((
                SELECT SUM(i.quantidade * i.preco_usd)
                FROM itens_pedido i WHERE i.pedido_id = p.id
              ), 0) AS total_usd,
              COALESCE((
                SELECT COUNT(*) FROM itens_pedido i WHERE i.pedido_id = p.id
              ), 0) AS qtd_itens
       FROM pedidos p
       ORDER BY p.created_at DESC`
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async criar({ codigo, fornecedor, status, observacao }) {
    const { rows } = await query(
      `INSERT INTO pedidos (codigo, fornecedor, status, observacao)
       VALUES ($1, $2, COALESCE($3, 'aberta'), $4)
       RETURNING *`,
      [codigo, fornecedor || null, status || 'aberta', observacao || null]
    );
    const pedido = rows[0];
    await query(
      `INSERT INTO desembaracos (pedido_id, dolar_dia, custo_desembaraco_total, divisor_bc_icms)
       VALUES ($1, 0, 0, 0.94)
       ON CONFLICT (pedido_id) DO NOTHING`,
      [pedido.id]
    );
    return pedido;
  },

  async atualizar(id, { codigo, fornecedor, status, observacao }) {
    const { rows } = await query(
      `UPDATE pedidos
       SET codigo = $2,
           fornecedor = $3,
           status = $4,
           observacao = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, codigo, fornecedor || null, status || 'aberta', observacao || null]
    );
    return rows[0] || null;
  },

  async remover(id) {
    await query('DELETE FROM pedidos WHERE id = $1', [id]);
  },
};

module.exports = Pedido;

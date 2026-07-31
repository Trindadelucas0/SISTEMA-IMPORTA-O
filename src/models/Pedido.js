const { query } = require('../config/db');

const Pedido = {
  async listar() {
    const { rows } = await query(
      `SELECT p.*,
              COALESCE(f.nome, p.fornecedor) AS fornecedor_nome,
              COALESCE((
                SELECT SUM(i.quantidade * i.preco_usd)
                FROM itens_pedido i WHERE i.pedido_id = p.id
              ), 0) AS total_usd,
              COALESCE((
                SELECT COUNT(*) FROM itens_pedido i WHERE i.pedido_id = p.id
              ), 0) AS qtd_itens
       FROM pedidos p
       LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
       ORDER BY p.created_at DESC`
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT p.*,
              COALESCE(f.nome, p.fornecedor) AS fornecedor_nome
       FROM pedidos p
       LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
       WHERE p.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async criar({
    codigo,
    fornecedor,
    fornecedor_id,
    status,
    observacao,
    data_inicio_fabricacao,
    data_prevista_chegada,
  }) {
    const { rows } = await query(
      `INSERT INTO pedidos (
         codigo, fornecedor, fornecedor_id, status, observacao,
         data_inicio_fabricacao, data_prevista_chegada
       )
       VALUES ($1, $2, $3, COALESCE($4, 'aberta'), $5, $6, $7)
       RETURNING *`,
      [
        codigo,
        fornecedor || null,
        fornecedor_id || null,
        status || 'aberta',
        observacao || null,
        data_inicio_fabricacao || null,
        data_prevista_chegada || null,
      ]
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

  async atualizar(id, {
    codigo,
    fornecedor,
    fornecedor_id,
    status,
    observacao,
    data_inicio_fabricacao,
    data_prevista_chegada,
  }) {
    const { rows } = await query(
      `UPDATE pedidos
       SET codigo = $2,
           fornecedor = $3,
           fornecedor_id = $4,
           status = $5,
           observacao = $6,
           data_inicio_fabricacao = $7,
           data_prevista_chegada = $8,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        codigo,
        fornecedor || null,
        fornecedor_id || null,
        status || 'aberta',
        observacao || null,
        data_inicio_fabricacao || null,
        data_prevista_chegada || null,
      ]
    );
    return rows[0] || null;
  },

  async atualizarStatus(id, status) {
    const { rows } = await query(
      `UPDATE pedidos
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );
    return rows[0] || null;
  },

  async remover(id) {
    await query('DELETE FROM pedidos WHERE id = $1', [id]);
  },
};

module.exports = Pedido;

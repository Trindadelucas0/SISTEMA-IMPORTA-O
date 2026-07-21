const { query } = require('../config/db');

const Alocacao = {
  async listar({ pedidoId, pagamentoId } = {}) {
    const clauses = [];
    const params = [];
    if (pedidoId) {
      params.push(pedidoId);
      clauses.push(`a.pedido_id = $${params.length}`);
    }
    if (pagamentoId) {
      params.push(pagamentoId);
      clauses.push(`a.pagamento_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT a.*,
              p.codigo AS pedido_codigo,
              pg.descricao AS pagamento_descricao,
              pg.data_pagamento,
              pg.dolar_dia
       FROM alocacoes a
       JOIN pedidos p ON p.id = a.pedido_id
       JOIN pagamentos pg ON pg.id = a.pagamento_id
       ${where}
       ORDER BY a.created_at ASC, a.id ASC`,
      params
    );
    return rows;
  },

  async criar({ pagamento_id, pedido_id, valor_usd, valor_brl }) {
    const { rows } = await query(
      `INSERT INTO alocacoes (pagamento_id, pedido_id, valor_usd, valor_brl)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [pagamento_id, pedido_id, valor_usd, valor_brl]
    );
    return rows[0];
  },

  async remover(id) {
    await query('DELETE FROM alocacoes WHERE id = $1', [id]);
  },

  async totaisByPedido(pedidoId) {
    const { rows } = await query(
      `SELECT
         COALESCE(SUM(valor_usd), 0) AS alocado_usd,
         COALESCE(SUM(valor_brl), 0) AS alocado_brl,
         COUNT(*)::int AS qtd
       FROM alocacoes
       WHERE pedido_id = $1`,
      [pedidoId]
    );
    return rows[0];
  },

  async disponivelPagamento(pagamentoId) {
    const { rows } = await query(
      `SELECT
         pg.valor_usd,
         pg.valor_brl,
         pg.dolar_dia,
         COALESCE(SUM(a.valor_usd), 0) AS alocado_usd,
         COALESCE(SUM(a.valor_brl), 0) AS alocado_brl
       FROM pagamentos pg
       LEFT JOIN alocacoes a ON a.pagamento_id = pg.id
       WHERE pg.id = $1
       GROUP BY pg.id`,
      [pagamentoId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      disponivel_usd: Number(row.valor_usd) - Number(row.alocado_usd),
      disponivel_brl: Number(row.valor_brl) - Number(row.alocado_brl),
    };
  },
};

module.exports = Alocacao;

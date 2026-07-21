const { query } = require('../config/db');

const Desembaraco = {
  async findByPedido(pedidoId) {
    const { rows } = await query(
      'SELECT * FROM desembaracos WHERE pedido_id = $1',
      [pedidoId]
    );
    return rows[0] || null;
  },

  async ensureForPedido(pedidoId) {
    let row = await this.findByPedido(pedidoId);
    if (row) return row;

    const { rows } = await query(
      `INSERT INTO desembaracos (
         pedido_id, dolar_dia, custo_desembaraco_total, divisor_bc_icms,
         custo_total_atual, custo_total_anterior
       ) VALUES ($1, 0, 0, 0.94, NULL, NULL)
       RETURNING *`,
      [pedidoId]
    );
    return rows[0];
  },

  async atualizarCabecalho(pedidoId, { custo_desembaraco_total, divisor_bc_icms }) {
    await this.ensureForPedido(pedidoId);
    const { rows } = await query(
      `UPDATE desembaracos SET
         custo_desembaraco_total = $2,
         divisor_bc_icms = COALESCE($3, 0.94),
         updated_at = NOW()
       WHERE pedido_id = $1
       RETURNING *`,
      [
        pedidoId,
        custo_desembaraco_total ?? 0,
        divisor_bc_icms ?? 0.94,
      ]
    );
    return rows[0];
  },

  async salvarSnapshotCusto(pedidoId, custoTotalAtual) {
    await this.ensureForPedido(pedidoId);
    const atual = await this.findByPedido(pedidoId);
    const anterior = atual.custo_total_atual;
    const { rows } = await query(
      `UPDATE desembaracos SET
         custo_total_anterior = $2,
         custo_total_atual = $3,
         updated_at = NOW()
       WHERE pedido_id = $1
       RETURNING *`,
      [pedidoId, anterior, custoTotalAtual]
    );
    return rows[0];
  },

  async upsertBaseItem(desembaracoId, itemPedidoId, baseDesembaraco) {
    const { rows } = await query(
      `INSERT INTO itens_desembaraco (desembaraco_id, item_pedido_id, base_desembaraco)
       VALUES ($1, $2, $3)
       ON CONFLICT (desembaraco_id, item_pedido_id)
       DO UPDATE SET base_desembaraco = EXCLUDED.base_desembaraco
       RETURNING *`,
      [desembaracoId, itemPedidoId, baseDesembaraco ?? 0]
    );
    return rows[0];
  },

  async syncItens(desembaracoId, itensBases) {
    for (const item of itensBases) {
      await this.upsertBaseItem(desembaracoId, item.item_pedido_id, item.base_desembaraco);
    }
  },
};

module.exports = Desembaraco;

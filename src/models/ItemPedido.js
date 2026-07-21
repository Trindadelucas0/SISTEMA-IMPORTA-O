const { query } = require('../config/db');

const ItemPedido = {
  async findByPedido(pedidoId) {
    const { rows } = await query(
      `SELECT i.*,
              COALESCE(id.base_desembaraco, 0) AS base_desembaraco
       FROM itens_pedido i
       LEFT JOIN desembaracos d ON d.pedido_id = i.pedido_id
       LEFT JOIN itens_desembaraco id
         ON id.item_pedido_id = i.id AND id.desembaraco_id = d.id
       WHERE i.pedido_id = $1
       ORDER BY i.ordem ASC, i.id ASC`,
      [pedidoId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM itens_pedido WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async criar(pedidoId, data) {
    const { rows } = await query(
      `INSERT INTO itens_pedido (
         pedido_id, referencia, descricao, quantidade, preco_usd, ncm,
         aliq_ii, aliq_ipi, aliq_pis, aliq_cofins, aliq_icms, ordem
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        pedidoId,
        data.referencia,
        data.descricao || null,
        data.quantidade || 0,
        data.preco_usd || 0,
        data.ncm || null,
        data.aliq_ii ?? 0.2,
        data.aliq_ipi ?? 0,
        data.aliq_pis ?? 0.021,
        data.aliq_cofins ?? 0.1025,
        data.aliq_icms ?? 0.04,
        data.ordem || 0,
      ]
    );
    const item = rows[0];

    const desembaraco = await query(
      'SELECT id FROM desembaracos WHERE pedido_id = $1',
      [pedidoId]
    );
    if (desembaraco.rows[0]) {
      await query(
        `INSERT INTO itens_desembaraco (desembaraco_id, item_pedido_id, base_desembaraco)
         VALUES ($1, $2, 0)
         ON CONFLICT (desembaraco_id, item_pedido_id) DO NOTHING`,
        [desembaraco.rows[0].id, item.id]
      );
    }

    return item;
  },

  async atualizar(id, data) {
    const { rows } = await query(
      `UPDATE itens_pedido SET
         referencia = $2,
         descricao = $3,
         quantidade = $4,
         preco_usd = $5,
         ncm = $6,
         aliq_ii = $7,
         aliq_ipi = $8,
         aliq_pis = $9,
         aliq_cofins = $10,
         aliq_icms = $11,
         ordem = $12
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.referencia,
        data.descricao || null,
        data.quantidade || 0,
        data.preco_usd || 0,
        data.ncm || null,
        data.aliq_ii ?? 0.2,
        data.aliq_ipi ?? 0,
        data.aliq_pis ?? 0.021,
        data.aliq_cofins ?? 0.1025,
        data.aliq_icms ?? 0.04,
        data.ordem || 0,
      ]
    );
    return rows[0] || null;
  },

  async remover(id) {
    await query('DELETE FROM itens_pedido WHERE id = $1', [id]);
  },

  amountUsd(item) {
    return Number(item.quantidade || 0) * Number(item.preco_usd || 0);
  },
};

module.exports = ItemPedido;

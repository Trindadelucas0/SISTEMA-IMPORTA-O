const { query } = require('../config/db');

const TIPOS = ['fornecedor', 'desembaraco', 'frete', 'outro'];

const Pagamento = {
  tipos: TIPOS,

  async listar() {
    const { rows } = await query(
      `SELECT pg.*,
              COALESCE((
                SELECT SUM(a.valor_usd) FROM alocacoes a WHERE a.pagamento_id = pg.id
              ), 0) AS alocado_usd,
              COALESCE((
                SELECT SUM(a.valor_brl) FROM alocacoes a WHERE a.pagamento_id = pg.id
              ), 0) AS alocado_brl
       FROM pagamentos pg
       ORDER BY pg.data_pagamento ASC, pg.id ASC`
    );
    return rows.map((row) => ({
      ...row,
      disponivel_usd: Number(row.valor_usd || 0) - Number(row.alocado_usd || 0),
      disponivel_brl: Number(row.valor_brl || 0) - Number(row.alocado_brl || 0),
    }));
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM pagamentos WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async criar(data) {
    const valorUsd = Number(data.valor_usd) || 0;
    const dolarDia = Number(data.dolar_dia) || 0;
    let valorBrl = Number(data.valor_brl);
    if (!valorBrl && valorUsd && dolarDia) {
      valorBrl = valorUsd * dolarDia;
    }

    const { rows } = await query(
      `INSERT INTO pagamentos (pedido_id, data_pagamento, descricao, valor_brl, valor_usd, dolar_dia, tipo)
       VALUES (NULL, $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.data_pagamento,
        data.descricao,
        valorBrl || 0,
        valorUsd,
        dolarDia,
        data.tipo || 'fornecedor',
      ]
    );
    return rows[0];
  },

  async atualizar(id, data) {
    const valorUsd = Number(data.valor_usd) || 0;
    const dolarDia = Number(data.dolar_dia) || 0;
    let valorBrl = Number(data.valor_brl);
    if (!valorBrl && valorUsd && dolarDia) {
      valorBrl = valorUsd * dolarDia;
    }

    const { rows } = await query(
      `UPDATE pagamentos SET
         pedido_id = NULL,
         data_pagamento = $2,
         descricao = $3,
         valor_brl = $4,
         valor_usd = $5,
         dolar_dia = $6,
         tipo = $7
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.data_pagamento,
        data.descricao,
        valorBrl || 0,
        valorUsd,
        dolarDia,
        data.tipo || 'fornecedor',
      ]
    );
    return rows[0] || null;
  },

  async remover(id) {
    await query('DELETE FROM pagamentos WHERE id = $1', [id]);
  },
};

module.exports = Pagamento;

const { query } = require('../config/db');

const CAMPOS = [
  'nome',
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'inscricao_estadual',
  'pais',
  'email',
  'telefone',
  'contato',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'observacao',
  'ativo',
];

function valores(data) {
  return CAMPOS.map((c) => {
    if (c === 'ativo') return data.ativo;
    const v = data[c];
    if (v === undefined || v === null || v === '') return null;
    return v;
  });
}

const Fornecedor = {
  async listar() {
    const { rows } = await query(
      'SELECT * FROM fornecedores ORDER BY nome ASC'
    );
    return rows;
  },

  async listarAtivos() {
    const { rows } = await query(
      'SELECT * FROM fornecedores WHERE ativo = true ORDER BY nome ASC'
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM fornecedores WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByCnpj(cnpj) {
    if (!cnpj) return null;
    const { rows } = await query(
      'SELECT * FROM fornecedores WHERE cnpj = $1 LIMIT 1',
      [cnpj]
    );
    return rows[0] || null;
  },

  async criar(data) {
    const { rows } = await query(
      `INSERT INTO fornecedores (
         nome, cnpj, razao_social, nome_fantasia, inscricao_estadual,
         pais, email, telefone, contato,
         cep, logradouro, numero, complemento, bairro, cidade, uf,
         observacao, ativo
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,COALESCE($18, true)
       )
       RETURNING *`,
      valores(data)
    );
    return rows[0];
  },

  async atualizar(id, data) {
    const vals = valores(data);
    const { rows } = await query(
      `UPDATE fornecedores
       SET nome = $2,
           cnpj = $3,
           razao_social = $4,
           nome_fantasia = $5,
           inscricao_estadual = $6,
           pais = $7,
           email = $8,
           telefone = $9,
           contato = $10,
           cep = $11,
           logradouro = $12,
           numero = $13,
           complemento = $14,
           bairro = $15,
           cidade = $16,
           uf = $17,
           observacao = $18,
           ativo = $19,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, ...vals]
    );
    return rows[0] || null;
  },

  async remover(id) {
    await query('DELETE FROM fornecedores WHERE id = $1', [id]);
  },
};

module.exports = Fornecedor;

-- Schema: pedidos, pagamentos soltos, alocacoes, desembaraço

CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) UNIQUE NOT NULL,
  cnpj VARCHAR(14),
  razao_social VARCHAR(200),
  nome_fantasia VARCHAR(200),
  inscricao_estadual VARCHAR(30),
  pais VARCHAR(80),
  email VARCHAR(120),
  telefone VARCHAR(40),
  contato VARCHAR(200),
  cep VARCHAR(8),
  logradouro VARCHAR(200),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON fornecedores(ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores(nome);
-- idx_fornecedores_cnpj_unique fica em migrate_fornecedores_cnpj.sql
-- (em bases antigas a coluna cnpj só existe após a migration)

CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  fornecedor VARCHAR(100),
  fornecedor_id INT NULL REFERENCES fornecedores(id),
  status VARCHAR(30) NOT NULL DEFAULT 'aberta',
  observacao TEXT,
  data_inicio_fabricacao DATE NULL,
  data_prevista_chegada DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- idx_pedidos_fornecedor_id fica em migrate_fornecedores.sql
-- (em bases antigas a coluna só existe após a migration)

CREATE TABLE IF NOT EXISTS itens_pedido (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  referencia VARCHAR(80) NOT NULL,
  descricao TEXT,
  quantidade NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  preco_usd NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (preco_usd >= 0),
  ncm VARCHAR(20),
  aliq_ii NUMERIC(10, 6) NOT NULL DEFAULT 0.20,
  aliq_ipi NUMERIC(10, 6) NOT NULL DEFAULT 0,
  aliq_pis NUMERIC(10, 6) NOT NULL DEFAULT 0.021,
  aliq_cofins NUMERIC(10, 6) NOT NULL DEFAULT 0.1025,
  aliq_icms NUMERIC(10, 6) NOT NULL DEFAULT 0.04,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido ON itens_pedido(pedido_id);

CREATE TABLE IF NOT EXISTS pagamentos (
  id SERIAL PRIMARY KEY,
  pedido_id INT REFERENCES pedidos(id) ON DELETE SET NULL,
  data_pagamento DATE NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  valor_brl NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  dolar_dia NUMERIC(12, 6) NOT NULL DEFAULT 0,
  tipo VARCHAR(40) NOT NULL DEFAULT 'fornecedor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_pagamento, id);

CREATE TABLE IF NOT EXISTS alocacoes (
  id SERIAL PRIMARY KEY,
  pagamento_id INT NOT NULL REFERENCES pagamentos(id) ON DELETE CASCADE,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  valor_usd NUMERIC(14, 4) NOT NULL CHECK (valor_usd > 0),
  valor_brl NUMERIC(14, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alocacoes_pagamento ON alocacoes(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_pedido ON alocacoes(pedido_id);

CREATE TABLE IF NOT EXISTS desembaracos (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
  dolar_dia NUMERIC(12, 6) NOT NULL DEFAULT 0,
  custo_desembaraco_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  divisor_bc_icms NUMERIC(10, 6) NOT NULL DEFAULT 0.94,
  custo_total_atual NUMERIC(14, 2),
  custo_total_anterior NUMERIC(14, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_desembaraco (
  id SERIAL PRIMARY KEY,
  desembaraco_id INT NOT NULL REFERENCES desembaracos(id) ON DELETE CASCADE,
  item_pedido_id INT NOT NULL REFERENCES itens_pedido(id) ON DELETE CASCADE,
  base_desembaraco NUMERIC(14, 4) NOT NULL DEFAULT 0,
  UNIQUE (desembaraco_id, item_pedido_id)
);

CREATE INDEX IF NOT EXISTS idx_itens_desembaraco_desembaraco ON itens_desembaraco(desembaraco_id);

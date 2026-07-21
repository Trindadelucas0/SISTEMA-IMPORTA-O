-- Migration: alocacoes + dolar_dia em pagamentos
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS dolar_dia NUMERIC(12, 6) NOT NULL DEFAULT 0;
ALTER TABLE pagamentos ALTER COLUMN valor_usd SET DEFAULT 0;
UPDATE pagamentos SET valor_usd = 0 WHERE valor_usd IS NULL;
UPDATE pagamentos SET pedido_id = NULL;
UPDATE pagamentos SET tipo = 'fornecedor' WHERE tipo = 'china';

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

ALTER TABLE desembaracos ADD COLUMN IF NOT EXISTS custo_total_atual NUMERIC(14, 2);
ALTER TABLE desembaracos ADD COLUMN IF NOT EXISTS custo_total_anterior NUMERIC(14, 2);

-- Migration incremental (banco já existente)
ALTER TABLE desembaracos
  ADD COLUMN IF NOT EXISTS custo_total_atual NUMERIC(14, 2);

ALTER TABLE desembaracos
  ADD COLUMN IF NOT EXISTS custo_total_anterior NUMERIC(14, 2);

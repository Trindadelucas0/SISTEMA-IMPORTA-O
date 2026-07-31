-- Migration: datas de fabricação e prevista de chegada no pedido
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS data_inicio_fabricacao DATE NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS data_prevista_chegada DATE NULL;

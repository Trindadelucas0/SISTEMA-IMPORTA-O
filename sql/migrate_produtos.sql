-- Migration: catálogo de produtos
CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  codigo_interno VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(200) NOT NULL,
  ncm VARCHAR(20),
  preco_usd NUMERIC(14, 4) DEFAULT 0 CHECK (preco_usd >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

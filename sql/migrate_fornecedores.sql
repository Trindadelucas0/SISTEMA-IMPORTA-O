-- Migration: cadastro de fornecedores + vínculo em pedidos

CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) UNIQUE NOT NULL,
  pais VARCHAR(80),
  contato VARCHAR(200),
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON fornecedores(ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores(nome);

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS fornecedor_id INT NULL REFERENCES fornecedores(id);

-- Cria fornecedores a partir dos nomes texto já usados nos pedidos
INSERT INTO fornecedores (nome)
SELECT DISTINCT TRIM(p.fornecedor)
FROM pedidos p
WHERE p.fornecedor IS NOT NULL
  AND TRIM(p.fornecedor) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM fornecedores f WHERE LOWER(f.nome) = LOWER(TRIM(p.fornecedor))
  );

-- Vincula pedidos ao fornecedor correspondente
UPDATE pedidos p
SET fornecedor_id = f.id
FROM fornecedores f
WHERE p.fornecedor_id IS NULL
  AND p.fornecedor IS NOT NULL
  AND LOWER(TRIM(p.fornecedor)) = LOWER(f.nome);

CREATE INDEX IF NOT EXISTS idx_pedidos_fornecedor_id ON pedidos(fornecedor_id);

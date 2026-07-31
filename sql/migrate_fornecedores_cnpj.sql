-- Migration: dados cadastrais completos do fornecedor (CNPJ, endereço, contato)

ALTER TABLE fornecedores
  ALTER COLUMN nome TYPE VARCHAR(200);

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14),
  ADD COLUMN IF NOT EXISTS razao_social VARCHAR(200),
  ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(200),
  ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(30),
  ADD COLUMN IF NOT EXISTS email VARCHAR(120),
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(8),
  ADD COLUMN IF NOT EXISTS logradouro VARCHAR(200),
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS uf VARCHAR(2);

-- CNPJ único quando preenchido (fornecedor exterior pode ficar sem CNPJ)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_cnpj_unique
  ON fornecedores (cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

-- Auth: usuários, sessão única e permissões por aba
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'user')),
  permissoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_version INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios (username);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios (ativo);

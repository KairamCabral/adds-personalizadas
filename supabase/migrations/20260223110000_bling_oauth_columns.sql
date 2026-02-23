-- Migration: Adicionar colunas OAuth 2.0 para integração com Bling
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS bling_client_id TEXT,
  ADD COLUMN IF NOT EXISTS bling_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS bling_access_token TEXT,
  ADD COLUMN IF NOT EXISTS bling_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS bling_token_expires_at TIMESTAMPTZ;

-- Story 001: tabela de captura bruta de webhooks Tiny (Fase 0 — descoberta de payload)
-- Leitura: apenas MASTER via RLS. Escrita apenas pelo backend (service role).

CREATE TABLE tiny_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_ip TEXT,
  headers JSONB,
  payload JSONB NOT NULL,
  event_type TEXT,
  tiny_order_id BIGINT,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_tiny_webhook_events_received ON tiny_webhook_events(received_at DESC);
CREATE INDEX idx_tiny_webhook_events_order ON tiny_webhook_events(tiny_order_id);
CREATE INDEX idx_tiny_webhook_events_unprocessed ON tiny_webhook_events(processed, received_at) WHERE NOT processed;

ALTER TABLE tiny_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiny_webhook_events_master_read" ON tiny_webhook_events
  FOR SELECT USING (get_user_role() = 'MASTER');

COMMENT ON TABLE tiny_webhook_events IS 'Sniffer Fase 0: payloads brutos do Tiny para análise (service role grava; MASTER lê).';

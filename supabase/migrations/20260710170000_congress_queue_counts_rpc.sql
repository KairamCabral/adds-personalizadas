-- E7 (Story 7.1) — follow-up: contagens agregadas das filas de congressos num
-- único round-trip para a tela de saúde (/congressos/saude), substituindo os 9
-- COUNTs separados que o service fazia.
--
-- SECURITY INVOKER (não DEFINER): a RLS de tiny_contact_sync_jobs e
-- event_dispatches (SELECT só MASTER/GESTOR) já filtra — MASTER/GESTOR veem os
-- números reais; PRESTADOR/anon veem 0. Sem bypass, sem guard manual.
-- Aditivo e não consumido pelo rep-app.

CREATE OR REPLACE FUNCTION public.congress_queue_counts()
RETURNS TABLE(
  sync_pending int,
  sync_processing int,
  sync_failed int,
  sync_dead int,
  sync_done int,
  dispatch_pendente int,
  dispatch_enviado int,
  dispatch_falhou int,
  dispatch_cancelado int
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM tiny_contact_sync_jobs WHERE status = 'PENDING'),
    (SELECT count(*)::int FROM tiny_contact_sync_jobs WHERE status = 'PROCESSING'),
    (SELECT count(*)::int FROM tiny_contact_sync_jobs WHERE status = 'FAILED'),
    (SELECT count(*)::int FROM tiny_contact_sync_jobs WHERE status = 'DEAD'),
    (SELECT count(*)::int FROM tiny_contact_sync_jobs WHERE status = 'DONE'),
    (SELECT count(*)::int FROM event_dispatches WHERE status = 'PENDENTE'),
    (SELECT count(*)::int FROM event_dispatches WHERE status = 'ENVIADO'),
    (SELECT count(*)::int FROM event_dispatches WHERE status = 'FALHOU'),
    (SELECT count(*)::int FROM event_dispatches WHERE status = 'CANCELADO');
$$;

REVOKE EXECUTE ON FUNCTION public.congress_queue_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.congress_queue_counts() TO authenticated;

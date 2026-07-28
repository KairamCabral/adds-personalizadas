-- Começo limpo para o Lead na Meta CAPI.
--
-- A migration anterior (20260728120000) criou `meta_capi_sent_at` com NULL em
-- TODAS as linhas, inclusive as históricas. Como META_CAPI_ENABLED já está
-- ligado em produção (desde o rollout do Purchase), o primeiro cron varreria a
-- base inteira e mandaria cada orçamento antigo como Lead NOVO — 50 por dia,
-- do mais antigo para o mais recente, todos carimbados com a data de hoje.
-- Isso injetaria leads falsamente recentes na otimização das campanhas.
--
-- Mesma decisão tomada no rollout do Purchase: marca o histórico como enviado
-- para começar do zero. A diferença é que aqui preservamos os últimos 7 dias —
-- são leads legítimos e ainda dentro da janela que a Meta aceita para
-- `event_time` (eventos mais antigos que 7 dias são recusados).
update public.public_quotes
   set meta_capi_sent_at = now()
 where meta_capi_sent_at is null
   and created_at < now() - interval '7 days';

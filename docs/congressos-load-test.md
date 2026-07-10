# Congressos — Teste de carga do pico (E7 / Story 7.2, gate de go-live)

Roteiro para validar o pré-cadastro de congresso sob o pico esperado, **antes** do
evento. É o gate de go-live do Épico 7.

## Gates a provar

1. **Submit p95 < 1s** com baseline **≥ 300 cadastros/min** (NFR-SC1).
2. **A fila drena respeitando ~2 req/s do Tiny, sem perda de job** (NFR-SC2, NFR-R2).
3. **Registrar a decisão de go-live**: habilitar Upstash? frequência final dos crons?

## O que medir e por quê (mapa do código)

| Camada | Onde | Conta pro quê |
|---|---|---|
| Submit síncrono | `POST /api/congressos/register` — ~8 idas ao Postgres (lookup edição, dedup, `find_client_by_document`, insert registration, `createRedemption`, `ensureCredit`, `assign_raffle_number`, enfileira 2 jobs) | **p95 < 1s** (essencialmente latência de DB) |
| Fast-path `after()` | `syncRegistrationNow` (Tiny via throttle) + `sendCongressDispatchNow` (Resend) | Carga no Tiny/e-mail, **fora** do p95 |
| Drain (rede de segurança) | crons `congress-sync` / `congress-dispatch`, `BATCH_LIMIT=100`, backoff `[1,2,4,8,16]min` | Backlog + **sem perda** |

**Risco central (a razão do teste):** o throttle do Tiny
(`src/lib/tiny/rate-limiter.ts`, ~2 req/s) é **in-memory por instância serverless**.
Sob 300/min espalhados por N instâncias na Vercel, o fast-path `after()` pode
agregar **> 2 req/s**. O cron de drain é single-instance (respeita 2 req/s), mas o
fast-path multi-instância é o furo → é isso que decide o **Upstash** (limiter global
durável).

## Pré-requisitos

- **Rodar em preview/staging, NÃO em produção** — cada cadastro cria contato real no
  Tiny + e-mail real (Resend).
- **Edição de teste** com `turnstile_enabled = false` (break-glass → pula o captcha) e
  `is_active = true`. Anote o `slug`.
- Contornar os rate-limits do próprio route (senão o teste é barrado antes de medir):
  - `congress-doc:${digits}` = 5/min por documento → **gerar CPF válido único por
    request** (dígitos verificadores corretos, senão 400).
  - `congress-reg:${ip}` = 15 / 5min por IP → **variar `X-Forwarded-For` por request**
    (o route lê o 1º IP do header).

## Script k6

Ver `scripts/load/congressos-register.js`. Rodar:

```bash
BASE_URL=https://<preview>.vercel.app \
EDITION_SLUG=<slug-da-edicao-de-teste> \
RATE=300 DURATION=10m \
k6 run scripts/load/congressos-register.js
```

Suba `RATE` (450, 600, …) para achar o joelho onde o p95 estoura 1s ou aparece perda.

## Observar a fila (durante e depois)

Tela: **`/congressos/saude`** (near-live, cards de pendentes/mortos/falhos). E via SQL
(read-only) — troque `:ED` pelo `id` da edição de teste:

```sql
-- Profundidade/estado da fila (rodar repetido durante o teste)
select
  (select count(*) from tiny_contact_sync_jobs where status in ('PENDING','FAILED')) sync_pend,
  (select count(*) from tiny_contact_sync_jobs where status='DEAD')  sync_mortos,
  (select count(*) from event_dispatches       where status='PENDENTE') email_pend,
  (select count(*) from event_dispatches       where status='FALHOU')   email_falhos;

-- Sem perda de job: 1 sync job por cadastro (devem ser iguais)
select
  (select count(*) from event_registrations where edition_id = :ED) cadastros,
  (select count(*) from tiny_contact_sync_jobs j
     join event_registrations r on r.id = j.registration_id
   where r.edition_id = :ED) jobs;

-- Conformidade do throttle do Tiny (chamadas por segundo no pico)
select date_trunc('second', created_at) seg, count(*)
from tiny_sync_logs
where direction='crm_to_tiny' and entity_type='event_registration'
  and created_at > now() - interval '15 min'
group by 1 having count(*) > 2 order by 1;   -- linhas aqui = passou de 2/s (por instância)
```

## Critério de aprovação (gate)

- [ ] p95 do submit < 1s no pico sustentado (≥ 300/min).
- [ ] `cadastros == jobs` (zero perda). DEAD só por erro legítimo do Tiny, não por estouro.
- [ ] Sem 429 sustentado do Tiny; agregado ≤ ~2 req/s (ou plano de Upstash definido).
- [ ] Backlog drena em tempo aceitável na frequência de cron escolhida.

## Decisão de go-live (preencher com os números observados)

| Decisão | Critério | Valor observado | Escolha |
|---|---|---|---|
| Habilitar Upstash? | SIM se o agregado multi-instância passar de ~2 req/s, ou se precisar limiter/idempotência global | | |
| Frequência do cron `congress-sync` | Hoje **diário 07:00 UTC** — insuficiente na janela do evento | | ex.: a cada 1–2 min na janela |
| Frequência do cron `congress-dispatch` | Hoje **diário 08:00 UTC** | | ex.: a cada 1–2 min na janela |
| Rate suportado | maior `RATE` com p95 < 1s e sem perda | | |

> Hoje os crons de drain rodam **1×/dia**; no evento a entrega em tempo real depende do
> fast-path `after()`. Se o fast-path saturar o Tiny, o cron diário é rede de segurança
> **lenta demais**. A decisão mais provável do gate é **subir a frequência do cron na
> janela do evento** (`vercel.json`) e/ou **Upstash** para o throttle global.

## Limpeza pós-teste

Remover os cadastros de carga da edição de teste (cascade limpa jobs/dispatches/
redemptions/credits). Rodar em ambiente de teste, com a edição de teste:

```sql
delete from event_registrations
where edition_id = :ED and consent_version = 'loadtest-v1';
```

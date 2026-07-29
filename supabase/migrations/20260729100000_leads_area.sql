-- Área de Leads: contatos que deixaram o WhatsApp no quiz mas ainda não viraram
-- orçamento nem pedido.
--
-- Por que tabela própria e não public_quotes: um orçamento tem produtos e valor;
-- um lead tem só um telefone e um potencial. Enfiar lead ali quebrava as colunas
-- da tabela (produtos "—", valor "—"), competia no contador de pendentes e
-- forçava gravar o telefone no campo client_name.
--
-- Por que não rep_prospects: aquela tabela é o funil de um representante
-- (rep_id NOT NULL, position para o kanban de cada rep). Lead do quiz chega sem
-- dono e é trabalhado pelo time interno.

-- ═══════════════════════════════════════════════════════════════════════════
-- Status
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type public.lead_status as enum ('NOVO', 'CONTATADO', 'CONVERTIDO', 'DESCARTADO');
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Tabela
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  -- Sempre dígitos com DDI (5548999998888). Normalizar na escrita evita ter de
  -- normalizar em toda leitura e comparação.
  phone text not null,

  -- Preenchidos por enriquecimento, nunca digitados no quiz.
  name text,
  email text,

  -- Origem
  source text not null default 'quiz',
  lead_ref text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- Vínculo com Contatos (tabela clients). Resolvido pelo telefone.
  client_id uuid references public.clients(id) on delete set null,

  -- Trabalho do time
  status public.lead_status not null default 'NOVO',
  contacted_at timestamptz,
  contacted_by uuid references public.profiles(id) on delete set null,
  notes text,

  -- Recorrência: mesma pessoa preenchendo de novo NÃO vira linha duplicada.
  -- Vira sinal — quem volta é o lead mais quente da lista.
  submissions integer not null default 1,
  last_submitted_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um lead por telefone. É o que permite o upsert que incrementa `submissions`
-- em vez de duplicar.
create unique index if not exists idx_leads_phone on public.leads (phone);

-- A lista abre ordenada por chegada e filtrada por período.
create index if not exists idx_leads_created_at on public.leads (created_at desc);

-- "Quem eu ligo agora?" é a pergunta principal da tela; este índice a responde.
create index if not exists idx_leads_status_novo
  on public.leads (created_at desc)
  where status = 'NOVO';

comment on table public.leads is
  'Leads do quiz (protocolo.addsbrasil.com.br). Só telefone na entrada; nome e e-mail vêm do cruzamento com clients.';
comment on column public.leads.phone is
  'Dígitos com DDI, sem formatação. Chave de deduplicação e de cruzamento com clients.';
comment on column public.leads.submissions is
  'Quantas vezes este telefone foi enviado. >1 indica intenção alta.';

-- ═══════════════════════════════════════════════════════════════════════════
-- updated_at
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.leads_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_leads_touch_updated_at on public.leads;
create trigger trg_leads_touch_updated_at
  before update on public.leads
  for each row execute function public.leads_touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Cruzamento com Contatos
-- ═══════════════════════════════════════════════════════════════════════════
-- `clients.phone` é digitado por humanos e vem em vários formatos. Este índice
-- funcional permite casar por dígitos sem varrer a tabela inteira a cada leitura.
create index if not exists idx_clients_phone_digits
  on public.clients ((regexp_replace(coalesce(phone, ''), '\D', '', 'g')))
  where phone is not null;

/**
 * Acha o cliente correspondente a um telefone de lead.
 *
 * Compara pelos últimos 10 ou 11 dígitos em vez do número inteiro: o lead chega
 * com DDI (5548...) e o contato pode estar cadastrado sem ele (48...). Comparar
 * a string completa perderia justamente os casos que mais importam.
 */
create or replace function public.find_client_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with alvo as (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digitos
  )
  select c.id
    from public.clients c, alvo
   where alvo.digitos <> ''
     and length(alvo.digitos) >= 10
     and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = right(alvo.digitos, 10)
   order by c.updated_at desc
   limit 1;
$$;

comment on function public.find_client_by_phone is
  'Casa um telefone de lead com um contato existente pelos últimos 10 dígitos (o lead traz DDI, o contato pode não trazer).';

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.leads enable row level security;

-- Leads são trabalhados pelo time interno. REPRESENTANTE fica de fora: o funil
-- dele é rep_prospects.
drop policy if exists leads_manage on public.leads;
create policy leads_manage on public.leads for all
  using (get_user_role() = any (array['MASTER','GESTOR','PRESTADOR']::user_role[]))
  with check (get_user_role() = any (array['MASTER','GESTOR','PRESTADOR']::user_role[]));

-- ═══════════════════════════════════════════════════════════════════════════
-- Migra o que já entrou como orçamento
-- ═══════════════════════════════════════════════════════════════════════════
-- Os leads do quiz gravados antes desta área existir foram para public_quotes
-- com utm_source='quiz' e o telefone no lugar do nome. Traz para cá e remove de
-- lá, para a lista de orçamentos voltar a ter só orçamento de verdade.
insert into public.leads (phone, source, lead_ref, utm_source, utm_medium, utm_campaign, created_at, last_submitted_at)
select
  regexp_replace(coalesce(q.client_whatsapp, q.client_phone, ''), '\D', '', 'g'),
  'quiz',
  substring(q.internal_notes from 'Ref ([a-z0-9]{6})'),
  q.utm_source,
  q.utm_medium,
  q.utm_campaign,
  q.created_at,
  q.created_at
from public.public_quotes q
where q.utm_source = 'quiz'
  and length(regexp_replace(coalesce(q.client_whatsapp, q.client_phone, ''), '\D', '', 'g')) >= 10
on conflict (phone) do nothing;

delete from public.public_quotes where utm_source = 'quiz';

-- Vincula os migrados a contatos já existentes.
update public.leads l
   set client_id = public.find_client_by_phone(l.phone)
 where l.client_id is null;

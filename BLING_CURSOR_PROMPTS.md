# ADDS CRM — Prompts Cursor Agent: Integração Bling + Termo de Uso

## CONTEXTO (cole isso uma vez no início da sessão)

```
Leia o arquivo BLING_ARCHITECTURE.md na raiz do projeto antes de começar qualquer etapa.
Esse documento contém a arquitetura completa da integração com o Bling ERP do nosso fornecedor.

Resumo: A ADDS tem um fornecedor que usa Bling ERP. Quando um pedido vai para produção,
dados PARCIAIS do cliente são enviados ao Bling do fornecedor. O fornecedor precisa assinar
um Termo de Uso digital antes de receber qualquer dado. Tudo é auditado.

Stack do projeto: Next.js 15 App Router, TypeScript, Supabase, Tailwind, shadcn/ui.
Paleta: azul #21add6, laranja #f07d00, navy #0b4269.
Idioma do UI: português brasileiro.
```

---

## ETAPA B1 — BANCO DE DADOS + TYPES

```
Crie as tabelas e políticas no Supabase para a integração Bling com fornecedor.

### 1. Nova migration SQL

Crie `supabase/migrations/00002_suppliers_bling.sql` com:

-- Tabela suppliers (fornecedores com integração Bling)
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  bling_api_token TEXT,
  bling_base_url TEXT DEFAULT 'https://api.bling.com.br/Api/v3',
  shared_fields JSONB NOT NULL DEFAULT '{
    "client_name": true,
    "client_phone": true,
    "client_city": true,
    "client_state": true,
    "client_zip_code": true,
    "order_products": true,
    "order_quantities": true,
    "order_personalization": true,
    "order_due_date": true
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela supplier_agreements (termos de uso)
CREATE TABLE supplier_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ NOT NULL,
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  signer_role TEXT,
  signer_document TEXT,
  signer_ip INET,
  signer_user_agent TEXT,
  agreement_version TEXT NOT NULL DEFAULT '1.0',
  agreement_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revocation_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreements_token ON supplier_agreements(token);
CREATE INDEX idx_agreements_supplier ON supplier_agreements(supplier_id);

-- Tabela supplier_data_logs (auditoria de dados enviados)
CREATE TABLE supplier_data_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  client_id UUID REFERENCES clients(id),
  data_sent JSONB NOT NULL,
  fields_sent TEXT[] NOT NULL,
  bling_contact_id BIGINT,
  bling_response JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_logs_supplier ON supplier_data_logs(supplier_id);
CREATE INDEX idx_data_logs_order ON supplier_data_logs(order_id);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_data_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_admin" ON suppliers FOR ALL
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "agreements_admin" ON supplier_agreements FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "agreements_insert" ON supplier_agreements FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "agreements_public_update" ON supplier_agreements FOR UPDATE
  USING (true);
CREATE POLICY "data_logs_admin" ON supplier_data_logs FOR ALL
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Trigger
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime para logs
ALTER PUBLICATION supabase_realtime ADD TABLE supplier_data_logs;

### 2. Atualizar types

Regenere os types ou adicione manualmente em `src/types/database.types.ts`:
- Supplier type
- SupplierAgreement type
- SupplierDataLog type

### 3. Adicionar .env

Adicione ao `.env.example`:
# Bling ERP (Fornecedor)
BLING_API_TOKEN=
BLING_API_URL=https://api.bling.com.br/Api/v3

### 4. Adicionar permissões

Em `src/lib/permissions.ts`, adicione:
- 'suppliers.view': ['MASTER', 'GESTOR']
- 'suppliers.manage': ['MASTER']
- 'suppliers.send_data': ['MASTER', 'GESTOR']
- 'suppliers.revoke': ['MASTER']

Execute `pnpm build` ao final.
```

---

## ETAPA B2 — SERVICES (Bling + Suppliers + Agreements)

```
Crie os 3 services para a integração Bling.

### 1. `src/services/suppliers.service.ts`

CRUD de fornecedores:
- getSuppliers() — lista todos
- getSupplierById(id) — com agreements e últimos 20 logs
- createSupplier(data) — cria com is_active=false
- updateSupplier(id, data) — atualizar dados e campos compartilhados
- deactivateSupplier(id, reason) — desativa e registra motivo
- activateSupplier(id) — só se tem termo assinado válido

### 2. `src/services/agreements.service.ts`

Gestão de termos de uso:
- generateAgreementToken(supplierId, expiresInDays=7) — cria um novo token para assinatura
- validateAgreementToken(token) — retorna { is_valid, agreement, supplier }
- signAgreement(token, data) — registra assinatura (nome, cargo, CPF, IP, user-agent)
  - Após assinar: atualiza supplier.is_active=true e supplier.activated_at
  - Gera hash SHA-256 do conteúdo do termo e salva em agreement_hash
- revokeAgreement(agreementId, reason) — revoga o termo
  - Desativa o supplier automaticamente
- getActiveAgreement(supplierId) — retorna o termo ativo mais recente
- hasValidAgreement(supplierId) — retorna boolean (há termo assinado e não revogado?)

### 3. `src/services/bling.service.ts`

Integração com a API do Bling:
- testConnection(apiToken) — testa se o token funciona (GET /contatos?limite=1)
- sendClientToBling(supplierId, orderId) — o método principal:
  1. Busca o supplier e verifica: is_active? tem termo assinado?
  2. Se não: lança erro "Integração bloqueada — termo não assinado"
  3. Busca o pedido com client e items
  4. Lê supplier.shared_fields para saber quais campos enviar
  5. Monta o payload APENAS com os campos permitidos:
     - client_name → nome
     - client_phone → telefone
     - client_city → endereco.municipio
     - client_state → endereco.uf
     - client_zip_code → endereco.cep
  6. POST /contatos no Bling
  7. Registra tudo em supplier_data_logs (data_sent, fields_sent, bling_response)
  8. Retorna sucesso ou erro
- getDataLogs(supplierId, page) — busca logs paginados

IMPORTANTE sobre o payload: Crie uma função `buildBlingPayload(client, order, sharedFields)` que:
- Itera sobre sharedFields
- Para cada campo true, adiciona ao payload
- Para cada campo false, NÃO inclui
- Retorna TAMBÉM a lista de fields_sent para o log
- NUNCA inclua: document (CPF/CNPJ), email, street, number, complement, notes, logo_url, valores/preços

Para a chamada HTTP ao Bling, use fetch com:
- Header: Authorization: Bearer {token}
- Content-Type: application/json
- Base URL do supplier.bling_base_url

Execute `pnpm build` ao final.
```

---

## ETAPA B3 — PÁGINA PÚBLICA DO TERMO DE USO

```
Crie a página pública onde o fornecedor assina o Termo de Uso. Essa página não requer login.

### 1. Rota: `src/app/(public)/supplier/agreement/[token]/page.tsx`

Server Component que:
- Recebe o token da URL
- Valida via agreements.service.validateAgreementToken(token)
- Se inválido/expirado: mostra mensagem de erro com visual profissional
- Se já assinado: mostra mensagem "Termo já foi assinado em {data}" com os dados
- Se válido: renderiza o formulário de assinatura

### 2. `_components/agreement-content.tsx`

Conteúdo completo do termo. Crie o texto em `src/lib/agreement-template.ts` com as cláusulas:

TERMO DE CONFIDENCIALIDADE E USO DE DADOS

CLÁUSULA 1 — OBJETO
O presente termo regula o compartilhamento de dados de clientes da ADDS Brasil LTDA ("ADDS") com o FORNECEDOR para fins exclusivos de execução de pedidos de produção.

CLÁUSULA 2 — DADOS COMPARTILHADOS
Serão compartilhados exclusivamente: nome do cliente, telefone, cidade, estado, CEP, produtos do pedido, quantidades, dados de personalização e prazo de entrega. Nenhum outro dado será fornecido.

CLÁUSULA 3 — RESTRIÇÕES DE USO
O FORNECEDOR se compromete a:
a) Utilizar os dados exclusivamente para execução dos pedidos da ADDS
b) Não copiar, armazenar ou transferir dados para sistemas não autorizados
c) Não compartilhar dados com terceiros sob nenhuma hipótese
d) Não utilizar dados para prospecção comercial, marketing ou qualquer fim que não a execução do pedido
e) Excluir os dados do cliente após a conclusão e entrega do pedido

CLÁUSULA 4 — LGPD
O FORNECEDOR reconhece que os dados compartilhados são protegidos pela Lei Geral de Proteção de Dados (Lei 13.709/2018) e compromete-se a tratá-los conforme a legislação vigente.

CLÁUSULA 5 — AUDITORIA
A ADDS reserva-se o direito de auditar o uso dos dados compartilhados a qualquer momento, e o FORNECEDOR compromete-se a colaborar integralmente.

CLÁUSULA 6 — REVOGAÇÃO
A ADDS pode revogar o acesso aos dados a qualquer momento, sem necessidade de aviso prévio ou justificativa.

CLÁUSULA 7 — PENALIDADES
O descumprimento de qualquer cláusula deste termo sujeitará o FORNECEDOR a:
a) Rescisão imediata da relação comercial
b) Responsabilização civil e criminal conforme legislação aplicável
c) Multa de R$ 50.000,00 (cinquenta mil reais) por infração

CLÁUSULA 8 — VIGÊNCIA
Este termo entra em vigor na data da assinatura e permanece válido enquanto a relação comercial entre as partes estiver ativa.

O componente deve renderizar esse texto com formatação profissional:
- Título em negrito, tamanho grande
- Cláusulas numeradas com destaque no título
- Subcláusulas com letras (a, b, c)
- Scroll container com altura fixa para o conteúdo
- Borda e fundo clean (branco, tipografia séria)

### 3. `_components/signature-form.tsx`

Formulário ABAIXO do termo com:
- Checkbox: "Li e concordo com todos os termos acima" (obrigatório)
- Input: Nome completo do signatário
- Input: Cargo/função
- Input: CPF (com máscara, validação)
- Botão: "Assinar Termo" — azul, com ícone de check
- Ao clicar:
  1. Captura IP via fetch('https://api.ipify.org?format=json') (ou header da request)
  2. Captura user-agent do navigator
  3. Chama signAgreement(token, { name, role, document, ip, userAgent })
  4. Toast de sucesso
  5. Mostra tela de confirmação com: "Termo assinado com sucesso", data, nome, hash
  6. Não permite assinar novamente

### 4. Visual da página

- Layout limpo, profissional, fundo branco com sombra central
- Logo ADDS no topo
- Nome do fornecedor em destaque
- Nenhum elemento de navegação — é uma página standalone
- Responsivo (funcionar em celular)

### 5. Middleware

Confirme que `/supplier/agreement` está nas rotas públicas do middleware.

Execute `pnpm build` ao final.
```

---

## ETAPA B4 — PAINEL DE FORNECEDORES (Settings)

```
Crie a página de gestão de fornecedores dentro de Configurações.

### 1. Adicionar na navegação

Em `src/app/(dashboard)/settings/`, adicione a rota `suppliers/page.tsx`.
Adicione "Fornecedores" no menu lateral de settings (depois de "Integrações").
Só visível para MASTER (usar permissão 'suppliers.manage').

### 2. `src/app/(dashboard)/settings/suppliers/page.tsx`

Página principal com:
- Header: "Fornecedores" + botão "Novo Fornecedor"
- Lista/tabela de fornecedores com colunas:
  - Nome | Contato | Status (ativo/inativo) | Termo | Última Sync | Ações
- Status com badge: verde = ativo, vermelho = inativo, amarelo = pendente termo
- Ações: Ver | Editar | Desativar | Revogar Termo

### 3. `_components/supplier-form.tsx`

Dialog/Sheet de criação e edição:
- Nome do fornecedor
- Nome do contato
- E-mail do contato
- Telefone do contato
- Token API do Bling
- Botão "Testar Conexão" que chama bling.service.testConnection()
  - Sucesso: badge verde "Conexão OK"
  - Erro: badge vermelho com mensagem

### 4. `_components/supplier-detail.tsx`

Página ou Sheet de detalhe do fornecedor com 3 abas:

**Aba: Configuração**
- Dados do fornecedor (editável)
- Token Bling (editável, com botão testar)
- shared-fields-config (ver abaixo)

**Aba: Termo de Uso**
- Status atual: "Assinado em DD/MM/YYYY por Fulano" ou "Pendente" ou "Revogado"
- Se não tem termo: botão "Gerar Link de Assinatura"
  - Gera token e mostra URL copiável: {APP_URL}/supplier/agreement/{token}
  - Opção de enviar por e-mail automaticamente
- Se tem termo assinado: mostrar dados (nome, cargo, CPF, IP, data, hash)
  - Botão "Revogar Termo" (com confirmação e campo de motivo)
- Se revogado: mostrar motivo e quem revogou

**Aba: Log de Envios**
- Tabela com: data, pedido, cliente (nome apenas), campos enviados, status, resposta Bling
- Paginação
- Filtro por status (sucesso/erro)

### 5. `_components/shared-fields-config.tsx`

Componente de configuração dos campos compartilhados:
- Lista de todos os campos possíveis com switch/toggle para cada:
  - ✅ Nome do cliente
  - ✅ Telefone
  - ✅ Cidade
  - ✅ Estado (UF)
  - ✅ CEP
  - ✅ Produtos do pedido
  - ✅ Quantidades
  - ✅ Personalização
  - ✅ Prazo de entrega
- Cada toggle atualiza supplier.shared_fields no Supabase
- Alerta visual: "Atenção: campos desativados NÃO serão enviados ao fornecedor"

### 6. `_components/agreement-status.tsx`

Badge/card reutilizável mostrando o status do termo:
- 🟢 "Termo assinado" — com data
- 🟡 "Aguardando assinatura" — com link copiável
- 🔴 "Sem termo / Revogado" — integração bloqueada
- Se bloqueado: mensagem "Integração inativa — é necessário um termo assinado para enviar dados"

Execute `pnpm build` ao final.
```

---

## ETAPA B5 — TRIGGER AUTOMÁTICO NO KANBAN

```
Integre o envio automático ao Bling quando um pedido muda para PRODUCAO.

### 1. No order-detail-sheet ou na lógica de mudança de status

Quando o status de um pedido muda para 'PRODUCAO':

1. Verificar se existe pelo menos 1 supplier ativo
2. Se sim, para cada supplier ativo:
   a. Chamar bling.service.sendClientToBling(supplierId, orderId)
   b. Se sucesso: toast "Dados enviados ao fornecedor {nome}"
   c. Se erro (termo não assinado): toast warning "Integração com {nome} bloqueada — termo pendente"
   d. Se erro (API Bling): toast error com mensagem

### 2. Adicione também um botão manual

No order-detail-sheet, na aba "Detalhes", quando o pedido está em PRODUCAO ou após:
- Botão "Enviar ao Fornecedor" (ícone de send)
- Só visível para MASTER/GESTOR
- Abre um dropdown com os fornecedores ativos
- Ao clicar no fornecedor: chama sendClientToBling
- Mostra loading e feedback

### 3. Indicador visual no card do Kanban

Se o pedido já teve dados enviados a um fornecedor (supplier_data_logs tem registro):
- Mostrar um pequeno ícone/badge no kanban-card (ex: ícone de "link" ou "truck")
- Tooltip: "Dados enviados a Fornecedor X em DD/MM"

### 4. Proteção

NUNCA enviar dados se:
- supplier.is_active === false
- Não existe supplier_agreements com status 'signed' para o supplier
- O pedido não tem client_id (sem cliente vinculado)

Cada envio SEMPRE registra em supplier_data_logs — sucesso ou erro.

Execute `pnpm build` ao final.
```

---

## RESUMO DAS ETAPAS

```
ETAPA B1: Banco de dados + types + permissões       (~30 min)
    │
ETAPA B2: Services (suppliers, agreements, bling)    (~45 min)
    │
ETAPA B3: Página pública do Termo de Uso             (~45 min)
    │
ETAPA B4: Painel de fornecedores em Settings         (~60 min)
    │
ETAPA B5: Trigger automático + botão manual          (~30 min)
    │
    ▼
✅ Integração Bling completa com proteção jurídica
```

Cada etapa depende da anterior. Sempre `pnpm build` ao final.

---

## NOTAS PARA O CURSOR

- Nunca inclua CPF/CNPJ, email, endereço completo, valores no payload do Bling
- O campo shared_fields do supplier controla dinamicamente o que é enviado
- A tabela supplier_data_logs é a auditoria — SEMPRE registrar
- O termo é assinado FORA do sistema (link público) — não requer login
- Sem termo assinado = integração 100% bloqueada, sem exceção

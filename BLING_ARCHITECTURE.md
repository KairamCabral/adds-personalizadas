# ADDS CRM — Integração Bling (Fornecedor) + Termo de Uso

## CONTEXTO DO NEGÓCIO

A ADDS tem um fornecedor que usa o **Bling ERP** como sistema. Quando um pedido é aprovado
no ADDS CRM, parte dos dados do cliente precisa ser enviada automaticamente para o Bling
do fornecedor — para que ele consiga produzir e despachar sem que a ADDS precise repassar
manualmente.

**Regra crítica:** NEM TODOS os dados do cliente devem ser compartilhados. O fornecedor
recebe apenas o mínimo necessário para produção/expedição. Dados sensíveis (CPF/CNPJ,
e-mail completo, histórico de pedidos, valores) ficam protegidos no ADDS CRM.

**Regra jurídica:** O fornecedor DEVE assinar um Termo de Uso/Confidencialidade digital
ANTES de receber qualquer dado. Sem assinatura → integração bloqueada.

---

## 1. DADOS QUE VÃO PARA O BLING (whitelist)

### ✅ ENVIA (mínimo para produção/expedição)
| Campo | Motivo |
|-------|--------|
| Nome do cliente | Identificação no pedido |
| Telefone | Contato para entrega |
| Cidade | Logística |
| Estado (UF) | Logística |
| CEP | Cálculo de frete/expedição |
| Produtos do pedido | O que produzir |
| Quantidade | Quanto produzir |
| Personalização | Dados de arte/impressão |
| Prazo de entrega | Deadline de produção |

### ❌ NÃO ENVIA (protegido)
| Campo | Motivo |
|-------|--------|
| CPF / CNPJ | Dado sensível (LGPD) |
| E-mail | Canal direto — evitar contato sem autorização |
| Endereço completo (rua, número) | Só CEP + cidade + UF para logística |
| Valor do pedido / preços | Informação comercial da ADDS |
| Histórico de pedidos | Inteligência de negócio da ADDS |
| Logo do cliente | Propriedade do cliente |
| Observações internas | Dados internos da ADDS |

---

## 2. FLUXO DA INTEGRAÇÃO

```
┌─────────────────────────────────────────────────┐
│  1. ADDS configura integração Bling             │
│     → Salva token API do Bling do fornecedor    │
│     → Define quais campos compartilhar          │
│     → Cadastra dados do fornecedor              │
│                                                  │
│  2. FORNECEDOR assina Termo de Uso              │
│     → Recebe link único por e-mail              │
│     → Lê o termo completo                       │
│     → Informa nome, cargo, CPF                  │
│     → Assina digitalmente (checkbox + IP + data) │
│     → Termo fica registrado com hash            │
│                                                  │
│  3. INTEGRAÇÃO ATIVADA                          │
│     → Só após assinatura do termo               │
│     → ADDS pode enviar dados ao Bling           │
│                                                  │
│  4. PEDIDO APROVADO no Kanban                   │
│     → Status muda para PRODUCAO                 │
│     → Sistema verifica: termo assinado?          │
│     → Se sim: envia dados filtrados ao Bling     │
│     → Se não: notifica que integração bloqueada  │
│                                                  │
│  5. AUDITORIA                                   │
│     → Cada envio registrado: o quê, quando, para │
│     → ADDS pode revogar acesso a qualquer momento│
└─────────────────────────────────────────────────┘
```

---

## 3. MODELO DE DADOS (novas tabelas)

```sql
-- Fornecedores com integração Bling
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "Fornecedor XYZ"
  contact_name TEXT,                     -- Pessoa de contato
  contact_email TEXT,                    -- Email do fornecedor
  contact_phone TEXT,
  -- Bling config
  bling_api_token TEXT,                  -- Token da API Bling do fornecedor
  bling_base_url TEXT DEFAULT 'https://api.bling.com.br/Api/v3',
  -- Controle de campos compartilhados
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
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false,  -- Só ativa após termo assinado
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Termos de uso assinados
CREATE TABLE supplier_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  -- Token único para link de assinatura
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ NOT NULL,
  -- Dados da assinatura
  signed_at TIMESTAMPTZ,
  signer_name TEXT,                      -- Nome de quem assinou
  signer_role TEXT,                      -- Cargo
  signer_document TEXT,                  -- CPF de quem assinou
  signer_ip INET,                        -- IP no momento da assinatura
  signer_user_agent TEXT,                -- Navegador
  -- Conteúdo do termo
  agreement_version TEXT NOT NULL DEFAULT '1.0',
  agreement_hash TEXT,                   -- SHA-256 do conteúdo do termo
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, signed, expired, revoked
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revocation_reason TEXT,
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreements_token ON supplier_agreements(token);
CREATE INDEX idx_agreements_supplier ON supplier_agreements(supplier_id);

-- Log de dados enviados ao fornecedor
CREATE TABLE supplier_data_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  client_id UUID REFERENCES clients(id),
  -- O que foi enviado (snapshot dos dados exatos)
  data_sent JSONB NOT NULL,              -- Registro exato do que foi compartilhado
  fields_sent TEXT[] NOT NULL,           -- Lista dos campos enviados
  -- Resposta do Bling
  bling_contact_id BIGINT,              -- ID do contato criado no Bling
  bling_response JSONB,                 -- Resposta completa da API
  -- Status
  status TEXT NOT NULL DEFAULT 'success', -- success, error, revoked
  error_message TEXT,
  -- Metadata
  sent_by UUID REFERENCES profiles(id), -- Quem disparou (ou 'system')
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
CREATE POLICY "agreements_admin" ON supplier_agreements FOR ALL
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "agreements_public_sign" ON supplier_agreements FOR UPDATE
  USING (true); -- Permite assinatura pública via token
CREATE POLICY "data_logs_admin" ON supplier_data_logs FOR ALL
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Trigger updated_at
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 4. CONTEÚDO DO TERMO DE USO

O termo deve cobrir estes pontos:
- Dados são propriedade dos clientes da ADDS Brasil
- Fornecedor recebe dados EXCLUSIVAMENTE para execução do pedido
- PROIBIDO: copiar, armazenar além do necessário, compartilhar com terceiros, usar para marketing
- ADDS pode revogar acesso a qualquer momento sem aviso prévio
- Fornecedor deve excluir dados após conclusão do pedido
- Penalidades em caso de descumprimento
- Conformidade com LGPD (Lei 13.709/2018)
- Vigência e renovação

---

## 5. BLING API V3 — REFERÊNCIA

**Base URL:** `https://api.bling.com.br/Api/v3`
**Auth:** Bearer token (OAuth2 ou API Key)
**Docs:** https://developer.bling.com.br/

### Criar contato no Bling
```
POST /contatos
{
  "nome": "Nome do Cliente",
  "tipo": "F",  // F = Física, J = Jurídica
  "telefone": "(11) 99999-9999",
  "endereco": {
    "municipio": "São Paulo",
    "uf": "SP",
    "cep": "01000-000"
  }
}
```

### Consultar contato
```
GET /contatos/{id}
```

---

## 6. ESTRUTURA DE ARQUIVOS

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── settings/
│   │       └── suppliers/
│   │           ├── page.tsx              -- Gestão de fornecedores
│   │           └── _components/
│   │               ├── supplier-form.tsx  -- Cadastro/edição
│   │               ├── supplier-list.tsx  -- Lista
│   │               ├── supplier-detail.tsx-- Detalhe com logs
│   │               ├── shared-fields-config.tsx -- Toggle de campos
│   │               └── agreement-status.tsx -- Status do termo
│   │
│   ├── (public)/
│   │   └── supplier/
│   │       └── agreement/
│   │           └── [token]/
│   │               ├── page.tsx          -- Página pública do termo
│   │               └── _components/
│   │                   ├── agreement-content.tsx -- Texto do termo
│   │                   └── signature-form.tsx    -- Form de assinatura
│   │
│   └── api/
│       └── bling/
│           ├── sync/route.ts             -- Endpoint para enviar dados
│           └── test/route.ts             -- Testar conexão
│
├── services/
│   ├── suppliers.service.ts              -- CRUD fornecedores
│   ├── agreements.service.ts             -- Termos de uso
│   └── bling.service.ts                  -- API do Bling
│
└── lib/
    └── agreement-template.ts             -- Conteúdo do termo
```

---

## Documentos relacionados

- [docs/USERS_AND_PERMISSIONS.md](docs/USERS_AND_PERMISSIONS.md) — Usuários, roles e permissões do sistema

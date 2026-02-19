# Usuários e Permissões — ADDS CRM

## Visão geral

O sistema utiliza **Supabase Auth** para autenticação e a tabela `profiles` para perfis e funções (roles). O fluxo de criação de usuários é acionado por um trigger no banco de dados.

---

## Fluxo de criação de usuário

1. **Admin** cria usuário via Configurações → Usuários → Convidar usuário (ou via API `POST /api/users/create`).
2. A API usa `createAdminClient()` e chama `admin.auth.admin.createUser()` com:
   - `email`, `password`, `email_confirm: true`
   - `user_metadata: { full_name, role }`
3. O Supabase insere em `auth.users`.
4. O trigger `on_auth_user_created` executa a função `handle_new_user()`.
5. `handle_new_user` insere em `profiles`:
   - `id` = `NEW.id` (auth.users)
   - `full_name` = `raw_user_meta_data.full_name` ou `email`
   - `email` = `NEW.email`
   - `role` = `raw_user_meta_data.role` ou `'PRESTADOR'`

Referência: `supabase/migrations/00001_full_schema.sql` (linhas 442–459).

---

## Roles e permissões

| Role | Descrição |
|------|-----------|
| **MASTER** | Acesso total ao sistema |
| **GESTOR** | Gerente operacional |
| **PRESTADOR** | Colaborador com acesso limitado |

O mapeamento completo de permissões está em `src/lib/permissions.ts`. Resumo:

| Permissão | MASTER | GESTOR | PRESTADOR |
|-----------|--------|--------|-----------|
| settings.users | ✓ | ✓ | — |
| settings.manage_master | ✓ | — | — |
| settings.security | ✓ | — | — |
| orders.create | ✓ | ✓ | — |
| clients.view | ✓ | ✓ | — |
| suppliers.manage | ✓ | — | — |
| audit.view | ✓ | — | — |
| kanban.view | ✓ | ✓ | ✓ |
| orders.edit | ✓ | ✓ | ✓ |

---

## Menu de Configurações (submenu)

Cada item do submenu de Configurações exige uma permissão específica:

| Item | Permissão | MASTER | GESTOR | PRESTADOR |
|------|-----------|--------|--------|-----------|
| Produtos | products.manage | ✓ | ✓ | — |
| Kanban | labels.manage | ✓ | ✓ | — |
| Usuários | settings.users | ✓ | ✓ | — |
| Etiquetas | labels.manage | ✓ | ✓ | — |
| Notificações | notifications.manage | ✓ | ✓ | — |
| Sistema | settings.view | ✓ | ✓ | — |
| Segurança | settings.security | ✓ | — | — |
| Integrações | integrations.manage | ✓ | ✓ | — |
| Fornecedores | suppliers.manage | ✓ | — | — |
| Backup | backup.manage | ✓ | — | — |

---

## Comportamento do PRESTADOR

- **Pipeline:** Vê todos os pedidos (como GESTOR), pode editar e alterar status.
- **Ações restritas:** Não cria pedidos, não deleta pedidos, não atribui responsáveis.
- **Menu:** Acessa apenas Pipeline (kanban.view). Não vê Dashboard, Contatos, Orçamentos, Tiny ERP nem Configurações.
- **Clientes:** Leitura permitida para exibir nome/logo nos cards do pipeline.

---

## Regras de convite e edição

### Criar usuário

| Quem cria | Pode criar GESTOR | Pode criar PRESTADOR | Pode criar MASTER |
|-----------|-------------------|----------------------|-------------------|
| MASTER | Sim | Sim | Sim |
| GESTOR | Sim | Sim | Não |

### Editar usuário

| Quem edita | Pode editar GESTOR/PRESTADOR | Pode editar MASTER |
|------------|-----------------------------|---------------------|
| MASTER | Sim | Sim |
| GESTOR | Sim | Não |

Usuários podem editar o próprio perfil (nome) via política `profiles_update_own`.

---

## API

- **POST /api/users/create** — Cria usuário (requer `settings.users`; MASTER para role MASTER).
- **PATCH /api/users/[id]** — Atualiza perfil (requer `settings.users`; MASTER para editar MASTER).

---

## Documentos relacionados

- [BLING_ARCHITECTURE.md](../BLING_ARCHITECTURE.md) — Integração Bling e fornecedores

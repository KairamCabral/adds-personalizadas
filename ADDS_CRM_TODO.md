# ADDS CRM — Mapa Completo do que Falta

## LEGENDA
- ✅ Pronto
- 🔲 Falta fazer
- 📁 = Arquivo a criar | 🔧 = Lógica/Integração | 🎨 = Componente UI

---

## FASE 1 — FUNDAÇÃO (Pronta ~85%)

### ✅ Já feito
- ✅ package.json, tsconfig, tailwind.config, next.config, postcss
- ✅ .env.example, .gitignore, .prettierrc, .cursor/rules.md
- ✅ Migration SQL completa (00001_full_schema.sql) + seed.sql
- ✅ Supabase clients (browser, server, admin, middleware)
- ✅ Supabase realtime channels config
- ✅ Auth middleware (proteção de rotas)
- ✅ Root layout com providers (Query, Theme, Toaster)
- ✅ Login page com React Hook Form + Zod
- ✅ Auth layout (fundo com gradientes)
- ✅ Auth callback API route
- ✅ Sidebar com navegação por permissões
- ✅ Header com busca, dark mode, notificações, user menu
- ✅ Dashboard layout (sidebar + header + main)
- ✅ Utils (cn, formatCurrency, formatDate, getInitials, CPF/CNPJ, etc.)
- ✅ Constants (12 status, 7 labels, tipos, prioridades, nav)
- ✅ Permissions map (40+ permissões)
- ✅ Validations (Zod schemas)
- ✅ Database types (manual, placeholder)
- ✅ Hooks: use-user, use-permissions, use-kanban-realtime
- ✅ Store: ui.store (sidebar, command, order detail)
- ✅ Providers: query-provider, theme-provider
- ✅ Loading + Error pages globais
- ✅ Orders service (CRUD + labels + comments + watchers)

### 🔲 Falta na Fase 1

```
📁 src/app/(auth)/forgot-password/page.tsx
   → Página "esqueci minha senha" com envio de e-mail de reset
   → Form com campo de e-mail, chama supabase.auth.resetPasswordForEmail()

📁 src/components/ui/*.tsx (shadcn/ui — instalar via CLI)
   → Rodar no terminal do projeto:
     npx shadcn@latest init
     npx shadcn@latest add button dialog sheet dropdown-menu input
     npx shadcn@latest add select textarea badge avatar tabs table
     npx shadcn@latest add card tooltip popover command calendar
     npx shadcn@latest add skeleton scroll-area separator checkbox
     npx shadcn@latest add alert-dialog label switch toggle
   → Esses componentes são base para TUDO que vem depois

📁 src/components/shared/confirm-dialog.tsx
   → Diálogo reutilizável de confirmação (excluir pedido, etc.)

📁 src/components/shared/empty-state.tsx
   → Componente para estados vazios com ícone + mensagem + ação

📁 src/components/shared/loading-spinner.tsx
   → Spinner reutilizável

📁 src/components/shared/page-header.tsx
   → Header de página reutilizável (título + descrição + ações)

📁 src/components/shared/status-badge.tsx
   → Badge colorido para mostrar status do pedido

📁 src/components/shared/label-badge.tsx
   → Badge colorido para etiquetas (PAGO, BOLETO, etc.)

📁 src/components/shared/priority-indicator.tsx
   → Indicador de prioridade (normal/alta)

📁 src/components/shared/avatar-group.tsx
   → Grupo de avatares com overflow (+3)

📁 src/components/shared/file-upload.tsx
   → Componente de upload drag & drop para Supabase Storage

📁 src/components/shared/search-input.tsx
   → Input de busca com ícone e debounce

📁 src/components/shared/data-table.tsx
   → Tabela reutilizável com TanStack Table (sort, filter, pagination)
```

---

## FASE 2 — KANBAN + PEDIDOS (Pronta ~30%)

### ✅ Já feito
- ✅ kanban-board.tsx (estrutura DnD com @dnd-kit)
- ✅ kanban-column.tsx (droppable com contagem)
- ✅ kanban-card.tsx (sortable com labels, prioridade, avatar)
- ✅ Pipeline page

### 🔲 Falta na Fase 2

```
🔧 CONECTAR KANBAN AO SUPABASE (substituir mock data)
   → Arquivo: kanban-board.tsx
   → Trocar MOCK_ORDERS por useQuery chamando orders.service
   → Adicionar useMutation para moveOrder/reorderColumn
   → Ativar useKanbanRealtime() no board

📁 src/app/(dashboard)/pipeline/_components/kanban-card-skeleton.tsx
   → Skeleton loader para cards durante carregamento

📁 src/app/(dashboard)/pipeline/_components/order-detail-sheet.tsx
   → COMPONENTE PRINCIPAL — Sheet (slide-over) que abre ao clicar no card
   → Abas: Detalhes | Comentários | Checklist | Anexos | Arte | Histórico
   → Mostra: título, cliente, status, tipo, prioridade, datas, responsável
   → Permite edição inline dos campos
   → Botões: Editar | Excluir | Duplicar
   → Usa o useUIStore.selectedOrderId para controlar abertura

📁 src/app/(dashboard)/pipeline/_components/order-form.tsx
   → Formulário de criação/edição de pedido
   → Campos: título, descrição, cliente (combobox), tipo, prioridade,
     datas, responsável (select), produtos (multi-select com quantidade)
   → Pode ser Dialog ou Sheet
   → Usa orderSchema do Zod para validação
   → Usa o useUIStore.createOrderOpen para controlar abertura

📁 src/app/(dashboard)/pipeline/_components/order-filters.tsx
   → Painel de filtros do Kanban
   → Filtros: status (multi-select), responsável, prioridade, tipo,
     etiqueta, data de vencimento (range), busca por texto
   → Persistir filtros na URL com nuqs

📁 src/app/(dashboard)/pipeline/_components/order-comments.tsx
   → Lista de comentários do pedido
   → Input para novo comentário com @menções
   → Comentários do sistema (automáticos) em estilo diferente
   → Realtime via subscribeToComments

📁 src/app/(dashboard)/pipeline/_components/order-checklist.tsx
   → Criar/editar checklists dentro do pedido
   → Itens com checkbox, texto editável, drag & drop para reordenar
   → Barra de progresso (3/5 concluídos)

📁 src/app/(dashboard)/pipeline/_components/order-attachments.tsx
   → Lista de anexos do pedido
   → Upload via file-upload component → Supabase Storage
   → Preview de imagens, download de arquivos
   → Mostrar: nome, tamanho, quem enviou, quando

📁 src/app/(dashboard)/pipeline/_components/order-artwork.tsx
   → Upload de artes com versionamento
   → Status: pendente | aprovada | ajuste solicitado
   → Botão "Gerar link de aprovação" → cria token
   → Visualização da arte com zoom
   → Histórico de versões

📁 src/app/(dashboard)/pipeline/_components/order-history.tsx
   → Timeline vertical com todas as mudanças do pedido
   → Mostrar: quem, quando, o quê mudou (status, labels, etc.)
   → Usar dados de order_history

📁 src/app/(dashboard)/pipeline/_components/order-labels.tsx
   → Gerenciar etiquetas do pedido
   → Dropdown com as 7 etiquetas disponíveis
   → Toggle on/off para cada etiqueta

📁 src/services/clients.service.ts
   → getClients(search, page, limit)
   → getClientById(id)
   → createClient(data)
   → updateClient(id, data)
   → deleteClient(id)
   → searchClients(query) — para combobox no form de pedido

📁 src/services/products.service.ts
   → getProducts()
   → getActiveProducts() — para form de pedido
   → getProductById(id)
   → createProduct(data)
   → updateProduct(id, data)

📁 src/services/artworks.service.ts
   → getArtworksByOrder(orderId)
   → uploadArtwork(orderId, file)
   → updateArtworkStatus(id, status, notes?)
   → generateApprovalToken(orderId, artworkId, expiresInDays)

📁 src/hooks/use-debounce.ts
   → Hook de debounce para busca

📁 src/hooks/use-media-query.ts
   → Hook para responsive breakpoints
```

---

## FASE 3 — CONTATOS + ARTE + PÚBLICO (Pronta ~5%)

### ✅ Já feito
- ✅ Contacts page (placeholder)

### 🔲 Falta na Fase 3

```
CONTATOS
════════

📁 src/app/(dashboard)/contacts/page.tsx
   → REESCREVER — Lista de contatos com data-table
   → Busca, filtros (tipo pessoa, cidade, estado), paginação
   → Botões: Novo Contato | Importar | Sincronizar Tiny

📁 src/app/(dashboard)/contacts/[id]/page.tsx
   → Página de detalhe do contato
   → Dados cadastrais, pedidos vinculados, histórico de interações
   → Botão editar, botão excluir

📁 src/app/(dashboard)/contacts/_components/contacts-table.tsx
   → Tabela com data-table component
   → Colunas: nome, tipo, e-mail, telefone, cidade, documento, ações

📁 src/app/(dashboard)/contacts/_components/contact-form.tsx
   → Formulário de criação/edição
   → Campos: tipo pessoa, nome, e-mail, telefone, empresa, CPF/CNPJ,
     endereço completo (com busca CEP), observações, logo upload
   → Validação com clientSchema

📁 src/app/(dashboard)/contacts/_components/contact-detail.tsx
   → Componente de detalhe com abas: Info | Pedidos | Histórico

📁 src/app/(dashboard)/contacts/_components/import-dialog.tsx
   → Dialog para importação em massa de contatos
   → Upload de CSV/XLSX, mapeamento de colunas, preview, confirmação

📁 src/app/(dashboard)/contacts/_components/sync-tiny-dialog.tsx
   → Dialog para sincronização com Tiny ERP
   → Mostrar status da última sync, botão sincronizar, log de erros

📁 src/components/shared/cep-lookup.tsx
   → Input de CEP que auto-preenche endereço via API ViaCEP


APROVAÇÃO DE ARTE (PÚBLICO)
════════════════════════════

📁 src/app/(public)/layout.tsx
   → Layout público com branding ADDS (logo, cores, rodapé)

📁 src/app/(public)/art/approve/[token]/page.tsx
   → Página pública de aprovação de arte
   → Valida token via validate_approval_token()
   → Se válido: mostra arte + info do pedido
   → Se expirado/usado: mostra mensagem de erro
   → Form: nome do aprovador + aprovar/solicitar ajuste + comentário

📁 src/app/(public)/art/approve/[token]/_components/art-viewer.tsx
   → Visualizador de imagem com zoom e pan

📁 src/app/(public)/art/approve/[token]/_components/approval-form.tsx
   → Form com: nome, decisão (aprovar/ajuste), comentário de ajuste
   → Ao aprovar: atualiza token, artwork status, order status


ORÇAMENTO PÚBLICO (WIZARD 7 ETAPAS)
════════════════════════════════════

📁 src/app/(public)/quote/page.tsx
   → Wizard de orçamento público

📁 src/app/(public)/quote/success/page.tsx
   → Página de sucesso após envio

📁 src/app/(public)/quote/_components/quote-wizard.tsx
   → Controlador do wizard (step atual, dados acumulados, navegação)

📁 src/app/(public)/quote/_components/step-welcome.tsx
   → Etapa 1: Cliente novo ou já cadastrado?

📁 src/app/(public)/quote/_components/step-login.tsx
   → Etapa 2: Busca por e-mail/CPF/CNPJ/telefone no Tiny

📁 src/app/(public)/quote/_components/step-register.tsx
   → Etapa 3: Cadastro completo (nome, documento, endereço com CEP)

📁 src/app/(public)/quote/_components/step-products.tsx
   → Etapa 4: Seleção de produtos do catálogo + quantidades

📁 src/app/(public)/quote/_components/step-personalization.tsx
   → Etapa 5: WhatsApp, cidade, redes sociais, upload logo, cor de impressão

📁 src/app/(public)/quote/_components/step-confirmation.tsx
   → Etapa 6: Revisão de todos os dados antes de enviar

📁 src/services/quotes.service.ts
   → getQuotes(status?, page?)
   → getQuoteById(id)
   → createPublicQuote(data)
   → updateQuote(id, data)
   → approveQuote(id) — cria pedido no Kanban
   → rejectQuote(id, reason)


GERENCIADOR DE ORÇAMENTOS (INTERNO)
════════════════════════════════════

📁 src/app/(dashboard)/quotes/page.tsx
   → REESCREVER — Lista de orçamentos públicos
   → Tabela com status, filtros, ações

📁 src/app/(dashboard)/quotes/_components/quotes-table.tsx
   → Tabela com: cliente, produtos, valor, status, data, ações

📁 src/app/(dashboard)/quotes/_components/quote-detail-sheet.tsx
   → Sheet com detalhe do orçamento
   → Botões: Aprovar (cria pedido) | Rejeitar | Contactar
   → Campo de notas internas, atribuir responsável, definir valor


NOTIFICAÇÕES
════════════

📁 src/components/layout/notification-popover.tsx
   → Popover que abre ao clicar no sino no header
   → Lista de notificações com: ícone, título, mensagem, tempo
   → Marcar como lida (individual e todas)
   → Link para o pedido/entidade relacionada
   → Paginação/infinite scroll

📁 src/services/notifications.service.ts
   → getNotifications(page?)
   → getUnreadCount()
   → markAsRead(id)
   → markAllAsRead()
   → createNotification(data) — chamado internamente

📁 src/hooks/use-notifications.ts
   → Hook que combina:
     - useQuery para lista de notificações
     - useQuery para contagem de não lidas
     - subscribeToNotifications para realtime
     - Toast automático ao receber nova notificação

📁 src/stores/notifications.store.ts
   → Store com contagem de não lidas (para badge no header)
```

---

## FASE 4 — DASHBOARD + INTEGRAÇÕES (Pronta ~0%)

```
DASHBOARD GERENCIAL
═══════════════════

📁 src/app/(dashboard)/dashboard/page.tsx
   → REESCREVER — Dashboard com 6 abas + seletor de período

📁 src/app/(dashboard)/dashboard/_components/dashboard-tabs.tsx
   → Controle de abas: Vendas | Estoque | Clientes | Operações | Marketing | Financeiro

📁 src/app/(dashboard)/dashboard/_components/tab-vendas.tsx
   → Gráfico de evolução de vendas (line chart)
   → Cards: faturamento, ticket médio, pedidos no período
   → Vendas por canal, categoria, região

📁 src/app/(dashboard)/dashboard/_components/tab-estoque.tsx
   → Tabela de produtos com estoque atual
   → Alertas de estoque baixo
   → Gráfico de movimentação

📁 src/app/(dashboard)/dashboard/_components/tab-clientes.tsx
   → Novos clientes no período, top clientes, retenção

📁 src/app/(dashboard)/dashboard/_components/tab-operacoes.tsx
   → Métricas do pipeline: tempo médio por etapa, gargalos
   → Pedidos por status (bar chart)
   → Produtividade por responsável

📁 src/app/(dashboard)/dashboard/_components/tab-marketing.tsx
   → Performance de campanhas promocionais

📁 src/app/(dashboard)/dashboard/_components/tab-financeiro.tsx
   → Receitas, custos, margens
   → Gráfico de fluxo de caixa

📁 src/app/(dashboard)/dashboard/_components/metric-card.tsx
   → Card reutilizável: título, valor, variação %, ícone, sparkline

📁 src/app/(dashboard)/dashboard/_components/period-selector.tsx
   → Seletor: Hoje | 7d | 30d | 90d | Ano | Custom (date range)

📁 src/services/dashboard.service.ts
   → getSalesMetrics(period)
   → getStockMetrics()
   → getClientMetrics(period)
   → getOperationsMetrics(period)
   → getFinancialMetrics(period)


INTEGRAÇÃO TINY ERP
═══════════════════

📁 src/app/(dashboard)/tiny/page.tsx
   → REESCREVER — Dashboard de conexão com Tiny

📁 src/app/(dashboard)/tiny/_components/tiny-dashboard.tsx
   → Status da conexão, última sync, erros recentes

📁 src/app/(dashboard)/tiny/_components/tiny-clients.tsx
   → Lista de clientes do Tiny com botão sync individual

📁 src/app/(dashboard)/tiny/_components/tiny-orders.tsx
   → Consulta de pedidos do Tiny

📁 src/app/(dashboard)/tiny/_components/tiny-sync-log.tsx
   → Log de sincronizações com filtro por status/tipo

📁 src/services/tiny.service.ts
   → syncClients() — bidirecional
   → syncProducts()
   → getTinyOrders(page)
   → getTinyInvoices(orderId)
   → getSyncLogs(entity?, status?)

📁 src/app/api/webhooks/tiny/route.ts
   → IMPLEMENTAR — Webhook para receber atualizações do Tiny


CONFIGURAÇÕES (9 SEÇÕES)
════════════════════════

📁 src/app/(dashboard)/settings/layout.tsx
   → Layout com sidebar de settings (lista de seções)

📁 src/app/(dashboard)/settings/page.tsx
   → Redirect para primeira seção

📁 src/app/(dashboard)/settings/products/page.tsx
   → CRUD de produtos, tipos, opções de personalização

📁 src/app/(dashboard)/settings/kanban/page.tsx
   → Configurar colunas, fluxo, transições permitidas

📁 src/app/(dashboard)/settings/users/page.tsx
   → Lista de usuários, criar/editar, atribuir perfil
   → Convidar por e-mail

📁 src/app/(dashboard)/settings/labels/page.tsx
   → Gerenciar etiquetas disponíveis

📁 src/app/(dashboard)/settings/notifications/page.tsx
   → Configurar quais eventos geram notificação, por canal

📁 src/app/(dashboard)/settings/system/page.tsx
   → Configurações gerais do sistema

📁 src/app/(dashboard)/settings/security/page.tsx
   → Autenticação, bloqueio, sessões, auditoria
   → Visualizador de audit_logs

📁 src/app/(dashboard)/settings/integrations/page.tsx
   → Configurar Tiny ERP, Resend, webhooks

📁 src/app/(dashboard)/settings/backup/page.tsx
   → Backup e restauração de dados, export CSV/JSON


AUDITORIA
═════════

📁 src/services/audit.service.ts
   → getAuditLogs(filters, page)
   → logAction(action, entityType, entityId, oldData, newData)
   → exportAuditLogs(filters, format)


E-MAIL
══════

📁 src/services/email.service.ts
   → sendApprovalEmail(to, orderTitle, approvalLink)
   → sendStatusChangeEmail(to, orderTitle, oldStatus, newStatus)
   → sendQuoteReceivedEmail(to, quoteSummary)
   → sendWelcomeEmail(to, name)

📁 src/app/api/email/send/route.ts
   → IMPLEMENTAR — API route para envio via Resend

📁 src/lib/email-templates/
   → approval.tsx — Template de aprovação de arte
   → status-change.tsx — Template de mudança de status
   → quote-received.tsx — Template de orçamento recebido


CRON / CLEANUP
══════════════

📁 src/app/api/cron/cleanup/route.ts
   → IMPLEMENTAR — Limpar tokens expirados, logs antigos
   → Configurar como Vercel Cron Job
```

---

## RESUMO QUANTITATIVO

| Fase | Arquivos Prontos | Arquivos Faltando | % Completo |
|------|-----------------|-------------------|------------|
| **Fase 1 — Fundação** | 34 | ~15 (shadcn + shared) | 85% |
| **Fase 2 — Kanban** | 4 | ~18 | 30% |
| **Fase 3 — Contatos/Arte/Público** | 1 | ~30 | 5% |
| **Fase 4 — Dashboard/Integrações** | 0 | ~35 | 0% |
| **TOTAL** | **39** | **~98** | **~28%** |

---

## ORDEM RECOMENDADA DE DESENVOLVIMENTO NO CURSOR

### Sprint 1 (próximos passos imediatos)
1. `npx shadcn@latest init` + instalar todos os componentes UI
2. Criar os componentes shared (data-table, file-upload, etc.)
3. Criar forgot-password page
4. Conectar Kanban ao Supabase (trocar mock data)

### Sprint 2
5. order-detail-sheet (o componente mais importante da Fase 2)
6. order-form (criar/editar pedido)
7. order-comments + realtime
8. order-labels + order-checklist

### Sprint 3
9. order-attachments + file-upload → Supabase Storage
10. order-artwork + approval tokens
11. order-history timeline
12. order-filters com nuqs

### Sprint 4
13. Contacts CRUD completo
14. Public art approval page
15. Notification system

### Sprint 5
16. Public quote wizard (7 etapas)
17. Quotes management interno
18. Email service (Resend)

### Sprint 6
19. Dashboard gerencial (6 abas)
20. Tiny ERP integration
21. Settings pages
22. Audit logs + cleanup cron

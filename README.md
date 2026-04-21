# AutoPro

Sistema de gestão para oficinas mecânicas. Cobre o ciclo completo da operação: ordens de serviço, clientes, veículos, controle de estoque, compras, financeiro, comissões de funcionários e emissão de notas fiscais (NFS-e / NF-e) — em uma arquitetura multi-tenant onde cada organização opera com dados isolados.

## Módulos do produto

- **Ordens de serviço** — abertura, acompanhamento, fechamento e cancelamento. Cada OS registra produtos, serviços, impostos aplicados, parcelas de pagamento e comissão por funcionário.
- **Clientes e veículos** — cadastro completo de pessoas físicas e jurídicas, com histórico de OS por veículo e por cliente.
- **Funcionários** — registro com salário, chave PIX e regras de comissão configuráveis (percentual ou valor fixo, sobre faturamento ou lucro, por categoria de serviço).
- **Financeiro** — lançamentos de receitas e despesas, parcelamentos, extratos por conta bancária, entradas recorrentes e pagamento em lote de comissões.
- **Estoque** — controle de peças e consumíveis com alertas de quantidade mínima, preço de custo e venda, e vínculo com fornecedor.
- **Fornecedores e compras** — cadastro de fornecedores, pedidos de compra com reposição automática de estoque e devoluções com geração de crédito financeiro.
- **Solicitações de compra** — fluxo interno de autorização: da solicitação à compra efetiva.
- **Notas fiscais** — emissão de NFS-e e NF-e, cancelamento, carta de correção e download de PDF via integração com a Nuvem Fiscal.
- **Agendamentos** — marcação vinculada a cliente e veículo, com conversão direta para OS.
- **Relatórios** — faturamento, comissões, custos vs. lucro, devedores, clientes, fornecedores e compras.
- **Configurações da organização** — perfil da oficina, CNPJ/CPF, endereço, logo, código de município IBGE, conta bancária padrão e número inicial de OS.
- **Usuários e permissões** — gestão multi-tenant com controle de acesso por função e por ação dentro de cada organização.
- **Assinaturas** — gestão de planos e histórico de cobrança via Stripe.

## Stack técnica

- **Frontend**: Nuxt 4, Vue 3, TypeScript, @nuxt/ui, Tailwind CSS v4
- **Backend**: Nitro (rotas server-side), Supabase (Postgres, Auth, Storage, Edge Functions)
- **Billing**: Stripe
- **Fiscal**: Nuvem Fiscal (NFS-e / NF-e)
- **Mobile**: Capacitor (Android e iOS)
- **Validação**: Zod
- **Deploy**: Vercel

## Estrutura do projeto

```text
.
|- app/
|  |- components/       # componentes de domínio e compartilhados
|  |- composables/      # estado client-side e integrações
|  |- layouts/          # layouts público, auth e app
|  |- pages/            # rotas de marketing e app autenticado
|  `- types/            # contratos TypeScript do frontend
|- public/              # ícones, favicon e assets públicos
|- server/
|  |- api/              # endpoints Nitro (migrados das Supabase Edge Functions)
|  `- utils/            # clientes e helpers: Supabase, Stripe, Nuvem Fiscal
|- supabase/
|  |- functions/        # edge functions mantidas só para webhooks externos
|  `- migrations/       # migrações SQL e documentação do schema
`- capacitor.config.ts  # configuração mobile
```

## Requisitos

- Node.js 20+
- pnpm 10+
- Projeto configurado no Supabase
- Credenciais do Stripe (billing)
- Credenciais da Nuvem Fiscal (fiscal)

## Setup local

1. Instalar dependências:

```bash
pnpm install
```

2. Copiar o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Preencher as variáveis no `.env`.

4. Iniciar o projeto:

```bash
pnpm dev
```

Acesso local: `http://localhost:3000`

## Variáveis de ambiente

| Variável | Obrigatória | Finalidade |
|---|---|---|
| `NUXT_PUBLIC_SITE_URL` | recomendada | URL pública usada em geração e metadados |
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | sim | Autenticação e requests anônimos server-side |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Operações administrativas server-side |
| `STRIPE_SECRET_KEY` | sim (billing) | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | sim (billing) | Verificação de assinatura de webhook |
| `STRIPE_ALLOWED_PRICE_IDS` | sim (billing) | IDs de preços aceitos, separados por vírgula |
| `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` | opcional | Configuração customizada do portal de billing |
| `NUVEM_FISCAL_CLIENT_ID` | sim (fiscal) | Client ID OAuth da Nuvem Fiscal |
| `NUVEM_FISCAL_CLIENT_SECRET` | sim (fiscal) | Client Secret OAuth da Nuvem Fiscal |
| `NUVEM_FISCAL_ENVIRONMENT` | sim (fiscal) | `production` ou `sandbox` |

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia o ambiente de desenvolvimento |
| `pnpm build` | Gera o build de produção |
| `pnpm preview` | Abre preview local do build |
| `pnpm lint` | Executa o ESLint |
| `pnpm typecheck` | Valida tipos com Nuxt TypeCheck |
| `pnpm generate:icons` | Regenera ícones PWA e favicon a partir do SVG de marca |
| `pnpm cap:sync` | Gera output estático e sincroniza com o Capacitor |
| `pnpm cap:open:android` | Abre o projeto Android nativo |
| `pnpm cap:open:ios` | Abre o projeto iOS nativo |

## Arquitetura e fluxo de dados

- O cliente consome exclusivamente endpoints Nitro internos via `$fetch`, `useFetch` ou `useAsyncData`.
- Supabase, Stripe e Nuvem Fiscal são acessados somente no servidor (`server/api/**`, `server/utils/**`).
- Todas as queries usam a service role key server-side; a anon key é usada apenas em fluxos de autenticação.
- Multi-tenancy é garantido no nível de query: todas as tabelas carregam `organization_id` e todos os handlers validam o contexto da sessão autenticada.
- Formulários usam `UForm` + Zod para validação.
- Feedback visual de ações usa `useToast()`.
- Listas grandes usam filtragem e paginação server-side.

## Convenções importantes

- Nunca acessar o Supabase diretamente do cliente.
- Preferir componentes do Nuxt UI antes de construir UI customizada.
- Evitar CSS local quando classes utilitárias são suficientes.
- Manter tipos explícitos; evitar `any`.
- Valores financeiros são armazenados como `numeric(15,2)` — nunca usar floats JavaScript para aritmética monetária.
- Todos os valores de enum no banco estão em inglês (snake_case). Ver `supabase/migrations/migrate_database_base44.md` para o mapeamento PT → EN usado no ETL.

## Banco de dados

Migrações ficam em `supabase/migrations/`. O arquivo `migrate_database_base44.md` contém a documentação completa do schema, incluindo:

- Mapeamento de nomes de tabelas (legado → novo schema)
- Mapeamento de colunas com tipos e referências FK
- Formatos de colunas JSONB para campos complexos
- Tabelas de enum (EN ↔ PT legado) para cada coluna enum
- Colunas de auditoria (`created_at/by`, `updated_at/by`, `deleted_at/by`) aplicadas em todas as tabelas
- Ordem de dependência FK para migração segura

Para novos ambientes:

1. Criar o projeto no Supabase.
2. Configurar as variáveis no `.env`.
3. Aplicar as migrações via Supabase CLI.

## Supabase Edge Functions

Apenas webhooks externos são mantidos como Edge Functions. Toda a lógica de negócio roda como rotas Nitro em `server/api/`:

| Função | Motivo de manter |
|---|---|
| `stripeWebhook` | Endpoint público obrigatório para eventos do Stripe |
| `stripe-webhook` | Alias legado — mesmo endpoint |

## Notas fiscais

A emissão de NFS-e e NF-e requer conta válida na Nuvem Fiscal. Antes de emitir documentos para uma organização:

1. Cadastrar a empresa (CNPJ) no painel da Nuvem Fiscal.
2. Fazer upload do certificado digital pela tela de configurações.
3. Verificar o status de sincronização em **Configurações → Integração Fiscal**.

O ambiente `sandbox` pode ser usado para testes sem emitir documentos reais.

## Billing

Fluxos de assinatura dependem de:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ALLOWED_PRICE_IDS`
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` quando um portal customizado está configurado

Sem essas variáveis as rotas de billing não vão funcionar.

## Mobile e PWA

- Manifesto PWA configurado para instalação standalone.
- Capacitor configurado em `capacitor.config.ts` para empacotamento Android e iOS.
- Ícones gerados a partir do SVG de marca em `public/icons/`.

## Qualidade

Antes de abrir PR ou entregar mudanças:

```bash
pnpm lint
pnpm typecheck
```

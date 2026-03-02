# Copilot Instructions — Second Brain (Nuxt 4 + Nuxt UI + Supabase)

Estas instruções definem o padrão do projeto para que contribuições geradas com GitHub Copilot mantenham consistência, performance e qualidade.

## Contexto do produto

**Second Brain** é um sistema pessoal de conhecimento para **capturar, organizar e transformar ideias em ação**. Construído com **Nuxt** e **Supabase**, funciona como uma extensão da mente — ideias não se perdem, elas evoluem.

O app deve ser rápido, confiável e escalável (muitos itens/dados), com UX clara para criar/editar/buscar conteúdo como **notas, hábitos, coleções e tags**.

## Stack e convenções existentes (não quebrar)

- Framework: **Nuxt 4**, Vue 3, TypeScript, `script setup`.
- UI/Design system: **@nuxt/ui**.
- Styling: **Tailwind CSS v4** + tokens/tema em `app/assets/css/main.css`.
- Validação: **zod** (já usado com `UForm`).
- Notificações: `useToast()` (Nuxt UI) já está em uso.
- APIs: rotas internas em `server/api/*.ts` (Nitro `eventHandler`).
- Banco/serviços: **Supabase** (sempre acessado via server-side).
- CI: `pnpm lint` e `pnpm typecheck` devem passar.

> Observação: apesar de o repositório ter vindo de um template, **o produto é o Second Brain**. Para estilos, o projeto usa Tailwind/Nuxt UI; evite adicionar SCSS/SASS sem necessidade.

## Padrões para SASS/SCSS (quando realmente necessário)

O projeto **prioriza Tailwind + Nuxt UI**. Se for inevitável usar SASS/SCSS (ex.: integração com lib legada, styles muito complexos para utilitárias), siga:

- Prefira **escopo local** (ex.: `<style scoped lang="scss">`) e mantenha o bloco pequeno.
- Use **`@use` / `@forward`** (evite `@import`).
- Não crie **cores/sombras/fontes hard-coded** em SCSS; use tokens/classes existentes e variáveis do tema.
- Organize em módulos pequenos e reaproveitáveis; evite “arquivo gigante” de estilos.
- Evite estilos globais que vazem para outras telas.

## Padrão para UI e estilos (Tailwind/Nuxt UI)

1. **Use componentes do Nuxt UI primeiro** (ex.: `UForm`, `UInput`, `UTable`, `UModal`, `USlideover`, `USkeleton`, `UButton`).
2. **Não introduza cores/fontes/sombras hard-coded**. Use tokens/classes existentes (Tailwind) e as variáveis/tokens do tema.
3. **Evite CSS local** em componentes. Quando inevitável:
   - prefira classes utilitárias;
   - mantenha estilos pequenos e sem inventar tokens.
4. **Acessibilidade**: labels, `aria-*`, foco visível, elementos clicáveis com hit-area apropriada.

## Loading (carregamento total e parcial) com Skeleton

Sempre que houver carregamento assíncrono:

### 1) Loading total de página
- Use `useAsyncData`/`useFetch` no nível da página.
- Enquanto `status === 'pending'` ou `pending === true`, renderize um **layout de skeleton** que preserve a estrutura final (evita layout shift).
- Prefira criar um componente dedicado `*Skeleton.vue` quando a UI for reutilizável.

### 2) Loading parcial (componentes / áreas)
- Para cards, listas, tabelas e painéis: renderize skeleton local (ex.: `USkeleton`) **apenas naquela área**.
- Botões de ação devem ter `loading`/`loading-auto` quando aplicável.

Regras:
- Skeleton deve refletir tamanho/forma aproximada do conteúdo final.
- Não bloqueie a página inteira se apenas uma seção está carregando.

## Notificações (toasts) após ações de API

Toda ação que cria/atualiza/exclui dados ou chama API deve:

- Mostrar toast de **sucesso** ao completar.
- Mostrar toast de **erro** ao falhar (mensagem útil, sem expor segredos).
- Usar `try/catch` e, quando fizer sentido, feedback de `loading`.

Padrão:
- `const toast = useToast()`
- Sucesso: `toast.add({ title, description, color: 'success' })`
- Erro: `toast.add({ title: 'Erro', description, color: 'error' })`

Exemplos típicos no domínio:
- Criar nota/hábito/tag → toast de sucesso + fechar modal.
- Falha ao salvar no Supabase → toast de erro com mensagem curta e útil.

## Performance e otimização (considerando muitos dados)

1. **Nunca** buscar “tudo” sem paginação quando o volume pode crescer.
2. Listas/tabelas:
   - suportar paginação (`page`, `pageSize`) e ordenação/filters;
   - preferir filtros server-side para grandes datasets.
3. Use `useFetch`/`useAsyncData` com:
   - `lazy: true` quando a UI não precisa travar SSR;
   - `key` estável quando depender de params;
   - `watch` apenas nas dependências necessárias.
4. Evite watchers caros e recomputações desnecessárias.
5. Em inputs de busca/filtro, use debounce (ex.: `@vueuse/core`) para não disparar requisições a cada tecla.

## Formulários: validação obrigatória e erro abaixo do input

Regras obrigatórias para qualquer form:

1. Sempre usar `UForm` com schema **Zod**.
2. Cada campo deve estar em `UFormField` com `name`.
3. Mensagens de erro devem aparecer **abaixo do input** (o `UFormField` faz isso quando integrado ao `UForm` + `schema`).
4. Em submit:
   - desabilitar/mostrar loading durante request;
   - tratar erro com toast;
   - fechar modal/limpar state apenas no sucesso.

## Modularização e organização

- Componentes reutilizáveis devem ir para `app/components/**` (ex.: `Habits*`, `Notes*`, `Tags*`, `Collections*`, `Skeletons/*`).
- Lógica de estado compartilhado deve ir para `app/composables/**`.
- Não criar componentes “gigantes”. Regra prática: se um arquivo cresce demais ou mistura responsabilidades, **quebre em componentes menores**.

## Padrão de API: sempre server-side

Qualquer integração com banco/serviços externos (ex.: **Supabase**) deve acontecer **no servidor**.

Regras:
1. Criar/usar rotas em `server/api/**` (Nitro) para:
   - CRUD de entidades;
   - consultas/paginação/filtros;
   - chamadas a Supabase/serviços externos.
2. No client, chamar apenas endpoints internos com `$fetch`/`useFetch`.
3. Validar input no servidor com Zod:
   - `readBody(event)` para POST/PUT/PATCH;
   - `getQuery(event)` para GET;
   - em caso de erro, usar `throw createError({ statusCode, statusMessage, data })`.
4. Nunca expor secrets no client. Secrets devem estar em `runtimeConfig` e usados apenas server-side.

Padrão recomendado:
- **Não** chamar Supabase diretamente do client.
- Preferir `server/api/<dominio>/*.ts` por entidade (ex.: `notes`, `habits`, `tags`).
- Respostas pequenas e previsíveis (com paginação) para suportar escala.

## Padrões de código (TypeScript/Vue)

- Preferir `type`/`interface` explícitos para payloads e respostas.
- Manter nomes claros e consistentes (domínio: `habits`, `notes`, `collections`, `tags`, `inbox`, `schedules`, `reports`).
- Evitar `any`.
- Preferir funções pequenas e puras quando possível.

### Imports with Aliases

Whenever possible, prefer using **project aliases** instead of long relative paths.

- `~/` for imports starting from the Nuxt source root (e.g. `~/server`, `~/app`, etc.)
- `@/` as an equivalent root alias (when appropriate)

#### Examples

- `import { useAuth } from '~/composables/useAuth'`
- `import { getSupabaseAdminClient } from '~/server/utils/supabase'`

#### Goal

Improve code readability, avoid `../../..` paths, and make refactors and structural changes easier and safer.

## Checklist antes de finalizar

- UI usa componentes Nuxt UI e tokens existentes.
- Loading total/parcial com skeleton implementado.
- Toast de sucesso/erro após ações.
- Form com Zod + erro abaixo do input.
- Para muito dado: paginação/filtros server-side.
- Integrações externas só em `server/api/**`.


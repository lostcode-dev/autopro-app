# Copilot Instructions — Kortex (Nuxt 4 + Nuxt UI + Supabase)

These instructions define the project standard so that contributions generated with GitHub Copilot maintain consistency, performance, and quality.

## Product context

**Kortex** is a personal knowledge system built to **capture, organize, and turn ideas into action**. It is built with **Nuxt** and **Supabase**, and should feel like an extension of the user's mind: ideas should not get lost, they should evolve.

The app must be fast, reliable, and scalable for large datasets, with a clear UX for creating, editing, and finding content such as **notes, habits, collections, and tags**.

## Existing stack and conventions (do not break)

- Framework: **Nuxt 4**, Vue 3, TypeScript, `script setup`
- UI / design system: **@nuxt/ui**
- Styling: **Tailwind CSS v4** + theme tokens in `app/assets/css/main.css`
- Validation: **zod** (already used with `UForm`)
- Notifications: `useToast()` from Nuxt UI is already in use
- APIs: internal routes in `server/api/*.ts` (Nitro `eventHandler`)
- Database / services: **Supabase** (always accessed server-side)
- CI: `pnpm lint` and `pnpm typecheck` must pass

> Note: even though the repository started from a template, **the product is Kortex**. For styling, the project uses Tailwind + Nuxt UI. Avoid introducing SCSS/SASS unless there is a real need.

## SASS / SCSS rules (only when truly necessary)

The project **prioritizes Tailwind + Nuxt UI**. If using SASS / SCSS is unavoidable, for example for legacy library integration or styling too complex for utility classes, follow these rules:

- Prefer **local scope** (for example `<style scoped lang="scss">`) and keep the block small
- Use **`@use` / `@forward`** and avoid `@import`
- Do not create hard-coded **colors, shadows, or fonts** in SCSS; use existing tokens, classes, and theme variables
- Organize styles into small reusable modules and avoid giant files
- Avoid global styles that leak into other screens

## UI and styling standard (Tailwind / Nuxt UI)

1. **Use Nuxt UI components first** (for example `UForm`, `UInput`, `UTable`, `UModal`, `USlideover`, `USkeleton`, `UButton`)
2. **Do not introduce hard-coded colors, fonts, or shadows**. Use existing tokens and theme variables
3. **Avoid local CSS** in components. When it is unavoidable:
   - prefer utility classes
   - keep styles small and avoid inventing new tokens
4. **Accessibility** is required: labels, `aria-*`, visible focus states, and appropriate click / tap targets

## Loading states with skeletons

Whenever there is asynchronous loading:

### 1. Full-page loading

- Use `useAsyncData` or `useFetch` at the page level
- While `status === 'pending'` or `pending === true`, render a **skeleton layout** that preserves the final structure and avoids layout shift
- Prefer a dedicated `*Skeleton.vue` component when the UI is reusable

### 2. Partial loading (components / sections)

- For cards, lists, tables, and panels, render a local skeleton such as `USkeleton` only in that area
- Action buttons should use `loading` or `loading-auto` when applicable

Rules:

- Skeletons should roughly match the size and shape of the final content
- Do not block the whole page if only one section is loading

## Notifications (toasts) after API actions

Every action that creates, updates, deletes data, or calls an API must:

- Show a **success** toast when it completes
- Show an **error** toast when it fails, with a useful message and without exposing secrets
- Use `try/catch` and provide loading feedback when appropriate

Standard:

- `const toast = useToast()`
- Success: `toast.add({ title, description, color: 'success' })`
- Error: `toast.add({ title: 'Error', description, color: 'error' })`

Typical examples in this domain:

- Creating a note / habit / tag should show a success toast and close the modal
- Failing to save to Supabase should show a short, useful error toast

## PostHog analytics (required for screens and flows)

Every new screen, core product area, or relevant flow must ship with **PostHog** instrumentation.

Rules:

- Always use the `usePostHog()` composable; do not import `posthog-js` directly inside pages or components
- Every screen must have pageview tracking. The global plugin already covers navigation and visited screens, so new flows must preserve that pattern
- Every primary domain action must have its own semantic event
- Do not send free text, rich content, long descriptions, or high-cardinality properties such as full entity names
- Prefer stable, aggregatable properties such as:
  - `id`
  - `type`
  - `status`
  - `count`
  - boolean flags like `has_identity`, `has_note`, `has_schedule`
- User identification must use the central auth flow; do not call `identify` or `reset` manually outside the global pattern
- Feature flags must be consumed through `usePostHog()` using `isFeatureEnabled`, `getFeatureFlag`, `getFeatureFlagPayload`, and `onFeatureFlags`
- Tracking must run only in production. Never enable PostHog in local development or preview environments unless there is an explicit decision to do so

Minimum checklist per screen:

- pageview exists
- primary actions have semantic events
- event properties do not contain unnecessary PII or free text
- event naming is semantic and consistent with the domain

## Performance and optimization (large data volumes)

1. **Never** fetch everything without pagination when data can grow
2. Lists and tables should:
   - support pagination (`page`, `pageSize`) and sorting / filtering
   - prefer server-side filters for large datasets
3. Use `useFetch` / `useAsyncData` with:
   - `lazy: true` when the UI does not need to block SSR
   - a stable `key` when data depends on params
   - `watch` only on the required dependencies
4. Avoid expensive watchers and unnecessary recomputation
5. Use debounce for search and filter inputs, for example with `@vueuse/core`, to avoid firing requests on every keystroke

## Forms: required validation and error message placement

Required rules for any form:

1. Always use `UForm` with a **Zod** schema
2. Every field must be wrapped in `UFormField` with a `name`
3. Validation errors must appear **below the input**. `UFormField` already handles this when wired to `UForm` + `schema`
4. On submit:
   - disable the form or show loading during the request
   - handle errors with a toast
   - only close the modal or clear state on success

## Modularization and organization

- Reusable components belong in `app/components/**` (for example `Habits*`, `Notes*`, `Tags*`, `Collections*`, `Skeletons/*`)
- Shared state logic belongs in `app/composables/**`
- Do not create giant components. If a file grows too much or mixes responsibilities, split it into smaller pieces

## API standard: always server-side

Any integration with the database or external services such as **Supabase** must happen **on the server**.

Rules:

1. Create or use routes in `server/api/**` (Nitro) for:
   - entity CRUD
   - queries, pagination, and filters
   - Supabase and external service calls
2. On the client, call only internal endpoints through `$fetch` or `useFetch`
3. Validate input on the server with Zod:
   - `readBody(event)` for POST / PUT / PATCH
   - `getQuery(event)` for GET
   - on error, use `throw createError({ statusCode, statusMessage, data })`
4. Never expose secrets to the client. Secrets must stay in `runtimeConfig` and be used only server-side

Recommended pattern:

- **Do not** call Supabase directly from the client
- Prefer `server/api/<domain>/*.ts` per entity, for example `notes`, `habits`, `tags`
- Keep responses small and predictable, with pagination where appropriate

## Code standards (TypeScript / Vue)

- Prefer explicit `type` / `interface` definitions for payloads and responses
- Keep naming clear and consistent with the domain: `habits`, `notes`, `collections`, `tags`, `inbox`, `schedules`, `reports`
- Avoid `any`
- Prefer small and mostly pure functions when possible

### Imports with aliases

Whenever possible, prefer **project aliases** instead of long relative paths.

- `~/` for imports from the Nuxt source root
- `@/` as an equivalent root alias when appropriate

#### Examples

- `import { useAuth } from '~/composables/useAuth'`
- `import { getSupabaseAdminClient } from '~/server/utils/supabase'`

#### Goal

Improve readability, avoid `../../..` imports, and make refactors safer and easier.

### Enums and type safety (TypeScript rule)

Always use **TypeScript enums** for fixed sets of values and ensure that **all code is fully typed with TypeScript**.

#### Rules

- Always use `enum` for:
  - statuses
  - types
  - categories
  - modes
  - any finite and predefined set of values
- Never use raw strings or numbers to represent statuses or types
- Do not rely on implicit `any`
- Always explicitly type:
  - function parameters
  - function return types
  - object properties
  - API request and response payloads

#### Example

```ts
enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest'
}
```

#### Goal

Guarantee type safety, consistency, and maintainability across the codebase, reduce runtime errors, and make refactors safer and more predictable.

## Checklist before finishing

- UI uses Nuxt UI components and existing tokens
- Full and partial loading states use skeletons
- Success and error toasts exist after actions
- Forms use Zod and show validation errors below inputs
- Large datasets use server-side pagination and filtering
- External integrations live only in `server/api/**`

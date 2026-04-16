# Guia Para Politica de Privacidade e Cookies

Este documento serve como base para criar a politica de privacidade e a politica de cookies do AutoPro em um segundo momento.

Ele nao substitui revisao juridica. A recomendacao e revisar o texto final com apoio juridico/compliance antes de publicar.

## Decisao atual do produto

O toast de "cookies essenciais" foi removido do layout autenticado porque:

- ele aparecia apenas depois do login, entao nao era um mecanismo geral de transparencia;
- ele nao bloqueava tecnologias opcionais;
- ele nao era um consentimento valido para analytics caso o PostHog seja ativado no futuro;
- para cookies estritamente necessarios, a melhor pratica aqui e documentar com clareza na politica, sem interromper a navegacao.

Arquivos relacionados:

- `app/layouts/app.vue`
- `server/utils/auth-cookies.ts`
- `app/plugins/posthog.client.ts`
- `app/plugins/onesignal.client.ts`
- `nuxt.config.ts`

## Inventario atual de cookies e tecnologias semelhantes

### 1. Cookies essenciais de autenticacao

Origem:

- `server/utils/auth-cookies.ts`

Cookies identificados:

- `sb-access-token`
- `sb-refresh-token`

Finalidade:

- manter a sessao autenticada do usuario;
- permitir renovacao da sessao;
- proteger o acesso a areas autenticadas do sistema.

Configuracao atual observada no codigo:

- `httpOnly: true`
- `sameSite: 'lax'`
- `secure: true` em producao
- `path: '/'`

Base legal sugerida para a politica:

- execucao do contrato / prestacao do servico solicitado pelo utilizador;
- seguranca da autenticacao e continuidade da sessao.

### 2. Preferencia de tema / modo de cor

Origem:

- `nuxt.config.ts`

Tecnologia identificada:

- `localStorage` com chave `nuxt-color-mode`

Finalidade:

- guardar preferencia de modo de cor do Nuxt UI.

Observacao:

- no estado atual do app, a preferencia esta forçada para `light`, mas a chave de storage continua configurada pelo modulo.

### 3. Cache e armazenamento tecnico do PWA

Origem:

- `nuxt.config.ts`

Tecnologias identificadas:

- Cache Storage / Service Worker do PWA (`@vite-pwa/nuxt`);
- caches tecnicos para fontes e assets.

Finalidade:

- melhorar desempenho;
- permitir atualizacao controlada do frontend;
- suportar comportamento PWA.

Observacao:

- isto nao e o mesmo que cookie de marketing, mas pode merecer mencao na politica de cookies/tecnologias semelhantes.

### 4. Analytics opcional via PostHog

Origem:

- `app/plugins/posthog.client.ts`
- `app/composables/usePostHog.ts`
- `nuxt.config.ts`

Flags observadas:

- `NUXT_PUBLIC_POSTHOG_ENABLED`
- `NUXT_PUBLIC_POSTHOG_KEY`
- `NUXT_PUBLIC_POSTHOG_HOST`

Estado esperado pelo repo:

- em `.env.example`, `NUXT_PUBLIC_POSTHOG_ENABLED=false`

Quando ativado, o codigo pode recolher:

- page views;
- transicoes de navegacao;
- identificacao do utilizador autenticado;
- email e nome do utilizador para identificacao do perfil no PostHog;
- feature flags;
- metadados de sessao.

Recomendacao de politica:

- tratar como tecnologia opcional de analytics;
- descrever fornecedor, finalidade, dados enviados, base legal e transferencias internacionais;
- se for ativado em producao, implementar consentimento real antes de `posthog.init(...)`.

### 5. Push notifications opcionais via OneSignal

Origem:

- `app/plugins/onesignal.client.ts`
- `nuxt.config.ts`
- `app/pages/app/settings/notifications.vue`

Flags observadas:

- `NUXT_PUBLIC_ONESIGNAL_ENABLED`
- `NUXT_PUBLIC_ONESIGNAL_APP_ID`

Estado esperado pelo repo:

- em `.env.example`, `NUXT_PUBLIC_ONESIGNAL_ENABLED=false`

Finalidade:

- permitir notificacoes push web quando a funcionalidade estiver ativa e o utilizador conceder permissao no navegador.

Recomendacao de politica:

- descrever separadamente de cookies essenciais;
- explicar que depende de permissao explicita do navegador/dispositivo;
- listar fornecedor e finalidade operacional das notificacoes.

## O que a politica de privacidade deve cobrir

Minimo recomendado para a primeira versao:

1. Identificacao do responsavel pelo tratamento
- nome empresarial;
- NIF/CNPJ ou identificacao societaria aplicavel;
- email de contacto para privacidade;
- endereco ou sede.

2. Categorias de dados pessoais tratadas
- dados de conta: nome, email, telefone;
- dados da organizacao/oficina;
- dados de faturacao e assinatura;
- dados operacionais inseridos no sistema;
- logs tecnicos e metadados de autenticacao;
- dados de notificacoes, se OneSignal estiver ativo.

3. Finalidades e bases legais
- criacao e gestao da conta;
- autenticacao e seguranca;
- execucao da assinatura e cobranca;
- suporte;
- cumprimento legal e fiscal;
- analytics, apenas se ativado e com base legal adequada;
- notificacoes push, quando o utilizador optar por isso.

4. Partilha com subcontratantes/fornecedores
- Supabase;
- Stripe;
- PostHog, se ativo;
- OneSignal, se ativo;
- outros prestadores que venham a ser usados em producao.

5. Transferencias internacionais
- indicar se algum fornecedor trata dados fora do EEE/UE;
- mencionar mecanismo adotado pelo fornecedor quando aplicavel.

6. Prazos de conservacao
- sessao/autenticacao;
- faturacao;
- logs;
- conta inativa;
- backups, se aplicavel.

7. Direitos do titular
- acesso;
- retificacao;
- apagamento;
- limitacao;
- oposicao;
- portabilidade;
- reclamacao junto da autoridade competente.

8. Contacto para exercicio de direitos
- email dedicado;
- prazo interno de resposta;
- processo de verificacao de identidade.

## O que a politica de cookies deve cobrir

Estrutura recomendada:

1. O que sao cookies e tecnologias semelhantes

2. Quais sao usados pelo AutoPro hoje

Tabela sugerida:

| Nome / tecnologia | Tipo | Finalidade | Obrigatorio? | Duracao | Fornecedor |
| --- | --- | --- | --- | --- | --- |
| `sb-access-token` | Cookie | Sessao autenticada | Sim | conforme sessao Stripe/Supabase | AutoPro / Supabase |
| `sb-refresh-token` | Cookie | Renovacao de sessao | Sim | ate 1 ano no codigo atual, salvo sessao nao persistente | AutoPro / Supabase |
| `nuxt-color-mode` | Local storage | Preferencia visual | Tecnico/funcional | persistente | AutoPro |
| PWA Cache Storage | Cache do navegador | Performance e assets offline | Tecnico | variavel | AutoPro |
| PostHog cookies/storage | Analytics | Medicao de uso e produto | Nao, se ativado | conforme fornecedor | PostHog |
| OneSignal identifiers/storage | Push | Entrega de notificacoes | Nao, depende de opt-in | conforme fornecedor | OneSignal |

3. Como o utilizador pode gerir preferencias

- configuracoes do navegador;
- limpeza de cookies/storage;
- permissoes de notificacao do navegador;
- futuro painel de consentimento, se analytics for ativado.

4. Alteracoes futuras

- a politica deve dizer que o inventario pode ser atualizado quando novos fornecedores forem adicionados.

## Recomendacao operacional

### Se PostHog continuar desligado em producao

Aplicacao recomendada:

- nao mostrar banner de consentimento de cookies;
- publicar politica de privacidade;
- publicar politica de cookies/tecnologias semelhantes;
- manter apenas documentacao transparente sobre cookies essenciais e armazenamento tecnico.

### Se PostHog for ligado em producao depois

Aplicacao recomendada:

- criar banner ou modal de consentimento antes da inicializacao do PostHog;
- manter categoria `Essenciais` sempre ativa;
- deixar `Analytics` desligado por padrao;
- gravar a escolha do utilizador;
- so chamar `posthog.init(...)` apos consentimento valido;
- oferecer forma simples de rever ou revogar a escolha.

### OneSignal

Aplicacao recomendada:

- nao usar banner generico de cookies para push;
- pedir permissao no contexto certo da funcionalidade;
- explicar isso na politica de privacidade e na politica de cookies/tecnologias semelhantes.

## Checklist de publicacao

- confirmar variaveis reais de producao para PostHog e OneSignal;
- confirmar lista final de fornecedores;
- definir email de privacidade e contacto juridico/comercial;
- escrever a versao publica da politica de privacidade;
- escrever a versao publica da politica de cookies;
- criar paginas publicas, por exemplo `/privacy` e `/cookies`;
- adicionar links no footer e no fluxo de autenticacao;
- versionar a data de entrada em vigor;
- guardar historico de alteracoes.

## Fontes oficiais para orientar a redacao

- CNPD sobre consentimento: https://www.cnpd.pt/organizacoes/areas-tematicas/consentimento/
- ICO sobre excecao para tecnologias estritamente necessarias: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- ICO, guia sobre cookies e tecnologias semelhantes: https://ico.org.uk/media/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/guidance-on-the-use-of-cookies-and-similar-technologies-1-0.pdf

## Proximo passo sugerido

Quando quiser publicar isso de verdade, o melhor fluxo e:

1. validar os fornecedores e flags de producao;
2. eu gerar o texto base da politica de privacidade;
3. eu gerar o texto base da politica de cookies;
4. voces revisarem o texto juridicamente antes de colocar no ar.

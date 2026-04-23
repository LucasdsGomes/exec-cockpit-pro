

# Login mobile + restrição de domínios + recuperação de senha

## Diagnóstico

1. **Mobile login quebrado**: o input `type="password"` em iOS/Android com fonte <16px dispara zoom automático que pode travar o submit em alguns navegadores. Além disso, o `Tabs` (Entrar/Criar conta) usa fonte pequena e área de toque reduzida. Sem `autoComplete`/`inputMode`, o autofill atrapalha. O botão Google em `<lg` ocupa largura cheia mas o card `max-w-md` em telas estreitas tem padding excessivo.
2. **Recuperação de senha**: a rota `/reset-password` já existe e está linkada, mas o template de email padrão da Lovable manda o link sem branding e o redirect não é validado em mobile (hash `type=recovery` pode vir como `?` em alguns provedores). Falta ainda configurar o Cloud para enviar o email.
3. **Restrição de domínios**: hoje qualquer email pode se cadastrar. Precisa bloquear no client (UX) **e** no servidor (segurança real) — apenas `@hitech-e.com.br` e `@milen-ia.com`.

## Mudanças

### 1. Validação de domínio de email (cliente + servidor)

- **Client (`src/routes/auth.tsx`)**: criar helper `ALLOWED_DOMAINS = ["hitech-e.com.br", "milen-ia.com"]` e função `isAllowedEmail(email)`. Aplicar em:
  - `handleSignUp` — bloqueia antes da chamada com toast claro.
  - `handleSignIn` — bloqueia antes (evita lockout/tentativas com email errado).
  - `handleGoogle` — após retorno bem-sucedido, verificar `session.user.email`; se não for permitido, fazer `signOut` imediato e mostrar toast.
  - Hint visual abaixo do campo email no signup: *"Apenas emails @hitech-e.com.br e @milen-ia.com"*.
- **Server (banco)**: trigger `BEFORE INSERT` em `auth.users` que rejeita emails fora dos domínios permitidos. Como `auth` é schema reservado, a forma correta é criar uma função `public.validate_email_domain()` chamada via trigger `BEFORE INSERT OR UPDATE OF email ON auth.users`. Lança `EXCEPTION` com mensagem em português. Isso garante que mesmo se alguém burlar o client, o backend rejeita.
- **Bonus**: mesmo trigger valida que o email do OAuth Google bate com o domínio. Sem bypass possível.

### 2. Refino mobile da tela `/auth`

- Reduzir padding do card em mobile (`p-4 sm:p-6`).
- Aumentar todos os inputs para `h-11 text-base` em mobile (16px = sem zoom iOS), `sm:h-10 sm:text-sm` em desktop.
- Adicionar `autoComplete="email"`, `autoComplete="current-password"` / `"new-password"`, `inputMode="email"`, `autoCapitalize="none"`, `spellCheck={false}` nos inputs.
- Tabs Entrar/Criar conta com `h-10` e `text-sm` (área de toque maior).
- Botão Google com `h-11` em mobile.
- Toaster com `position="top-center"` (melhor em mobile, aparece em cima do teclado).
- `min-h-svh` em vez de `min-h-screen` (corrige altura quando barra do navegador móvel aparece/some).
- Garantir scroll funcional: container externo com `overflow-y-auto` para casos de teclado virtual aberto em telas pequenas.

### 3. Recuperação de senha

- **Página `/reset-password` (já existe)**: aprimorar detecção do modo `update` aceitando tanto `#type=recovery` quanto `?type=recovery` (fallback via `searchParams`) e validando se há sessão ativa de recovery. Aplicar mesmas melhorias mobile (h-11, autoComplete="new-password").
- Adicionar feedback claro: *"Link enviado para seu email. Verifique também a caixa de spam."*
- Validar que o email digitado para recuperação também está nos domínios permitidos (mensagem amigável: *"Email não autorizado neste sistema."*).
- **Cloud → Emails**: configurar templates de email customizados (signup confirmation, password recovery) com branding Hitech. Requer:
  1. Configuração de domínio de email (subdomínio delegado).
  2. Scaffold dos auth email templates (gera função edge + 6 templates React Email com cores Hitech).
- **Importante**: o setup de email exige um domínio próprio. Vou abrir o diálogo para o usuário configurar no momento da execução.

### 4. Auto-confirm de email

- Hoje o signup pede confirmação por email. Como o cadastro já é restrito a 2 domínios corporativos, faz sentido **manter a confirmação** por segurança (evita typos), mas com email branded da Hitech (item 3 acima).

## Arquivos editados

- `src/routes/auth.tsx` — validação de domínio + refino mobile + autoComplete/inputMode.
- `src/routes/reset-password.tsx` — refino mobile + validação de domínio + detecção robusta de recovery.
- **Migração SQL** — função `public.validate_email_domain()` + trigger em `auth.users`.
- **Cloud → Emails** — setup de domínio + scaffold de templates auth (branded Hitech).

## Detalhes técnicos

- Trigger usa `SECURITY DEFINER` e `SET search_path = public`. Lança `RAISE EXCEPTION 'Email domain not allowed. Only @hitech-e.com.br and @milen-ia.com are permitted.'` que aparece no `error.message` do client.
- A validação client é UX-only; a do banco é a fonte de verdade.
- Sem mexer em RLS nem em outras tabelas.
- Para o setup de email branded, será necessário você informar (no diálogo que vai abrir) qual domínio quer usar como remetente — sugestão: `notify.hitech-e.com.br`. Isso requer que você adicione 2 registros NS no provedor do domínio `hitech-e.com.br`.

## Fora de escopo

- Magic link / passwordless.
- 2FA / MFA.
- Rate limiting custom (Supabase já tem padrão).
- Apple/Microsoft OAuth.


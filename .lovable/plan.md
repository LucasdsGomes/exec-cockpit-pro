## Problema confirmado

Consultei o banco e encontrei a causa real — a migração anterior **não cadastrou a Joice na empresa**:

| Usuário | `profiles.default_company_id` | `user_roles` |
|---|---|---|
| Rodrigo (admin) | Hitech Electric ✅ | admin @ Hitech ✅ |
| **Joice** | **NULL** ❌ | **nenhuma linha** ❌ |

A função RLS `current_user_companies()` lê **só de `user_roles`**. Como a Joice não tem nenhuma linha lá, todas as policies `SELECT ... WHERE company_id IN (current_user_companies())` retornam zero — por isso o dashboard dela aparece vazio e sem empresa selecionada.

## Correção (2 passos)

### 1. Migração de dados — desbloqueia a Joice agora

```sql
-- a) dar role 'finance' (gerente financeira) na Hitech Electric
INSERT INTO public.user_roles (user_id, company_id, role)
VALUES (
  '6977e626-6ef1-4ad8-aee9-b4fba10843b7',
  'aa3165b2-fa52-4b22-9a69-f7b3ebef00f8',
  'finance'
)
ON CONFLICT (user_id, company_id, role) DO NOTHING;

-- b) definir empresa padrão para o seletor abrir já com Hitech
UPDATE public.profiles
SET default_company_id = 'aa3165b2-fa52-4b22-9a69-f7b3ebef00f8'
WHERE id = '6977e626-6ef1-4ad8-aee9-b4fba10843b7';
```

> Observação: o enum `app_role` precisa ter `'finance'`. Se não tiver, uso `'admin'` (mesmo nível do Rodrigo, atende o pedido de "exatamente a mesma visualização") ou adiciono `finance` ao enum primeiro. Confirmo antes de rodar.

### 2. Trigger anti-recorrência — para futuros convidados

Hoje, qualquer usuário novo cai no mesmo buraco da Joice. Adiciono um trigger em `auth.users` que, no signup, popula automaticamente `profiles` (com `default_company_id` herdado do convite) e `user_roles` quando o admin convidar pela tela de Usuários (passo 2 do plano original, ainda não feito).

Mudança mínima nesta rodada: só o trigger de `profiles` (criar linha vazia ao signup) — a parte de `user_roles` virá junto da tela de convite.

## Validação após aplicar

1. Joice faz logout/login → seletor de empresa mostra "Hitech Electric"
2. Dashboard, DRE, DFC, Ciclo Financeiro carregam os mesmos números do Rodrigo
3. Ela consegue editar Plano de Contas (DE-PARA), pois `can_edit_company` aceita `finance`/`admin`

## Pergunta única antes de executar

A Joice deve entrar como **`finance`** (recomendado — gerente financeira, sem acessar configs sensíveis tipo "Avançado"/secrets) ou **`admin`** igual ao Rodrigo (acesso total)?

Responde **finance** ou **admin** que eu rodo a migração.
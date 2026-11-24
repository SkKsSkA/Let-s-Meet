-- Let's meet! — тестовые оплаты картой (Stripe, test-режим).
-- Выполни ПОСЛЕ 0001 и 0002: Supabase -> SQL Editor -> New query -> вставь файл целиком -> Run.
--
-- Взнос картой создаёт только сервер (webhook Stripe или проверка сессии) через service_role.
-- Гости и организатор не могут создать «оплаченный» взнос картой руками.

alter table public.contributions
  add column if not exists method text not null default 'kaspi_transfer',
  add column if not exists provider_ref text;

alter table public.contributions drop constraint if exists contributions_method_check;
alter table public.contributions add constraint contributions_method_check
  check (method in ('kaspi_transfer', 'card_test', 'kaspi_qr'));

alter table public.contributions drop constraint if exists contributions_provider_ref_check;
alter table public.contributions add constraint contributions_provider_ref_check
  check (provider_ref is null or char_length(provider_ref) between 1 and 120);

-- Одна платёжная сессия = один взнос. Повторный webhook ничего не дублирует.
-- В PostgreSQL несколько NULL допустимы, поэтому переводы Kaspi без provider_ref не мешают.
create unique index if not exists contributions_provider_ref_key
  on public.contributions (provider_ref);

-- Организатор вручную добавляет только взнос «перевод Kaspi» (наличные, своя доля).
drop policy if exists "contributions: добавляет организатор" on public.contributions;
create policy "contributions: добавляет организатор"
  on public.contributions for insert
  with check (
    method = 'kaspi_transfer'
    and provider_ref is null
    and exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );

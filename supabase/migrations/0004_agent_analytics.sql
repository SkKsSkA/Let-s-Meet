begin;

create table public.agent_requests (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  kind text,
  source text not null check (source in ('ai', 'fallback')),
  created_at timestamptz not null default now(),
  unique (id, organizer_id)
);

alter table public.agent_requests enable row level security;
revoke all on public.agent_requests from anon, authenticated;
grant select, insert on public.agent_requests to service_role;
create index on public.agent_requests (created_at);
create index on public.agent_requests (organizer_id);

alter table public.events add column agent_request_id uuid;
alter table public.events add constraint events_agent_request_for_organizer
  foreign key (agent_request_id, host_id) references public.agent_requests (id, organizer_id)
  deferrable initially deferred;
create index on public.events (agent_request_id) where agent_request_id is not null;

commit;

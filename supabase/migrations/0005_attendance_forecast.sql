begin;

create table public.rsvp_attendance (
  rsvp_id uuid primary key references public.rsvps(id) on delete cascade,
  attended boolean not null,
  promised boolean not null,
  recorded_at timestamptz not null default now()
);
alter table public.rsvp_attendance enable row level security;
revoke all on public.rsvp_attendance from public, anon, authenticated;
grant select, insert, update on public.rsvp_attendance to service_role;
create index on public.rsvps (guest_key);

-- Keep the guest's response as of the start, when the forecast turns into a check-in list.
create or replace function public.submit_rsvp(p_slug text, p_guest_key uuid, p_name text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_start timestamptz;
begin
  select id, starts_at into v_event, v_start from public.events where slug = p_slug for share;
  if v_event is null then
    raise exception 'event not found';
  end if;
  if v_start <= clock_timestamp() then
    raise exception 'rsvp closed' using errcode = '22023';
  end if;
  insert into public.rsvps (event_id, guest_key, guest_name, status)
  values (v_event, p_guest_key, left(btrim(p_name), 60), p_status)
  on conflict (event_id, guest_key)
  do update set guest_name = excluded.guest_name, status = excluded.status, updated_at = now();
end;
$$;

create function public.mark_event_attendance(p_rsvp_id uuid, p_attended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select r.status into v_status
  from public.rsvps r join public.events e on e.id = r.event_id
  where r.id = p_rsvp_id and e.host_id = auth.uid() and e.starts_at <= now()
  for update of r;

  if not found then
    raise exception 'attendance unavailable' using errcode = '42501';
  end if;

  if p_attended is null then
    delete from public.rsvp_attendance where rsvp_id = p_rsvp_id;
  else
    insert into public.rsvp_attendance (rsvp_id, attended, promised)
    values (p_rsvp_id, p_attended, v_status = 'yes')
    on conflict (rsvp_id) do update
    set attended = excluded.attended, recorded_at = now();
  end if;
end;
$$;

create function public.event_attendance_forecast(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select id, host_id, starts_at from public.events
    where id = p_event_id and host_id = auth.uid()
  ), probabilities as (
    select r.id, a.attended, case r.status
      when 'yes' then (history.arrivals + 3)::numeric / (history.observations + 4)
      when 'maybe' then 0.35::numeric
      else 0::numeric
    end as probability,
    r.status = 'yes' and history.observations > 0 as has_history
    from target t join public.rsvps r on r.event_id = t.id
    left join public.rsvp_attendance a on a.rsvp_id = r.id
    left join lateral (
      select count(*) as observations, count(*) filter (where previous.attended) as arrivals
      from public.rsvps past
      join public.events e on e.id = past.event_id
      join public.rsvp_attendance previous on previous.rsvp_id = past.id
      where past.guest_key = r.guest_key and e.host_id = t.host_id
        and e.starts_at < least(t.starts_at, now()) and previous.promised and r.status = 'yes'
    ) history on true
  )
  select jsonb_build_object(
    'expected', coalesce((select round(sum(probability)) from probabilities), 0),
    'responses', (select count(*) from probabilities),
    'withHistory', (select count(*) from probabilities where has_history),
    'canMark', t.starts_at <= now(),
    'present', (select count(*) from probabilities where attended),
    'absent', (select count(*) from probabilities where not attended),
    'marks', coalesce((select jsonb_object_agg(id, attended) from probabilities where attended is not null), '{}'::jsonb)
  )
  from target t;
$$;

revoke execute on function public.mark_event_attendance(uuid, boolean) from public, anon, authenticated;
grant execute on function public.mark_event_attendance(uuid, boolean) to authenticated;
revoke execute on function public.event_attendance_forecast(uuid) from public, anon, authenticated;
grant execute on function public.event_attendance_forecast(uuid) to authenticated;

commit;

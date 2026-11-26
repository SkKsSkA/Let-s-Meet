begin;

drop function if exists public.event_attendance_forecast(uuid);
drop function if exists public.mark_event_attendance(uuid, boolean);
revoke insert, update on public.rsvp_attendance from service_role;
drop index if exists public.rsvps_guest_key_idx;

create or replace function public.submit_rsvp(p_slug text, p_guest_key uuid, p_name text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
begin
  select id into v_event from public.events where slug = p_slug;
  if v_event is null then
    raise exception 'event not found';
  end if;
  insert into public.rsvps (event_id, guest_key, guest_name, status)
  values (v_event, p_guest_key, left(btrim(p_name), 60), p_status)
  on conflict (event_id, guest_key)
  do update set guest_name = excluded.guest_name, status = excluded.status, updated_at = now();
end;
$$;

commit;

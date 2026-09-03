create or replace function public.bump_daily_usage(_messages integer default 0, _voice_seconds integer default 0)
returns table (message_count integer, voice_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Unauthorized';
  end if;

  return query
  insert into public.daily_usage as d (user_id, date, message_count, voice_seconds)
  values (uid, (now() at time zone 'utc')::date, greatest(_messages, 0), greatest(_voice_seconds, 0))
  on conflict (user_id, date) do update
    set message_count = greatest(d.message_count + _messages, 0),
        voice_seconds = greatest(d.voice_seconds + _voice_seconds, 0)
  returning d.message_count, d.voice_seconds;
end;
$$;

revoke all on function public.bump_daily_usage(integer, integer) from public, anon;
grant execute on function public.bump_daily_usage(integer, integer) to authenticated;
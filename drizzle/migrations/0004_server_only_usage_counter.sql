CREATE OR REPLACE FUNCTION public.bump_daily_usage_for(_user_id uuid, _messages integer DEFAULT 0, _voice_seconds integer DEFAULT 0)
RETURNS TABLE(message_count integer, voice_seconds integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if _user_id is null then raise exception 'Unauthorized'; end if;
  return query
  insert into public.daily_usage as d (user_id, date, message_count, voice_seconds)
  values (_user_id, (now() at time zone 'utc')::date, greatest(_messages, 0), greatest(_voice_seconds, 0))
  on conflict (user_id, date) do update
    set message_count = greatest(d.message_count + _messages, 0),
        voice_seconds = greatest(d.voice_seconds + _voice_seconds, 0)
  returning d.message_count, d.voice_seconds;
end;
$$;
REVOKE ALL ON FUNCTION public.bump_daily_usage_for(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_daily_usage_for(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.bump_daily_usage(integer, integer) FROM PUBLIC, anon, authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, voice_id, memory_enabled, reflection_optin, age_confirmed, last_active_at) ON public.profiles TO authenticated;
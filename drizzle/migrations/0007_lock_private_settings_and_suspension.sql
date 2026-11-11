CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT suspended FROM public.profiles WHERE id = _user_id), false)
  WHERE _user_id = auth.uid() OR auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.get_runtime_site_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_runtime_site_settings() TO service_role;